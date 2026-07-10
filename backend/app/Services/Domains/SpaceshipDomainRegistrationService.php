<?php

namespace App\Services\Domains;

use App\Models\Domain;
use App\Models\DomainOrder;
use Illuminate\Support\Carbon;
use RuntimeException;
use Throwable;

/**
 * Registers a domain through Spaceship, called only from
 * RegisterDomainWithSpaceshipJob (never at request time — this can take
 * seconds and must never block a checkout response).
 */
class SpaceshipDomainRegistrationService
{
    public function __construct(
        private readonly SpaceshipClient $client,
        private readonly SpaceshipDomainAvailabilityService $availability,
        private readonly SpaceshipDomainContactService $contactService,
    ) {
    }

    /**
     * @return string one of 'registered'|'failed'|'pending' — 'pending' means
     *                the async operation hadn't finished after polling; the
     *                caller (the job) should retry later rather than treat it
     *                as a failure.
     */
    public function register(DomainOrder $domainOrder): string
    {
        $domain = $domainOrder->domain;

        if (! $domain) {
            $domainOrder->forceFill(['status' => 'failed', 'error_message' => 'Domain order has no associated domain record.'])->save();

            return 'failed';
        }

        // Idempotency: a repeated payment webhook or job retry must never
        // register the same domain twice.
        if ($domain->registration_status === 'registered') {
            return 'registered';
        }

        $domainOrder->forceFill(['status' => 'processing'])->save();
        $domain->forceFill(['registration_status' => 'registration_pending'])->save();

        try {
            $contact = $this->contactService->contactFor($domain->client);
        } catch (RuntimeException $exception) {
            return $this->markFailed($domain, $domainOrder, $exception->getMessage());
        }

        // Re-verify right before the real call — it may have been taken by
        // someone else since the client last searched.
        $stillAvailable = (bool) ($this->availability->search($domain->domain_name)['available'] ?? false);

        if (! $stillAvailable) {
            return $this->markFailed($domain, $domainOrder, 'This domain is no longer available.');
        }

        try {
            $contactSet = $this->contactService->contactSetFor($contact);

            $result = $this->client->registerDomain($domain->domain_name, [
                'autoRenew' => $domain->auto_renew,
                'years' => 1,
                'privacyProtection' => ['level' => 'high', 'userConsent' => true],
                'contacts' => $contactSet,
            ]);

            $operationId = $result['operation_id'];
            $status = $operationId ? $this->pollOperation($operationId) : 'success';

            if ($status === 'pending') {
                $domainOrder->forceFill(['provider_reference' => $operationId])->save();

                return 'pending';
            }

            if ($status !== 'success') {
                return $this->markFailed($domain, $domainOrder, 'Spaceship reported the registration did not complete successfully.');
            }

            $expiresAt = $result['raw']['expirationDate'] ?? now()->addYear()->toIso8601String();

            $domain->forceFill([
                'status' => 'active',
                'registration_status' => 'registered',
                'provider_domain_id' => (string) ($result['raw']['domainId'] ?? $result['raw']['id'] ?? ''),
                'registered_at' => now()->toDateString(),
                'expires_at' => Carbon::parse($expiresAt)->toDateString(),
            ])->save();

            $domainOrder->forceFill(['status' => 'completed', 'provider_reference' => $operationId])->save();

            return 'registered';
        } catch (Throwable $exception) {
            return $this->markFailed($domain, $domainOrder, $exception->getMessage());
        }
    }

    private function pollOperation(string $operationId, int $attempts = 5): string
    {
        for ($i = 0; $i < $attempts; $i++) {
            $operation = $this->client->getAsyncOperation($operationId);
            $status = $operation['status'] ?? 'pending';

            if (in_array($status, ['success', 'failed', 'error'], true)) {
                return $status === 'success' ? 'success' : 'failed';
            }

            usleep(300_000);
        }

        return 'pending';
    }

    private function markFailed(Domain $domain, DomainOrder $domainOrder, string $reason): string
    {
        $domain->forceFill(['registration_status' => 'registration_failed'])->save();
        $domainOrder->forceFill(['status' => 'failed', 'error_message' => $reason])->save();

        return 'failed';
    }
}
