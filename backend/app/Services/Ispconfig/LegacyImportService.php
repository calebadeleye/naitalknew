<?php

namespace App\Services\Ispconfig;

use App\Models\Client;
use App\Models\DatabaseRecord;
use App\Models\EmailDomainRecord;
use App\Models\FtpAccountRecord;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\IspConfigClientMapping;
use App\Models\IspConfigServiceMapping;
use App\Models\MailboxRecord;
use App\Models\ProvisioningLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Reads existing clients/websites/mailboxes/databases/SSH accounts/FTP accounts out of ISPConfig and
 * mirrors them into the NAI TALK database under the hidden "Legacy Hosting +
 * SSL" package, so old manually-provisioned customers can be billed and
 * tracked from this application without touching ISPConfig itself.
 *
 * Hard safety rule: this class must NEVER call an ISPConfig create/update/
 * delete/provisioning method (client_add, sites_web_domain_add,
 * mail_domain_add, mail_user_add, sites_database_add, dns_zone_add, ...).
 * Only *List()/*Get() read methods are used. All writes happen on the local
 * NAI TALK database only.
 */
class LegacyImportService
{
    public function __construct(private readonly IspConfigClient $ispConfig) {}

    /**
     * @return array{clients: array<int, array<string, mixed>>, dry_run: bool}
     */
    public function run(bool $dryRun = false): array
    {
        $serverId = (int) config('ispconfig.server_id', 1);
        $legacyPlan = $this->legacyPlan();

        $sessionId = $this->ispConfig->login();
        $results = [];

        try {
            $remoteClients = $this->ispConfig->clientList($sessionId);

            foreach ($remoteClients as $remoteClient) {
                $results[] = $this->importClient($remoteClient, $sessionId, $serverId, $legacyPlan, $dryRun);
            }
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        return ['dry_run' => $dryRun, 'clients' => $results];
    }

    private function legacyPlan(): HostingPlan
    {
        $plan = HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->first();

        if (! $plan) {
            throw new RuntimeException('The "Legacy Hosting + SSL" package is not seeded yet. Run HostingPlanSeeder first.');
        }

        return $plan;
    }

    /**
     * @param  array<string, mixed>  $remoteClient
     * @return array<string, mixed>
     */
    private function importClient(array $remoteClient, string $sessionId, int $serverId, HostingPlan $legacyPlan, bool $dryRun): array
    {
        $ispClientId = trim((string) ($remoteClient['client_id'] ?? ''));

        if ($ispClientId === '') {
            $this->log(null, null, 'import_failed', 'Skipped a remote client with no client_id.', ['remote_client' => $remoteClient]);

            return [
                'ispconfig_client_id' => null,
                'client_name' => null,
                'import_status' => 'failed',
                'reason' => 'missing_ispconfig_client_id',
            ];
        }

        $clientName = (string) ($remoteClient['company_name'] ?? $remoteClient['contact_name'] ?? "ISPConfig Client {$ispClientId}");
        $clientCreatedAt = LegacyRenewalDateCalculator::extractCreationDate($remoteClient);

        $mapping = IspConfigClientMapping::query()
            ->where('ispconfig_server_id', $serverId)
            ->where('ispconfig_client_id', $ispClientId)
            ->first();

        $existingClient = $mapping?->client;
        $clientAction = $existingClient ? 'linked_existing_client' : 'imported_client';

        try {
            if ($dryRun) {
                $client = $existingClient;
            } else {
                $client = DB::transaction(fn () => $this->findOrCreateLocalClient($existingClient, $remoteClient, $ispClientId, $clientName, $serverId));
            }

            $this->log(
                $client,
                null,
                $clientAction,
                $clientAction === 'imported_client'
                    ? "Imported ISPConfig client {$ispClientId} ({$clientName})."
                    : "Linked existing local client to ISPConfig client {$ispClientId}.",
                ['ispconfig_client_id' => $ispClientId]
            );
        } catch (Throwable $exception) {
            $this->log(null, null, 'import_failed', 'Failed to import/link client: '.$exception->getMessage(), ['ispconfig_client_id' => $ispClientId]);

            return [
                'ispconfig_client_id' => $ispClientId,
                'client_name' => $clientName,
                'import_status' => 'failed',
                'reason' => $exception->getMessage(),
            ];
        }

        // ISPConfig's web_domain/mail_user/mail_domain/sites_database tables
        // have no client_id column — resources are owned by the client's
        // "sys_groupid" instead, which every real ISPConfig install we've
        // checked assigns as (client_id + 1) because the client's group row
        // is always created immediately before the client row itself. This
        // is empirical, not a documented API guarantee — if a future
        // ISPConfig version breaks this, sites/mailboxes/databases will
        // simply come back empty rather than misattributed (safe failure).
        $groupFilter = ['sys_groupid' => ((int) $ispClientId) + 1];

        try {
            $remoteSites = $this->ispConfig->sitesWebDomainList($sessionId, $groupFilter);
            $remoteMailUsers = $this->ispConfig->mailUserList($sessionId, $groupFilter);
            $remoteMailDomains = $this->ispConfig->mailDomainList($sessionId, $groupFilter);
            $remoteDatabases = $this->ispConfig->databasesDatabaseList($sessionId, $groupFilter);
            $remoteShellUsers = $this->ispConfig->shellUserList($sessionId, $groupFilter);
            $remoteFtpUsers = $this->ispConfig->ftpUserList($sessionId, $groupFilter);
        } catch (Throwable $exception) {
            $this->log($client, null, 'import_failed', "Failed to fetch websites/mailboxes/databases/ssh accounts/ftp accounts for client {$ispClientId}: ".$exception->getMessage(), ['ispconfig_client_id' => $ispClientId]);

            return [
                'ispconfig_client_id' => $ispClientId,
                'client_id' => $client?->id,
                'client_name' => $clientName,
                'import_status' => $clientAction,
                'websites' => [],
                'email_accounts_count' => 0,
                'databases_count' => 0,
                'ssh_accounts_count' => 0,
                'ftp_accounts_count' => 0,
                'ispconfig_created_at' => $clientCreatedAt?->toDateString(),
                'suggested_renewal_date' => null,
                'renewal_amount' => '₦40,000/year',
                'manual_renewal_date_required' => true,
                'sites' => [],
                'reason' => $exception->getMessage(),
            ];
        }

        $siteResults = [];
        $primaryService = null;

        foreach ($remoteSites as $remoteSite) {
            try {
                $siteResult = $this->importWebsite($remoteSite, $client, $clientCreatedAt, $legacyPlan, $serverId, $dryRun);
            } catch (Throwable $exception) {
                $domain = $remoteSite['domain'] ?? $remoteSite['server_domain'] ?? 'unknown domain';
                $this->log($client, null, 'import_failed', "Failed to import website {$domain}: ".$exception->getMessage(), ['remote_site' => ['domain' => $domain]]);
                $siteResult = ['domain' => $domain, 'hosting_service' => null, 'action' => 'failed', 'suggested_renewal_date' => null, 'manual_renewal_date_required' => false];
            }

            $siteResults[] = $siteResult;

            if ($primaryService === null && $siteResult['hosting_service'] !== null) {
                $primaryService = $siteResult['hosting_service'];
            }
        }

        $mailboxCount = 0;
        $databaseCount = 0;
        $shellAccountCount = 0;
        $ftpAccountCount = 0;

        if ($primaryService !== null || $dryRun) {
            $mailboxCount = $this->importMailboxes($remoteMailUsers, $siteResults, $primaryService, $client, $dryRun);
            $databaseCount = $this->importDatabases($remoteDatabases, $primaryService, $client, $dryRun);
            $shellAccountCount = $this->importShellAccounts($remoteShellUsers, $primaryService, $client, $dryRun);
            $ftpAccountCount = $this->importFtpAccounts($remoteFtpUsers, $primaryService, $client, $dryRun);
            $this->importMailDomains($remoteMailDomains, $siteResults, $primaryService, $client, $dryRun);
        } elseif (($remoteMailUsers !== [] || $remoteDatabases !== [] || $remoteShellUsers !== [] || $remoteFtpUsers !== []) && $client !== null) {
            $this->log($client, null, 'manual_renewal_date_required', 'Client has mailboxes/databases/ssh accounts/ftp accounts in ISPConfig but no website — assign a website before importing them.', []);
        }

        $suggestedRenewalDate = collect($siteResults)->pluck('suggested_renewal_date')->filter()->sort()->first();
        $manualRequired = collect($siteResults)->contains('manual_renewal_date_required', true) || ($siteResults === [] && $clientCreatedAt === null);

        return [
            'ispconfig_client_id' => $ispClientId,
            'client_id' => $client?->id,
            'client_name' => $clientName,
            'import_status' => $clientAction,
            'websites' => collect($siteResults)->pluck('domain')->all(),
            'email_accounts_count' => $mailboxCount,
            'databases_count' => $databaseCount,
            'ssh_accounts_count' => $shellAccountCount,
            'ftp_accounts_count' => $ftpAccountCount,
            'ispconfig_created_at' => $clientCreatedAt?->toDateString(),
            'suggested_renewal_date' => $suggestedRenewalDate,
            'renewal_amount' => '₦40,000/year',
            'manual_renewal_date_required' => $manualRequired,
            'sites' => $siteResults,
        ];
    }

    private function findOrCreateLocalClient(?Client $existingClient, array $remoteClient, string $ispClientId, string $clientName, int $serverId): Client
    {
        if ($existingClient) {
            return $existingClient;
        }

        $email = trim((string) ($remoteClient['email'] ?? ''));

        if ($email === '' || User::query()->where('email', $email)->exists()) {
            $email = "legacy-{$ispClientId}@imported.naitalk.internal";
        }

        $user = User::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $clientName,
                'password' => Hash::make(Str::random(40)),
                'role' => 'client',
                'phone' => $remoteClient['telephone'] ?? $remoteClient['mobile'] ?? null,
                'account_status' => 'active',
            ]
        );

        $client = Client::query()->firstOrCreate(
            ['client_code' => 'CLT-LEGACY-'.$ispClientId],
            [
                'user_id' => $user->id,
                'company_name' => $remoteClient['company_name'] ?? null,
                'account_type' => 'imported_legacy_client',
                'client_status' => 'active',
                'status' => 'active',
                'billing_email' => $email,
                'billing_phone' => $remoteClient['telephone'] ?? $remoteClient['mobile'] ?? null,
                'address' => $remoteClient['street'] ?? null,
                'city' => $remoteClient['city'] ?? null,
                'country' => $remoteClient['country'] ?? 'Nigeria',
                'last_activity_at' => now(),
                'metadata' => ['import_source' => 'ispconfig_import'],
            ]
        );

        IspConfigClientMapping::query()->updateOrCreate(
            ['client_id' => $client->id, 'ispconfig_server_id' => $serverId],
            [
                'ispconfig_client_id' => $ispClientId,
                'sync_status' => 'provisioned',
                'provisioned_at' => now(),
                'last_synced_at' => now(),
                'metadata_json' => ['import_source' => 'ispconfig_import', 'invite_status' => 'not_sent'],
            ]
        );

        return $client;
    }

    /**
     * @param  array<string, mixed>  $remoteSite
     * @return array{domain: ?string, hosting_service: ?HostingService, action: string, suggested_renewal_date: ?string, manual_renewal_date_required: bool}
     */
    private function importWebsite(array $remoteSite, ?Client $client, ?Carbon $clientCreatedAt, HostingPlan $legacyPlan, int $serverId, bool $dryRun): array
    {
        $domain = $remoteSite['domain'] ?? $remoteSite['server_domain'] ?? null;
        $ispWebsiteId = isset($remoteSite['domain_id']) ? (string) $remoteSite['domain_id'] : (isset($remoteSite['website_id']) ? (string) $remoteSite['website_id'] : null);

        if (! $domain) {
            $this->log($client, null, 'import_failed', 'Skipped a remote website with no domain name.', ['remote_site' => $remoteSite]);

            return ['domain' => null, 'hosting_service' => null, 'action' => 'failed', 'suggested_renewal_date' => null, 'manual_renewal_date_required' => false];
        }

        $siteCreatedAt = LegacyRenewalDateCalculator::extractCreationDate($remoteSite) ?? $clientCreatedAt;
        $reference = now();

        $renewalDate = null;
        $renewalDateSource = 'manual_required';
        $renewalStatus = 'pending_manual_renewal_date';

        if ($siteCreatedAt) {
            $renewalDate = LegacyRenewalDateCalculator::nextAnniversary($siteCreatedAt, $reference);
            $renewalDateSource = 'ispconfig_created_date';
            $renewalStatus = null;
        }

        // Match existing local service: external id first, domain fallback.
        $existingMapping = $ispWebsiteId ? IspConfigServiceMapping::query()
            ->where('ispconfig_server_id', $serverId)
            ->where('ispconfig_website_id', $ispWebsiteId)
            ->first() : null;

        $existingService = $existingMapping?->hostingService
            ?? HostingService::query()->where('primary_domain', $domain)->first();

        if ($existingService && $existingService->source === 'checkout') {
            // Domain collides with a real paying customer's service — never
            // touch it. Flag for manual review instead of guessing.
            $this->log($client, $existingService, 'skipped_duplicate', "Domain {$domain} already belongs to a non-legacy hosting service — skipped.", ['ispconfig_website_id' => $ispWebsiteId]);

            return ['domain' => $domain, 'hosting_service' => null, 'action' => 'skipped_duplicate', 'suggested_renewal_date' => $renewalDate?->toDateString(), 'manual_renewal_date_required' => $renewalStatus !== null];
        }

        $action = $existingService ? 'linked_existing_website' : 'imported_website';

        if ($dryRun) {
            $this->log($client, $existingService, $action, 'Would '.($action === 'imported_website' ? 'import' : 'link')." website {$domain}.", ['domain' => $domain]);

            return ['domain' => $domain, 'hosting_service' => $existingService, 'action' => $action, 'suggested_renewal_date' => $renewalDate?->toDateString(), 'manual_renewal_date_required' => $renewalStatus !== null];
        }

        $service = DB::transaction(function () use ($existingService, $client, $legacyPlan, $domain, $siteCreatedAt, $renewalDate, $renewalDateSource, $renewalStatus, $ispWebsiteId, $serverId) {
            $service = $existingService ?: HostingService::query()->create([
                'client_id' => $client->id,
                'hosting_plan_id' => $legacyPlan->id,
                'service_number' => 'SRV-LEGACY-'.Str::upper(Str::random(10)),
                'display_name' => $domain,
                'primary_domain' => $domain,
                'status' => 'active',
                'billing_cycle' => 'yearly',
                'amount_kobo' => ($legacyPlan->hosting_amount_kobo ?? 0) + ($legacyPlan->ssl_amount_kobo ?? 0),
                'auto_renew_enabled' => true,
                'provisioning_status' => 'imported_existing',
                'source' => 'ispconfig_import',
                'plan_type' => 'legacy',
                'migration_status' => 'legacy',
            ]);

            $service->forceFill([
                'client_id' => $service->client_id ?: $client->id,
                'hosting_plan_id' => $service->hosting_plan_id ?: $legacyPlan->id,
                'source' => 'ispconfig_import',
                'plan_type' => $service->plan_type === 'website_care' ? 'legacy' : $service->plan_type,
                'provisioning_status' => 'imported_existing',
                'imported_at' => $service->imported_at ?? now(),
                'last_synced_at' => now(),
                'created_from_ispconfig_at' => $siteCreatedAt,
                'renewal_date_source' => $renewalDateSource,
                'renewal_status' => $renewalStatus,
                'hosting_expires_at' => $renewalDate,
                'ssl_expires_at' => $renewalDate,
                'next_invoice_date' => $renewalDate,
                // Also populate the pre-existing renewal fields the admin
                // and client dashboards already read ("Upcoming Renewals",
                // "Next Renewal") so legacy services show up there too.
                'renews_at' => $renewalDate,
                'next_due_date' => $renewalDate,
                'migration_status' => $service->migration_status === 'standard' ? 'legacy' : $service->migration_status,
            ])->save();

            IspConfigServiceMapping::query()->updateOrCreate(
                ['hosting_service_id' => $service->id, 'ispconfig_server_id' => $serverId],
                [
                    'ispconfig_client_mapping_id' => IspConfigClientMapping::query()
                        ->where('client_id', $client->id)
                        ->where('ispconfig_server_id', $serverId)
                        ->value('id'),
                    'ispconfig_website_id' => $ispWebsiteId,
                    'technical_status' => 'active',
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import'],
                ]
            );

            return $service;
        });

        $this->log($client, $service, $action, ($action === 'imported_website' ? "Imported website {$domain}." : "Linked existing website {$domain}."), ['domain' => $domain]);

        if ($renewalDateSource === 'ispconfig_created_date') {
            $this->log($client, $service, 'renewal_date_calculated', "Calculated next renewal date {$renewalDate?->toDateString()} for {$domain}.", ['created_from_ispconfig_at' => $siteCreatedAt?->toDateString()]);
        } else {
            $this->log($client, $service, 'manual_renewal_date_required', "No ISPConfig creation date found for {$domain} — admin must set the renewal date manually.", []);
        }

        return ['domain' => $domain, 'hosting_service' => $service, 'action' => $action, 'suggested_renewal_date' => $renewalDate?->toDateString(), 'manual_renewal_date_required' => $renewalStatus !== null];
    }

    /**
     * @param  array<int, array<string, mixed>>  $remoteMailUsers
     * @param  array<int, array<string, mixed>>  $siteResults
     */
    private function importMailboxes(array $remoteMailUsers, array $siteResults, ?HostingService $primaryService, ?Client $client, bool $dryRun): int
    {
        $count = 0;

        foreach ($remoteMailUsers as $remoteMailUser) {
            $email = trim((string) ($remoteMailUser['email'] ?? ''));

            if ($email === '') {
                continue;
            }

            $count++;

            if ($dryRun) {
                $this->log($client, $primaryService, 'imported_mailbox', "Would import mailbox {$email}. Password not available. Reset if needed.", ['email' => $email]);

                continue;
            }

            $targetService = $this->matchServiceForEmail($email, $siteResults) ?? $primaryService;

            if (! $targetService) {
                $this->log($client, null, 'manual_renewal_date_required', "Mailbox {$email} has no destination website — skipped.", ['email' => $email]);

                continue;
            }

            try {
                $ispMailboxId = isset($remoteMailUser['mailuser_id']) ? (string) $remoteMailUser['mailuser_id'] : null;

                $mailbox = MailboxRecord::withTrashed()->firstOrNew(['hosting_service_id' => $targetService->id, 'email_address' => $email]);
                $isNew = ! $mailbox->exists;

                $mailbox->fill([
                    'hosting_service_id' => $targetService->id,
                    'ispconfig_mailbox_id' => $ispMailboxId,
                    'display_name' => $remoteMailUser['name'] ?? null,
                    'quota_mb' => $this->quotaMb($remoteMailUser['quota'] ?? 0),
                    'status' => 'active',
                    'source' => 'ispconfig_import',
                    'imported_at' => $mailbox->imported_at ?? now(),
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import', 'password_note' => 'Password not available. Reset if needed.'],
                ])->save();

                $this->log($client, $targetService, $isNew ? 'imported_mailbox' : 'linked_existing_mailbox', "Mailbox {$email}. Password not available. Reset if needed.", ['email' => $email]);
            } catch (Throwable $exception) {
                $this->log($client, $targetService, 'import_failed', "Failed to import mailbox {$email}: ".$exception->getMessage(), ['email' => $email]);
            }
        }

        return $count;
    }

    /**
     * ISPConfig stores mail_user.quota in bytes (or 0/-1 for unlimited);
     * our quota_mb column is, as the name says, megabytes.
     */
    private function quotaMb(mixed $rawQuota): int
    {
        $bytes = (int) $rawQuota;

        return $bytes > 0 ? (int) round($bytes / 1_048_576) : 0;
    }

    /**
     * @param  array<int, array<string, mixed>>  $remoteDatabases
     */
    private function importDatabases(array $remoteDatabases, ?HostingService $primaryService, ?Client $client, bool $dryRun): int
    {
        $count = 0;

        foreach ($remoteDatabases as $remoteDatabase) {
            $name = trim((string) ($remoteDatabase['database_name'] ?? $remoteDatabase['name'] ?? ''));

            if ($name === '') {
                continue;
            }

            $count++;

            if ($dryRun) {
                $this->log($client, $primaryService, 'imported_database', "Would import database {$name}. Password not available. Reset if needed.", ['database_name' => $name]);

                continue;
            }

            if (! $primaryService) {
                $this->log($client, null, 'manual_renewal_date_required', "Database {$name} has no destination website — skipped.", ['database_name' => $name]);

                continue;
            }

            try {
                $ispDatabaseId = isset($remoteDatabase['database_id']) ? (string) $remoteDatabase['database_id'] : null;
                $username = (string) ($remoteDatabase['database_user'] ?? $remoteDatabase['username'] ?? $name);

                $database = DatabaseRecord::withTrashed()->firstOrNew(['hosting_service_id' => $primaryService->id, 'database_name' => $name]);
                $isNew = ! $database->exists;

                $database->fill([
                    'hosting_service_id' => $primaryService->id,
                    'ispconfig_database_id' => $ispDatabaseId,
                    'username' => $username,
                    'status' => 'active',
                    'source' => 'ispconfig_import',
                    'imported_at' => $database->imported_at ?? now(),
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import', 'password_note' => 'Password not available. Reset if needed.'],
                ])->save();

                $this->log($client, $primaryService, $isNew ? 'imported_database' : 'linked_existing_database', "Database {$name}. Password not available. Reset if needed.", ['database_name' => $name]);
            } catch (Throwable $exception) {
                $this->log($client, $primaryService, 'import_failed', "Failed to import database {$name}: ".$exception->getMessage(), ['database_name' => $name]);
            }
        }

        return $count;
    }

    /**
     * ISPConfig's shell users are SSH/SFTP accounts — stored in the same
     * ftp_account_records table the app already uses for its own self-service
     * SFTP accounts (see FtpAccountController), distinguished only by
     * access_type ('sftp' here vs 'ftp' in importFtpAccounts below). This
     * mirrors FtpAccountProvisioningActionJob's own create()/sync logic,
     * which already branches on access_type to call shellUser* vs ftpUser*.
     *
     * @param  array<int, array<string, mixed>>  $remoteShellUsers
     */
    private function importShellAccounts(array $remoteShellUsers, ?HostingService $primaryService, ?Client $client, bool $dryRun): int
    {
        $count = 0;

        foreach ($remoteShellUsers as $remoteShellUser) {
            $username = trim((string) ($remoteShellUser['username'] ?? ''));

            if ($username === '') {
                continue;
            }

            $count++;

            if ($dryRun) {
                $this->log($client, $primaryService, 'imported_shell_account', "Would import SSH account {$username}. Password not available. Reset if needed.", ['username' => $username]);

                continue;
            }

            if (! $primaryService) {
                $this->log($client, null, 'manual_renewal_date_required', "SSH account {$username} has no destination website — skipped.", ['username' => $username]);

                continue;
            }

            try {
                $ispShellUserId = isset($remoteShellUser['shell_user_id']) ? (string) $remoteShellUser['shell_user_id'] : null;

                $shellAccount = FtpAccountRecord::withTrashed()->firstOrNew(['hosting_service_id' => $primaryService->id, 'username' => $username]);
                $isNew = ! $shellAccount->exists;

                $shellAccount->fill([
                    'hosting_service_id' => $primaryService->id,
                    'ispconfig_ftp_user_id' => $ispShellUserId,
                    'access_type' => 'sftp',
                    'status' => 'active',
                    'source' => 'ispconfig_import',
                    'imported_at' => $shellAccount->imported_at ?? now(),
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import', 'password_note' => 'Password not available. Reset if needed.'],
                ])->save();

                $this->log($client, $primaryService, $isNew ? 'imported_shell_account' : 'linked_existing_shell_account', "SSH account {$username}. Password not available. Reset if needed.", ['username' => $username]);
            } catch (Throwable $exception) {
                $this->log($client, $primaryService, 'import_failed', "Failed to import SSH account {$username}: ".$exception->getMessage(), ['username' => $username]);
            }
        }

        return $count;
    }

    /**
     * Legacy PureFTPd ('ftp') accounts — the counterpart to importShellAccounts
     * above, which handles the 'sftp' access_type in this same table.
     *
     * @param  array<int, array<string, mixed>>  $remoteFtpUsers
     */
    private function importFtpAccounts(array $remoteFtpUsers, ?HostingService $primaryService, ?Client $client, bool $dryRun): int
    {
        $count = 0;

        foreach ($remoteFtpUsers as $remoteFtpUser) {
            $username = trim((string) ($remoteFtpUser['username'] ?? ''));

            if ($username === '') {
                continue;
            }

            $count++;

            if ($dryRun) {
                $this->log($client, $primaryService, 'imported_ftp_account', "Would import FTP account {$username}. Password not available. Reset if needed.", ['username' => $username]);

                continue;
            }

            if (! $primaryService) {
                $this->log($client, null, 'manual_renewal_date_required', "FTP account {$username} has no destination website — skipped.", ['username' => $username]);

                continue;
            }

            try {
                $ispFtpUserId = isset($remoteFtpUser['ftp_user_id']) ? (string) $remoteFtpUser['ftp_user_id'] : null;

                $ftpAccount = FtpAccountRecord::withTrashed()->firstOrNew(['hosting_service_id' => $primaryService->id, 'username' => $username]);
                $isNew = ! $ftpAccount->exists;

                $ftpAccount->fill([
                    'hosting_service_id' => $primaryService->id,
                    'ispconfig_ftp_user_id' => $ispFtpUserId,
                    'access_type' => 'ftp',
                    'status' => 'active',
                    'source' => 'ispconfig_import',
                    'imported_at' => $ftpAccount->imported_at ?? now(),
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import', 'password_note' => 'Password not available. Reset if needed.'],
                ])->save();

                $this->log($client, $primaryService, $isNew ? 'imported_ftp_account' : 'linked_existing_ftp_account', "FTP account {$username}. Password not available. Reset if needed.", ['username' => $username]);
            } catch (Throwable $exception) {
                $this->log($client, $primaryService, 'import_failed', "Failed to import FTP account {$username}: ".$exception->getMessage(), ['username' => $username]);
            }
        }

        return $count;
    }

    /**
     * @param  array<int, array<string, mixed>>  $remoteMailDomains
     * @param  array<int, array<string, mixed>>  $siteResults
     */
    private function importMailDomains(array $remoteMailDomains, array $siteResults, ?HostingService $primaryService, ?Client $client, bool $dryRun): void
    {
        foreach ($remoteMailDomains as $remoteMailDomain) {
            $domain = trim((string) ($remoteMailDomain['domain'] ?? ''));

            if ($domain === '') {
                continue;
            }

            if ($dryRun) {
                continue;
            }

            $targetService = collect($siteResults)->firstWhere('domain', $domain)['hosting_service'] ?? $primaryService;

            if (! $targetService) {
                continue;
            }

            try {
                $ispMailDomainId = isset($remoteMailDomain['domain_id'])
                    ? (string) $remoteMailDomain['domain_id']
                    : (isset($remoteMailDomain['mail_domain_id']) ? (string) $remoteMailDomain['mail_domain_id'] : null);

                EmailDomainRecord::withTrashed()->updateOrCreate(
                    ['hosting_service_id' => $targetService->id, 'domain' => $domain],
                    [
                        'ispconfig_mail_domain_id' => $ispMailDomainId,
                        'status' => 'active',
                        'source' => 'ispconfig_import',
                        'imported_at' => now(),
                        'last_synced_at' => now(),
                        'metadata_json' => ['import_source' => 'ispconfig_import'],
                    ]
                );

                $this->log($client, $targetService, 'imported_email_domain', "Imported mail domain {$domain}.", ['domain' => $domain]);
            } catch (Throwable $exception) {
                $this->log($client, $targetService, 'import_failed', "Failed to import mail domain {$domain}: ".$exception->getMessage(), ['domain' => $domain]);
            }
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $siteResults
     */
    private function matchServiceForEmail(string $email, array $siteResults): ?HostingService
    {
        $parts = explode('@', $email);
        $domain = strtolower($parts[1] ?? '');

        foreach ($siteResults as $site) {
            if ($site['hosting_service'] && strtolower((string) $site['domain']) === $domain) {
                return $site['hosting_service'];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function log(?Client $client, ?HostingService $service, string $status, string $message, array $payload): void
    {
        ProvisioningLog::query()->create([
            'client_id' => $client?->id,
            'hosting_service_id' => $service?->id,
            'provider' => 'ispconfig_import',
            'action' => 'ispconfig_legacy_import',
            'status' => $status,
            'message' => $message,
            'request_payload' => $payload,
            'finished_at' => now(),
        ]);
    }
}
