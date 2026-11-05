<?php

namespace App\Services\Ispconfig;

use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use Illuminate\Support\Str;

/**
 * Finds mailboxes that exist in ISPConfig for a hosting service's domain but
 * have no local MailboxRecord — the case for anything created directly in
 * ISPConfig's own panel rather than through the client dashboard. Those
 * mailboxes work fine technically, but are invisible on the client side
 * because SyncMailboxesJob only refreshes records it already knows about; it
 * has no discovery step. This service is that missing discovery step, run
 * on demand by an admin rather than automatically, so an admin can review
 * what a client already has in ISPConfig before it starts showing up in
 * their dashboard.
 */
class MailboxDiscoveryService
{
    public function __construct(private readonly IspConfigClient $ispConfig) {}

    /**
     * @return array{imported: int, mailboxes: array<int, MailboxRecord>}
     */
    public function discover(HostingService $service): array
    {
        $mapping = $service->ispConfigServiceMappings()->with('clientMapping')->latest('id')->first();

        if (! $mapping?->clientMapping?->ispconfig_client_id) {
            throw new IspConfigApiException('This service is not provisioned in ISPConfig yet.', ['hosting_service_id' => $service->id]);
        }

        $domain = Str::lower((string) $service->primary_domain);
        $sessionId = $this->ispConfig->login();

        try {
            // By address, not by the client's ISPConfig group: mail domains are
            // often owned by a different ISPConfig account than the website, and
            // those mailboxes never came back when filtered by group.
            $remoteMailUsers = $this->ispConfig->mailUserList($sessionId, ['email' => '%@'.$domain]);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        // Across every service: one parked on the wrong service is moved by
        // MailboxReconciler, not listed twice.
        $existingEmails = MailboxRecord::query()
            ->pluck('email_address')
            ->map(fn ($email) => Str::lower($email))
            ->all();

        $imported = [];

        foreach ($remoteMailUsers as $remote) {
            $email = Str::lower((string) ($remote['email'] ?? ''));

            if ($email === '' || ! Str::endsWith($email, '@'.$domain)) {
                continue;
            }

            if (in_array($email, $existingEmails, true)) {
                continue;
            }

            $imported[] = MailboxRecord::query()->create([
                'hosting_service_id' => $service->id,
                'ispconfig_mailbox_id' => (string) ($remote['mailuser_id'] ?? ''),
                'email_address' => $email,
                'display_name' => $remote['name'] ?: null,
                'quota_mb' => MailboxQuota::toMb($remote['quota'] ?? 0),
                'status' => ($remote['postfix'] ?? 'y') === 'y' ? 'active' : 'disabled',
                'source' => 'ispconfig_import',
                'imported_at' => now(),
                'last_synced_at' => now(),
            ]);

            // Guard against the same address appearing twice in one ISPConfig
            // response being imported twice in this same pass.
            $existingEmails[] = $email;
        }

        return ['imported' => count($imported), 'mailboxes' => $imported];
    }
}
