<?php

namespace App\Services\Ispconfig;

use App\Models\EmailDomainRecord;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Models\ProvisioningLog;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Keeps the client area's mailbox list in step with ISPConfig, going by the
 * one thing that says whose a mailbox is: its domain. ISPConfig ownership
 * can't be trusted for this, because mail domains were often set up by hand
 * under a different ISPConfig account than the website.
 *
 * - A record on a service for another domain moves to that domain's service.
 * - A mailbox in ISPConfig with no record gets one on its domain's service.
 * - With no single service for the domain nothing changes; it is reported,
 *   because guessing would show someone's email to the wrong client.
 *
 * Only local records are written. ISPConfig is only read.
 */
class MailboxReconciler
{
    private const ENDED_STATUSES = ['cancelled', 'terminated', 'deleted'];

    public function __construct(private readonly IspConfigClient $ispConfig) {}

    /**
     * @return array{moved: array<string, int>, imported: array<string, int>, domains_moved: array<string, int>, unmatched: array<string, int>}
     */
    public function run(bool $dryRun = false): array
    {
        $sessionId = $this->ispConfig->login();

        try {
            $remoteMailUsers = $this->ispConfig->mailUserList($sessionId, []);
        } finally {
            $this->ispConfig->logout($sessionId);
        }

        $services = $this->servicesByDomain();
        $report = ['moved' => [], 'imported' => [], 'domains_moved' => [], 'unmatched' => []];

        foreach (MailboxRecord::query()->with('hostingService')->get() as $record) {
            $domain = $this->domainOf($record->email_address);

            if ($domain === Str::lower((string) $record->hostingService?->primary_domain)) {
                continue;
            }

            $target = $services->get($domain);

            if (! $target) {
                $report['unmatched'][$domain] = ($report['unmatched'][$domain] ?? 0) + 1;

                continue;
            }

            $report['moved'][$domain] = ($report['moved'][$domain] ?? 0) + 1;

            if (! $dryRun) {
                $from = $record->hosting_service_id;
                $record->forceFill(['hosting_service_id' => $target->id, 'last_synced_at' => now()])->save();
                $this->log($target, 'moved_mailbox', "Mailbox for {$domain} moved from service {$from} to the domain's own service.", ['from_service' => $from, 'mailbox_record' => $record->id]);
            }
        }

        foreach (EmailDomainRecord::query()->with('hostingService')->get() as $record) {
            $domain = Str::lower((string) $record->domain);
            $target = $services->get($domain);

            if (! $target || $target->id === $record->hosting_service_id) {
                continue;
            }

            $report['domains_moved'][$domain] = 1;

            if (! $dryRun) {
                // The domain's own service may already list it.
                if (EmailDomainRecord::query()->where('hosting_service_id', $target->id)->where('domain', $record->domain)->exists()) {
                    $record->delete();
                } else {
                    $record->forceFill(['hosting_service_id' => $target->id, 'last_synced_at' => now()])->save();
                }
            }
        }

        $known = MailboxRecord::query()->pluck('email_address')->map(fn ($email) => Str::lower($email))->flip();

        foreach ($remoteMailUsers as $remote) {
            $email = Str::lower(trim((string) ($remote['email'] ?? '')));

            if ($email === '' || isset($known[$email])) {
                continue;
            }

            $domain = $this->domainOf($email);
            $target = $services->get($domain);

            if (! $target) {
                $report['unmatched'][$domain] = ($report['unmatched'][$domain] ?? 0) + 1;

                continue;
            }

            $report['imported'][$domain] = ($report['imported'][$domain] ?? 0) + 1;
            $known[$email] = true;

            if (! $dryRun) {
                $record = MailboxRecord::query()->create([
                    'hosting_service_id' => $target->id,
                    'ispconfig_mailbox_id' => (string) ($remote['mailuser_id'] ?? ''),
                    'email_address' => $email,
                    'display_name' => ($remote['name'] ?? null) ?: null,
                    'quota_mb' => MailboxQuota::toMb($remote['quota'] ?? 0),
                    'status' => ($remote['postfix'] ?? 'y') === 'y' ? 'active' : 'disabled',
                    'source' => 'ispconfig_import',
                    'imported_at' => now(),
                    'last_synced_at' => now(),
                ]);
                $this->log($target, 'imported_mailbox', "Mailbox for {$domain} found in ISPConfig and added.", ['mailbox_record' => $record->id]);
            }
        }

        return $report;
    }

    /** The one live service for each domain; a domain with several is left out rather than guessed. */
    private function servicesByDomain(): Collection
    {
        return HostingService::query()
            ->whereNotNull('primary_domain')
            ->whereNotIn('status', self::ENDED_STATUSES)
            ->get()
            ->groupBy(fn (HostingService $service) => Str::lower($service->primary_domain))
            ->filter(fn (Collection $group) => $group->count() === 1)
            ->map(fn (Collection $group) => $group->first());
    }

    private function domainOf(string $email): string
    {
        return Str::lower(Str::afterLast($email, '@'));
    }

    private function log(HostingService $service, string $status, string $message, array $payload): void
    {
        ProvisioningLog::query()->create([
            'client_id' => $service->client_id,
            'hosting_service_id' => $service->id,
            'provider' => 'ispconfig_import',
            'action' => 'mailbox_reconcile',
            'status' => $status,
            'message' => $message,
            'request_payload' => $payload,
            'finished_at' => now(),
        ]);
    }
}
