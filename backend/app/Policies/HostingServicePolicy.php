<?php

namespace App\Policies;

use App\Models\HostingService;
use App\Models\User;

class HostingServicePolicy
{
    public function before(User $user, string $ability): ?bool
    {
        return in_array($user->role, ['super_admin', 'admin_staff'], true) ? true : null;
    }

    public function view(User $user, HostingService $service): bool
    {
        return $service->client?->user_id === $user->id;
    }

    public function manage(User $user, HostingService $service): bool
    {
        return $this->view($user, $service) && $service->status === 'active';
    }
}
