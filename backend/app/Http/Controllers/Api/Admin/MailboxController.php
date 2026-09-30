<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HostingService;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\MailboxDiscoveryService;
use Illuminate\Http\Request;

/**
 * Admin tooling for mailboxes created directly in ISPConfig rather than
 * through the client dashboard — those work fine technically, but never
 * appear in the client's "Email Accounts" list, because the periodic sync
 * job only refreshes mailboxes it already knows about; it has no way to
 * discover a new one on its own. `discover()` is that missing step, run on
 * demand so an admin can pull an affected client's ISPConfig-created
 * mailboxes into view without needing to delete and recreate anything a
 * client is already actively using.
 */
class MailboxController extends Controller
{
    public function discover(Request $request, HostingService $service, MailboxDiscoveryService $discovery)
    {
        try {
            $result = $discovery->discover($service);
        } catch (IspConfigApiException $exception) {
            abort(422, $exception->safeMessage());
        }

        if ($result['imported'] > 0) {
            AuditLog::query()->create([
                'staff_user_id' => $request->user()->id,
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'action' => 'discover_mailboxes',
                'reason' => "Imported {$result['imported']} mailbox(es) found in ISPConfig but missing from the client dashboard for {$service->primary_domain}.",
                'source' => 'admin',
                'notify_client' => false,
            ]);
        }

        return response()->json([
            'imported' => $result['imported'],
            'mailboxes' => $result['mailboxes'],
        ]);
    }
}
