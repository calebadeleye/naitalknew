<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\ApplyIpBlocksJob;
use App\Models\AuditLog;
use App\Services\Ispconfig\IpBlockList;
use Illuminate\Http\Request;

/** Admin: addresses blocked on EVERY website (e.g. an attacker hitting many sites). */
class BlockedIpsController extends Controller
{
    public function index()
    {
        return response()->json(['blocked_ips' => IpBlockList::global(), 'your_ip' => request()->ip()]);
    }

    public function store(Request $request)
    {
        $payload = $request->validate(['ip' => ['required', 'string', 'max:64'], 'note' => ['nullable', 'string', 'max:120']]);
        $ip = IpBlockList::normalize($payload['ip']);

        IpBlockList::saveGlobal(IpBlockList::withEntry(IpBlockList::global(), $ip, $payload['note'] ?? null, 'admin'));
        $this->audit($request, 'block_ip_all_websites', $ip);
        ApplyIpBlocksJob::dispatch();

        return $this->index();
    }

    public function destroy(Request $request)
    {
        $payload = $request->validate(['ip' => ['required', 'string', 'max:64']]);

        IpBlockList::saveGlobal(IpBlockList::withoutEntry(IpBlockList::global(), $payload['ip']));
        $this->audit($request, 'unblock_ip_all_websites', $payload['ip']);
        ApplyIpBlocksJob::dispatch();

        return $this->index();
    }

    private function audit(Request $request, string $action, string $ip): void
    {
        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'action' => $action,
            'reason' => "{$ip} on all websites.",
            'after_state' => ['ip' => $ip],
            'source' => 'admin',
            'notify_client' => false,
        ]);
    }
}
