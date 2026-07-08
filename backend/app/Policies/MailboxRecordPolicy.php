<?php

namespace App\Policies;

use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Models\User;

class MailboxRecordPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        return in_array($user->role, ['super_admin', 'admin_staff'], true) ? true : null;
    }

    public function viewAny(User $user, HostingService $service): bool
    {
        return $this->owns($user, $service);
    }

    public function view(User $user, MailboxRecord $mailbox): bool
    {
        return $this->owns($user, $mailbox->hostingService);
    }

    /**
     * Enforces the plan's max_email_accounts limit — the single place this
     * limit is checked, so every mailbox-creation entry point is covered.
     */
    public function create(User $user, HostingService $service): bool
    {
        if (! $this->owns($user, $service) || $service->status !== 'active') {
            return false;
        }

        $limit = (int) ($service->hostingPlan?->configuration()['max_email_accounts'] ?? 0);

        if ($limit <= 0) {
            return false;
        }

        return $service->mailboxRecords()->where('status', '!=', 'deleted')->count() < $limit;
    }

    public function update(User $user, MailboxRecord $mailbox): bool
    {
        return $this->owns($user, $mailbox->hostingService) && $mailbox->hostingService->status === 'active';
    }

    public function delete(User $user, MailboxRecord $mailbox): bool
    {
        return $this->update($user, $mailbox);
    }

    private function owns(User $user, ?HostingService $service): bool
    {
        return $service && $service->client?->user_id === $user->id;
    }
}
