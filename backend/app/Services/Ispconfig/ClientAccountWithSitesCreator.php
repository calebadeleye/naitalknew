<?php

namespace App\Services\Ispconfig;

use App\Models\Client;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\IspConfigClientMapping;
use App\Models\IspConfigServiceMapping;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Creates a login (user + client) for an owner and attaches websites that
 * already exist in ISPConfig to it as hosting services, then moves them onto
 * a Website Care package like every other legacy site. For sites that sit
 * under an ISPConfig client that belongs to a different NAI TALK account —
 * the ISPConfig side is left untouched, only ownership on our side differs.
 */
class ClientAccountWithSitesCreator
{
    public function __construct(
        private readonly IspConfigClient $ispConfig,
        private readonly LegacyServiceMigrator $migrator,
    ) {}

    /**
     * @param  array<int, string>  $domains  exact ISPConfig website domains
     * @return array{client: Client, user: User, services: array<int, array<string, mixed>>}
     */
    public function create(
        string $email,
        string $password,
        string $name,
        ?string $company,
        int $ispconfigClientId,
        array $domains,
        string $packageSlug = 'starter-website-care',
    ): array {
        if (User::query()->where('email', $email)->exists()) {
            throw new RuntimeException("A login for {$email} already exists.");
        }

        $legacyPlan = HostingPlan::query()->where('slug', 'legacy-hosting-ssl')->firstOrFail();
        $target = HostingPlan::query()->where('slug', $packageSlug)->where('is_active', true)->firstOrFail();
        $serverId = (int) config('ispconfig.server_id', 1);

        $sessionId = $this->ispConfig->login();

        try {
            $ownedSites = collect($this->ispConfig->quotaGetByUser($sessionId, $ispconfigClientId))->keyBy(fn (array $row) => (string) $row['domain']);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        $sites = [];

        foreach ($domains as $domain) {
            $site = $ownedSites->get($domain);

            if (! $site) {
                throw new RuntimeException("{$domain} is not a website of ISPConfig client {$ispconfigClientId}.");
            }

            if (IspConfigServiceMapping::query()->where('ispconfig_server_id', $serverId)->where('ispconfig_website_id', (string) $site['domain_id'])->exists()) {
                throw new RuntimeException("{$domain} is already attached to a hosting service.");
            }

            $sites[] = $site;
        }

        [$user, $client, $services] = DB::transaction(function () use ($email, $password, $name, $company, $ispconfigClientId, $sites, $legacyPlan, $serverId) {
            $user = User::query()->create([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'role' => 'client',
                // Email stays unverified on purpose: the owner confirms it with
                // the code we email on first login, which is what stops anyone
                // who merely guesses the initial password.
                'account_status' => 'active',
            ]);

            $client = Client::query()->create([
                'user_id' => $user->id,
                'client_code' => 'CLT-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'company_name' => $company,
                'account_type' => 'imported_legacy_client',
                'client_status' => 'active',
                'status' => 'active',
                'billing_email' => $email,
                'country' => 'Nigeria',
                'last_activity_at' => now(),
                'metadata' => ['import_source' => 'ispconfig_import', 'created_by' => 'admin_command'],
            ]);

            $clientMapping = IspConfigClientMapping::query()->create([
                'client_id' => $client->id,
                'ispconfig_server_id' => $serverId,
                'ispconfig_client_id' => (string) $ispconfigClientId,
                'sync_status' => 'provisioned',
                'provisioned_at' => now(),
                'last_synced_at' => now(),
                'metadata_json' => ['import_source' => 'ispconfig_import', 'invite_status' => 'not_sent'],
            ]);

            $services = [];

            foreach ($sites as $site) {
                $createdAt = LegacyRenewalDateCalculator::extractCreationDate($site);
                $renewalDate = $createdAt ? LegacyRenewalDateCalculator::nextAnniversary($createdAt, now()) : null;

                $service = HostingService::query()->create([
                    'client_id' => $client->id,
                    'hosting_plan_id' => $legacyPlan->id,
                    'service_number' => 'SRV-LEGACY-'.Str::upper(Str::random(10)),
                    'display_name' => $site['domain'],
                    'primary_domain' => $site['domain'],
                    'status' => 'active',
                    'billing_cycle' => 'yearly',
                    'amount_kobo' => ($legacyPlan->hosting_amount_kobo ?? 0) + ($legacyPlan->ssl_amount_kobo ?? 0),
                    'auto_renew_enabled' => true,
                    'provisioning_status' => 'imported_existing',
                    'source' => 'ispconfig_import',
                    'plan_type' => 'legacy',
                    'migration_status' => 'legacy',
                    'imported_at' => now(),
                    'last_synced_at' => now(),
                    'created_from_ispconfig_at' => $createdAt,
                    'renewal_date_source' => $renewalDate ? 'ispconfig_created_date' : 'manual_required',
                    'renewal_status' => $renewalDate ? null : 'pending_manual_renewal_date',
                    'hosting_expires_at' => $renewalDate,
                    'ssl_expires_at' => $renewalDate,
                    'next_invoice_date' => $renewalDate,
                    'renews_at' => $renewalDate,
                    'next_due_date' => $renewalDate,
                ]);

                IspConfigServiceMapping::query()->create([
                    'hosting_service_id' => $service->id,
                    'ispconfig_server_id' => $serverId,
                    'ispconfig_client_mapping_id' => $clientMapping->id,
                    'ispconfig_website_id' => (string) $site['domain_id'],
                    'technical_status' => 'active',
                    'last_synced_at' => now(),
                    'metadata_json' => ['import_source' => 'ispconfig_import'],
                ]);

                $services[] = $service;
            }

            return [$user, $client, $services];
        });

        $results = [];

        foreach ($services as $service) {
            $result = $this->migrator->migrate($service->fresh(), $target, null, "New account for {$email}");
            $results[] = ['service' => $service->fresh(), 'result' => $result];
        }

        return ['client' => $client, 'user' => $user, 'services' => $results];
    }
}
