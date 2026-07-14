<?php

namespace App\Services\Domains\Registrars;

use App\Models\Domain;
use App\Models\DomainOrder;
use App\Notifications\NaiTalkDomainAutoRenewalSuccess;
use App\Services\Domains\Registrars\Data\RegistrarDomainResult;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The single place that reconciles one registrar-reported domain against
 * the local domains table — used by both the cloudflare:sync-domains
 * command (full sync, one page at a time) and SyncCloudflareDomainJob
 * (single-domain refresh), so the "never overwrite customer-owned fields"
 * rule only has to be right in one place.
 */
class CloudflareDomainSyncApplier
{
    public function __construct(private readonly ClientNotifier $notifier = new ClientNotifier) {}

    private const REGISTRAR_CONTROLLED_FIELDS = [
        'provider_status',
        'registered_at',
        'expires_at',
        'provider_domain_id',
        'provider_order_id',
        'provider_cost_minor',
        'provider_currency',
        'provider_metadata',
    ];

    /**
     * @return array{action: 'created'|'updated'|'unchanged'|'skipped_conflict', domain: ?Domain, changes: array<string, mixed>}
     */
    public function apply(RegistrarDomainResult $result, string $provider = 'cloudflare', bool $dryRun = false): array
    {
        return DB::transaction(function () use ($result, $provider, $dryRun) {
            $domainName = DomainNameNormalizer::normalize($result->domainName);

            $existing = Domain::query()
                ->where('provider', $provider)
                ->where('provider_domain_id', $result->providerDomainId)
                ->first();

            if (! $existing) {
                $nameMatch = Domain::query()->where('domain_name', $domainName)->first();

                // A domain_name match under a DIFFERENT existing provider is a
                // genuine conflict (e.g. already Spaceship-registered under a
                // different client) — skip and flag it rather than silently
                // reassigning it to this provider.
                if ($nameMatch && $nameMatch->provider !== $provider) {
                    return ['action' => 'skipped_conflict', 'domain' => $nameMatch, 'changes' => []];
                }

                $existing = $nameMatch;
            }

            $registrarFields = [
                'provider_status' => $result->providerStatus,
                'registered_at' => $result->registeredAt?->format('Y-m-d'),
                'expires_at' => $result->expiresAt?->format('Y-m-d'),
                'provider_domain_id' => $result->providerDomainId,
                'provider_order_id' => $result->providerOrderId,
                'provider_cost_minor' => $result->providerCostMinor,
                'provider_currency' => $result->providerCurrency,
                'provider_metadata' => $result->providerMetadata,
                // Registrar-confirmed auto-renew state — this is also what
                // lets a toggle (setAutoRenew) take local effect: the local
                // column only reflects the registrar's confirmed state once
                // a follow-up sync re-reads it, never optimistically.
                'auto_renew' => $result->autoRenewEnabled,
            ];

            if ($existing) {
                $changes = $this->diff($existing, $registrarFields);
                $previousExpiresAt = $existing->expires_at?->toDateString();

                if (! $dryRun) {
                    $existing->forceFill([...$registrarFields, 'last_synced_at' => now()])->save();
                    $this->maybeFinalizeRenewal($existing, $previousExpiresAt, $registrarFields['expires_at']);
                }

                return ['action' => empty($changes) ? 'unchanged' : 'updated', 'domain' => $existing, 'changes' => $changes];
            }

            $attributes = [
                ...$registrarFields,
                'client_id' => null,
                'domain_name' => $domainName,
                'tld' => $result->tld,
                'source' => 'cloudflare_imported',
                'registration_source' => 'imported',
                'provider' => $provider,
                'status' => 'pending',
                'ownership_assignment_status' => 'needs_review',
                'last_synced_at' => now(),
            ];

            if ($dryRun) {
                return ['action' => 'created', 'domain' => null, 'changes' => $attributes];
            }

            $domain = Domain::query()->create($attributes);

            return ['action' => 'created', 'domain' => $domain, 'changes' => $attributes];
        });
    }

    /**
     * The concrete mechanism for "a renewal is only marked completed after
     * the registrar confirms or the expiration date extends" — a payment
     * being successful is never sufficient on its own. Called on every sync
     * update; a no-op unless this domain actually has a renewal pending
     * registrar confirmation and the registrar's own expiry date just moved
     * forward.
     */
    private function maybeFinalizeRenewal(Domain $domain, ?string $previousExpiresAt, ?string $newExpiresAt): void
    {
        if ($domain->registrar_operation_status !== 'pending' || ! $previousExpiresAt || ! $newExpiresAt) {
            return;
        }

        if ($newExpiresAt <= $previousExpiresAt) {
            return;
        }

        $domainOrder = DomainOrder::query()
            ->where('domain_id', $domain->id)
            ->where('order_type', 'renewal')
            ->where('status', 'pending_payment')
            ->whereHas('invoice', fn ($query) => $query->where('status', 'paid'))
            ->latest()
            ->first();

        if (! $domainOrder) {
            return;
        }

        $domainOrder->forceFill(['status' => 'completed'])->save();
        $domain->forceFill(['registrar_operation_status' => 'completed'])->save();

        $client = $domain->client;

        if (! $client) {
            return;
        }

        $method = $domainOrder->invoice
            ?->payments()
            ->where('status', 'paid')
            ->pluck('gateway')
            ->unique()
            ->reduce(fn (?string $carry, string $gateway) => match (true) {
                $carry === null => $gateway === 'wallet' ? 'wallet' : 'card',
                $carry !== $gateway && $gateway === 'wallet' => 'wallet_and_card',
                $carry !== $gateway => 'wallet_and_card',
                default => $carry,
            }) ?? 'card';

        $this->notifier->notify(
            client: $client,
            notification: new NaiTalkDomainAutoRenewalSuccess($domain->fresh(), $method),
            template: 'domain_auto_renewal_success',
            subject: "Your domain {$domain->domain_name} was renewed successfully",
        );
    }

    /**
     * @param  array<string, mixed>  $registrarFields
     * @return array<string, mixed> only the fields that actually differ
     */
    private function diff(Domain $domain, array $registrarFields): array
    {
        $changes = [];

        foreach ($registrarFields as $field => $newValue) {
            $currentValue = $domain->{$field};

            $currentComparable = $currentValue instanceof Carbon
                ? $currentValue->format('Y-m-d')
                : $currentValue;

            if ($this->normalizeForCompare($currentComparable) !== $this->normalizeForCompare($newValue)) {
                $changes[$field] = ['from' => $currentComparable, 'to' => $newValue];
            }
        }

        return $changes;
    }

    private function normalizeForCompare(mixed $value): string
    {
        if (is_array($value)) {
            return json_encode($value);
        }

        return (string) ($value ?? '');
    }
}
