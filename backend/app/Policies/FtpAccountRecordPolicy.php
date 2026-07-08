<?php

namespace App\Policies;

use App\Models\FtpAccountRecord;
use App\Models\HostingService;
use App\Models\User;

class FtpAccountRecordPolicy
{
    public function before(User $user, string $ability): ?bool
    {
        return in_array($user->role, ['super_admin', 'admin_staff'], true) ? true : null;
    }

    public function viewAny(User $user, HostingService $service): bool
    {
        return $this->owns($user, $service);
    }

    public function view(User $user, FtpAccountRecord $ftpAccount): bool
    {
        return $this->owns($user, $ftpAccount->hostingService);
    }

    /**
     * Enforces the plan's max_ftp_accounts limit and whether FTP/SFTP is
     * even enabled for the plan.
     */
    public function create(User $user, HostingService $service): bool
    {
        if (! $this->owns($user, $service) || $service->status !== 'active') {
            return false;
        }

        $configuration = $service->hostingPlan?->configuration() ?? [];

        if (! ($configuration['sftp_access_enabled'] ?? false) && ! ($configuration['ssh_access_enabled'] ?? false)) {
            return false;
        }

        $limit = (int) ($configuration['max_ftp_accounts'] ?? 0);

        if ($limit <= 0) {
            return false;
        }

        return $service->ftpAccountRecords()->where('status', '!=', 'deleted')->count() < $limit;
    }

    public function update(User $user, FtpAccountRecord $ftpAccount): bool
    {
        return $this->owns($user, $ftpAccount->hostingService) && $ftpAccount->hostingService->status === 'active';
    }

    public function delete(User $user, FtpAccountRecord $ftpAccount): bool
    {
        return $this->update($user, $ftpAccount);
    }

    private function owns(User $user, ?HostingService $service): bool
    {
        return $service && $service->client?->user_id === $user->id;
    }
}
