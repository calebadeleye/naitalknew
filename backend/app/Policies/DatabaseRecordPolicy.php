<?php

namespace App\Policies;

use App\Models\DatabaseRecord;
use App\Models\HostingService;
use App\Models\User;

class DatabaseRecordPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        return in_array($user->role, ['super_admin', 'admin_staff'], true) ? true : null;
    }

    public function viewAny(User $user, HostingService $service): bool
    {
        return $this->owns($user, $service);
    }

    public function view(User $user, DatabaseRecord $database): bool
    {
        return $this->owns($user, $database->hostingService);
    }

    /**
     * Enforces the plan's max_databases limit.
     */
    public function create(User $user, HostingService $service): bool
    {
        if (! $this->owns($user, $service) || $service->status !== 'active') {
            return false;
        }

        $limit = (int) ($service->hostingPlan?->configuration()['max_databases'] ?? 0);

        if ($limit <= 0) {
            return false;
        }

        return $service->databaseRecords()->where('status', '!=', 'deleted')->count() < $limit;
    }

    public function update(User $user, DatabaseRecord $database): bool
    {
        return $this->owns($user, $database->hostingService) && $database->hostingService->status === 'active';
    }

    public function delete(User $user, DatabaseRecord $database): bool
    {
        return $this->update($user, $database);
    }

    private function owns(User $user, ?HostingService $service): bool
    {
        return $service && $service->client?->user_id === $user->id;
    }
}
