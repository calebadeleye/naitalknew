<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Called only by the root-run tools on mail.naitalk.com (deploy/naitalk-call),
 * with NAITALK_CALL_SYNC_TOKEN as a Bearer token. The web app never writes
 * the LiveKit config; the server pulls from here.
 */
class NaitalkCallSyncController extends Controller
{
    /** Active managed keys for livekit.yaml, and the webhook routes for the router. */
    public function config(Request $request)
    {
        $this->authorizeServer($request);

        // Revoked keys drop out of livekit.yaml, and their apps' webhooks stop.
        $tenants = NaitalkCallTenant::query()->where('status', 'active')->whereNull('revoked_at')->orderBy('id')->get();

        return response()->json([
            'keys' => $tenants->filter(fn ($t) => $t->keyIsLive())->mapWithKeys(fn ($t) => [$t->api_key => $t->api_secret]),
            'routes' => $tenants->filter(fn ($t) => $t->webhook_url)->values()->map(fn ($t) => [
                'prefix' => $t->room_prefix,
                'url' => $t->webhook_url,
                // Managed tenants get events re-signed with their own key; a
                // "server" tenant gets the original LiveKit signature as-is.
                'api_key' => $t->key_source === 'managed' ? $t->api_key : null,
                'api_secret' => $t->key_source === 'managed' ? $t->api_secret : null,
            ]),
        ]);
    }

    /**
     * sync.mjs --adopt: a key that was set up on the server by hand (Cradle's)
     * becomes Naitalk-managed, with the same key and secret, so the app keeps
     * working and the admin can revoke it.
     */
    public function adopt(Request $request)
    {
        $this->authorizeServer($request);
        $payload = $request->validate([
            'room_prefix' => ['required', 'string', 'exists:naitalk_call_tenants,room_prefix'],
            'api_key' => ['required', 'string', 'max:64', 'regex:/^[A-Za-z0-9_-]+$/', Rule::unique('naitalk_call_tenants', 'api_key')],
            'api_secret' => ['required', 'string', 'max:200', 'regex:/^[A-Za-z0-9_-]+$/'],
        ]);
        $tenant = NaitalkCallTenant::query()->where('room_prefix', $payload['room_prefix'])->sole();
        abort_if($tenant->key_source !== 'server', 409, 'This app already has a Naitalk-managed key.');

        $tenant->forceFill(['key_source' => 'managed', 'api_key' => $payload['api_key'], 'api_secret' => $payload['api_secret'], 'revoked_at' => null])->save();

        return response()->json(['adopted' => $tenant->api_key]);
    }

    /** The sync script reports what it did, for the admin page. */
    public function synced(Request $request)
    {
        $this->authorizeServer($request);

        $payload = $request->validate([
            'status' => ['required', Rule::in(['applied', 'unchanged', 'deferred', 'failed'])],
            'message' => ['nullable', 'string', 'max:500'],
        ]);
        AppSetting::put('naitalk_call_last_sync', [...$payload, 'at' => now()->toIso8601String()]);

        return response()->json(['ok' => true]);
    }

    /**
     * LiveKit webhook events, passed on by the router. Only participant_left
     * is metered: it carries both when the participant joined and left.
     */
    public function events(Request $request)
    {
        $this->authorizeServer($request);

        $event = $request->json()->all();
        $roomName = (string) data_get($event, 'room.name', '');
        $joinedAt = (int) data_get($event, 'participant.joinedAt', 0);
        $leftAt = (int) data_get($event, 'createdAt', 0);

        if (data_get($event, 'event') !== 'participant_left' || ! data_get($event, 'id') || $joinedAt <= 0 || $leftAt < $joinedAt) {
            return response()->json(['recorded' => false], 202);
        }

        $tenant = NaitalkCallTenant::forRoom($roomName);
        if (! $tenant) {
            return response()->json(['recorded' => false], 202);
        }

        NaitalkCallUsageEvent::query()->firstOrCreate(['event_id' => (string) data_get($event, 'id')], [
            'tenant_id' => $tenant->id,
            'room_name' => $roomName,
            'participant_identity' => data_get($event, 'participant.identity'),
            'seconds' => $leftAt - $joinedAt,
            'left_at' => Carbon::createFromTimestamp($leftAt),
        ]);

        return response()->json(['recorded' => true]);
    }

    private function authorizeServer(Request $request): void
    {
        $expected = (string) config('naitalk_call.sync_token');

        abort_if($expected === '' || ! hash_equals($expected, (string) $request->bearerToken()), 401, 'Unauthorized.');
    }
}
