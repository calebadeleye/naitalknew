<?php

namespace App\Services\Domains\Registrars\Data;

/**
 * One page of listRegistrations() results — pagination-agnostic wrapper so
 * callers (the sync command/job) never need to know whether the underlying
 * registrar uses cursor- or offset-based paging.
 *
 * @param  array<int, RegistrarDomainResult>  $items
 */
final class RegistrarRegistrationPage
{
    public function __construct(
        public readonly array $items,
        public readonly ?string $nextCursor,
        public readonly bool $hasMore,
        public readonly ?int $totalCount = null,
    ) {}
}
