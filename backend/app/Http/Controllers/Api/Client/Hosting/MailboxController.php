<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Jobs\MailboxProvisioningActionJob;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use Illuminate\Http\Request;

class MailboxController extends Controller
{
    public function index(Request $request, HostingService $service)
    {
        $this->authorize('viewAny', [MailboxRecord::class, $service]);

        return response()->json([
            'mailboxes' => $service->mailboxRecords()->get(),
            'limit' => (int) ($service->hostingPlan?->configuration()['max_email_accounts'] ?? 0),
        ]);
    }

    public function store(Request $request, HostingService $service)
    {
        $this->authorize('create', [MailboxRecord::class, $service]);

        $payload = $request->validate([
            'username' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9._-]+$/'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'quota_mb' => ['nullable', 'integer', 'min:1'],
            'password' => ['required', 'string', 'min:10', 'max:255'],
        ]);

        $emailAddress = $payload['username'].'@'.$service->primary_domain;

        abort_if(
            MailboxRecord::query()->where('hosting_service_id', $service->id)->where('email_address', $emailAddress)->exists(),
            422,
            'An email account with this address already exists.',
        );

        $mailbox = MailboxRecord::query()->create([
            'hosting_service_id' => $service->id,
            'email_address' => $emailAddress,
            'display_name' => $payload['display_name'] ?? null,
            'quota_mb' => $payload['quota_mb'] ?? 0,
            'status' => 'provisioning',
        ]);

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'create', ['password' => $payload['password']]);

        return response()->json($mailbox, 202);
    }

    public function update(Request $request, HostingService $service, MailboxRecord $mailbox)
    {
        $this->authorize('update', $mailbox);
        abort_if($mailbox->hosting_service_id !== $service->id, 404);

        $payload = $request->validate([
            'display_name' => ['nullable', 'string', 'max:255'],
            'quota_mb' => ['nullable', 'integer', 'min:1'],
        ]);

        $mailbox->forceFill(['status' => 'provisioning'])->save();

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'update', $payload);

        return response()->json($mailbox->fresh(), 202);
    }

    public function changePassword(Request $request, HostingService $service, MailboxRecord $mailbox)
    {
        $this->authorize('update', $mailbox);
        abort_if($mailbox->hosting_service_id !== $service->id, 404);

        $payload = $request->validate([
            'password' => ['required', 'string', 'min:10', 'max:255', 'confirmed'],
        ]);

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'update', ['password' => $payload['password']]);

        return response()->json(['message' => 'Password change requested.'], 202);
    }

    public function suspend(Request $request, HostingService $service, MailboxRecord $mailbox)
    {
        $this->authorize('update', $mailbox);
        abort_if($mailbox->hosting_service_id !== $service->id, 404);

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'suspend');

        return response()->json(['message' => 'Mailbox suspend requested.'], 202);
    }

    public function resume(Request $request, HostingService $service, MailboxRecord $mailbox)
    {
        $this->authorize('update', $mailbox);
        abort_if($mailbox->hosting_service_id !== $service->id, 404);

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'resume');

        return response()->json(['message' => 'Mailbox resume requested.'], 202);
    }

    public function destroy(Request $request, HostingService $service, MailboxRecord $mailbox)
    {
        $this->authorize('delete', $mailbox);
        abort_if($mailbox->hosting_service_id !== $service->id, 404);

        $payload = $request->validate(['confirm' => ['required', 'accepted']]);

        $mailbox->forceFill(['status' => 'provisioning'])->save();

        MailboxProvisioningActionJob::dispatch($mailbox->id, 'delete');

        return response()->json(['message' => 'Mailbox deletion requested.'], 202);
    }
}
