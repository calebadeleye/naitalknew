<?php

namespace App\Services\Email;

use App\Models\Domain;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Services\Ispconfig\IspConfigClient;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Email-only plans: Green Mail business email on a domain whose website (if
 * any) is elsewhere. The domain may be registered with us or anywhere else;
 * either way the client's DNS needs our MX, SPF and DKIM records before
 * mail flows — these are the records, the check, and the DKIM keys.
 */
class BusinessEmail
{
    /** Statuses after which a service no longer holds its domain's email. */
    private const ENDED = ['cancelled', 'terminated', 'deleted', 'deleted_from_ispconfig'];

    public function __construct(private readonly IspConfigClient $ispConfig)
    {
    }

    /**
     * An email plan can't be added to a domain that already has email with us
     * (every website plan includes it, and ISPConfig allows one mail domain each).
     *
     * @throws ValidationException
     */
    public function ensureDomainCanHaveEmailPlan(HostingPlan $plan, string $domain, string $field = 'primary_domain'): void
    {
        if ($message = $this->emailPlanConflict($plan, $domain)) {
            throw ValidationException::withMessages([$field => $message]);
        }
    }

    /** Why this plan can't be ordered for this domain, or null when it can. */
    public function emailPlanConflict(HostingPlan $plan, string $domain): ?string
    {
        if (! $plan->isEmailOnly()) {
            return null;
        }

        $existing = HostingService::query()
            ->with('hostingPlan')
            ->where('primary_domain', strtolower($domain))
            ->whereNotIn('status', self::ENDED)
            ->get()
            ->first(fn (HostingService $service) => ($service->hostingPlan?->configuration()['max_email_accounts'] ?? 0) > 0);

        if (! $existing) {
            return null;
        }

        return $existing->isEmailOnly()
            ? "{$domain} already has a business email plan with us."
            : "{$domain} already has business email included in its website plan — no need for a separate email plan. Add mailboxes from the website's Email Accounts tab.";
    }

    /** A fresh 2048-bit DKIM key pair, PEM encoded, as ISPConfig stores them. */
    public function newDkimKeys(): array
    {
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($key, $private);

        return ['private' => $private, 'public' => openssl_pkey_get_details($key)['key']];
    }

    /** True when the domain was registered or transferred through us (so our team can add the records). */
    public function domainIsWithUs(HostingService $service): bool
    {
        $domain = Domain::query()
            ->where('client_id', $service->client_id)
            ->where('domain_name', $service->primary_domain)
            ->first();

        return $domain !== null && $domain->source !== 'external';
    }

    /**
     * The DNS records the domain needs, in the order to add them.
     *
     * @return array<int, array{key: string, type: string, host: string, value: string, priority: ?int, required: bool, purpose: string}>
     */
    public function dnsRecords(HostingService $service): array
    {
        $domain = $service->primary_domain;
        $selector = config('ispconfig.dkim_selector', 'default');
        $records = [
            [
                'key' => 'mx', 'type' => 'MX', 'host' => '@', 'value' => config('ispconfig.mail_hostname'), 'priority' => 10, 'required' => true,
                'purpose' => 'Delivers your email to us. Remove any other MX records for this domain.',
            ],
            [
                'key' => 'spf', 'type' => 'TXT', 'host' => '@', 'value' => config('ispconfig.mail_spf'), 'priority' => null, 'required' => true,
                'purpose' => 'Lets our server send email for your domain. A domain can only have one SPF record — if you already have one (it starts with "v=spf1"), add "a:'.config('ispconfig.mail_hostname').'" to it instead.',
            ],
        ];

        if ($dkim = $this->dkimPublicValue($service)) {
            $records[] = [
                'key' => 'dkim', 'type' => 'TXT', 'host' => "{$selector}._domainkey", 'value' => "v=DKIM1; t=s; p={$dkim}", 'priority' => null, 'required' => true,
                'purpose' => 'Signs the email you send, so it lands in inboxes instead of spam.',
            ];
        }

        $records[] = [
            'key' => 'dmarc', 'type' => 'TXT', 'host' => '_dmarc', 'value' => 'v=DMARC1; p=none', 'priority' => null, 'required' => false,
            'purpose' => 'Recommended. Tells other mail servers how to treat mail that fails the checks above. Skip it if '.$domain.' already has a DMARC record.',
        ];

        return $records;
    }

    /**
     * Looks the records up in public DNS.
     *
     * @return array<string, string> record key => ok | missing | different
     */
    public function checkDns(HostingService $service): array
    {
        $domain = $service->primary_domain;
        $mailHost = strtolower((string) config('ispconfig.mail_hostname'));
        $results = [];

        foreach ($this->dnsRecords($service) as $record) {
            $name = $record['host'] === '@' ? $domain : "{$record['host']}.{$domain}";

            if ($record['type'] === 'MX') {
                $targets = array_map(fn ($r) => strtolower(rtrim($r['target'] ?? '', '.')), $this->lookup($name, DNS_MX));
                $results[$record['key']] = ! $targets ? 'missing' : ($targets === [$mailHost] || (in_array($mailHost, $targets, true) && count(array_unique($targets)) === 1) ? 'ok' : 'different');

                continue;
            }

            $texts = array_map(fn ($r) => (string) ($r['txt'] ?? implode('', $r['entries'] ?? [])), $this->lookup($name, DNS_TXT));

            $results[$record['key']] = match ($record['key']) {
                'spf' => $this->spfStatus($texts, $mailHost, $service),
                'dkim' => $this->compact($texts) !== [] && in_array($this->compact([$record['value']])[0], $this->compact($texts), true) ? 'ok' : ($texts ? 'different' : 'missing'),
                default => collect($texts)->contains(fn ($t) => str_starts_with(strtolower(trim($t)), 'v=dmarc1')) ? 'ok' : 'missing',
            };
        }

        return $results;
    }

    /** IMAP/SMTP settings for phone and desktop mail apps, and the webmail address. */
    public function mailSettings(HostingService $service): array
    {
        $host = config('ispconfig.mail_hostname');

        return [
            'incoming' => ['protocol' => 'IMAP', 'host' => $host, 'port' => 993, 'security' => 'SSL/TLS'],
            'outgoing' => ['protocol' => 'SMTP', 'host' => $host, 'port' => 465, 'security' => 'SSL/TLS', 'alternative_port' => 587, 'alternative_security' => 'STARTTLS'],
            'username' => 'Your full email address',
            'webmail_url' => rtrim((string) config('app.frontend_url'), '/').'/greenmail?domain='.rawurlencode($service->primary_domain),
        ];
    }

    /** The DKIM public key as it goes in DNS (base64, no PEM armour), or null when the domain has none. */
    private function dkimPublicValue(HostingService $service): ?string
    {
        $mapping = $service->ispConfigServiceMappings()->latest('id')->first();

        if (! $mapping) {
            return null;
        }

        $pem = $mapping->metadata_json['dkim_public'] ?? null;

        // Mail domains made before this flow (or in ISPConfig directly): read the key once and keep it.
        if (! $pem && $mapping->ispconfig_mail_domain_id) {
            try {
                $sessionId = $this->ispConfig->login();

                try {
                    $remote = $this->ispConfig->mailDomainGet($sessionId, (int) $mapping->ispconfig_mail_domain_id) ?? [];
                } finally {
                    $this->ispConfig->logout($sessionId);
                }

                if (($remote['dkim'] ?? 'n') === 'y' && ! empty($remote['dkim_public'])) {
                    $pem = (string) $remote['dkim_public'];
                    $mapping->forceFill(['metadata_json' => array_merge($mapping->metadata_json ?? [], ['dkim_public' => $pem])])->save();
                }
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        if (! $pem) {
            return null;
        }

        return preg_replace('/-----[^-]+-----|\s+/', '', $pem) ?: null;
    }

    private function spfStatus(array $texts, string $mailHost, HostingService $service): string
    {
        $spf = collect($texts)->first(fn ($t) => str_starts_with(strtolower(trim($t)), 'v=spf1'));

        if (! $spf) {
            return 'missing';
        }

        $spf = strtolower($spf);
        $ourIp = gethostbyname($mailHost);

        return str_contains($spf, "a:{$mailHost}") || str_contains($spf, "ip4:{$ourIp}") || str_contains($spf, 'include:'.$mailHost)
            || (preg_match('/(^|\s)[+]?mx(\s|$)/', $spf) && collect($this->lookup($service->primary_domain, DNS_MX))->contains(fn ($r) => strtolower(rtrim($r['target'] ?? '', '.')) === $mailHost))
            ? 'ok' : 'different';
    }

    /** @return array<int, string> */
    private function compact(array $texts): array
    {
        return array_values(array_map(fn ($t) => preg_replace('/\s+/', '', (string) $t), $texts));
    }

    /** @return array<int, array<string, mixed>> */
    protected function lookup(string $name, int $type): array
    {
        return @dns_get_record($name, $type) ?: [];
    }
}
