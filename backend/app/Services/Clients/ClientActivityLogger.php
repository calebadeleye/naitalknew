<?php

namespace App\Services\Clients;

use App\Models\Client;
use App\Models\ClientActivityLog;
use Illuminate\Http\Request;

/**
 * Records real, client-visible security/account events for the "Account
 * Activity" feed on the My Profile page. This is deliberately separate from
 * AuditLog, which is a staff/system audit trail with admin-facing fields
 * (reason_category, ispconfig_response, etc.) that shouldn't leak into the
 * client portal.
 */
class ClientActivityLogger
{
    public function log(Client $client, string $type, string $description, ?Request $request = null): void
    {
        ClientActivityLog::query()->create([
            'client_id' => $client->id,
            'type' => $type,
            'description' => $description,
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'created_at' => now(),
        ]);
    }
}
