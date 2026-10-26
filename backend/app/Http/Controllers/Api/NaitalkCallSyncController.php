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

        $tenants = NaitalkCallTenant::query()->where('status', 'active')->orderBy('id')->get();

        return response()->json([
            'keys' => $tenants->where('key_source', 'managed')->filter(fn ($t) => $t->api_key && $t->api_secret)
                ->mapWithKeys(fn ($t) => [$t->api_key => $t->api_secret]),
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
