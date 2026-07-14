<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * The result of an asynchronous-capable registrar operation (register,
 * renew, transfer, getTransferStatus, setAutoRenew). `status` may be
 * `Completed` immediately (Spaceship's renew is always synchronous) or
 * `Pending`/`Processing` for registrars whose operations complete later —
 * callers must never assume `successful` alone means "finished".
 *
 * @param  array<string, mixed>  $raw  Sanitized (secrets already stripped).
 */
final class DomainOperationResult
{
    public function __construct(
        public readonly bool $successful,
        public readonly DomainOperationStatus $status,
        public readonly ?string $providerOperationId = null,
        public readonly ?\DateTimeImmutable $newExpiresAt = null,
        public readonly ?string $errorMessage = null,
        public readonly array $raw = [],
    ) {}
}
