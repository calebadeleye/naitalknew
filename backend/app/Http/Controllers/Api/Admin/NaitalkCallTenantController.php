<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Client;
use App\Models\AuditLog;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use App\Services\Billing\Money;
use App\Services\NaitalkCall\CbnExchangeRate;
use App\Services\NaitalkCall\NaitalkCallPricing;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Onboarding businesses onto Naitalk Call. This only records them and makes
 * their keys: the root-run sync script on mail.naitalk.com pulls active keys
 * from the internal API and writes them into the LiveKit config itself.
 */
class NaitalkCallTenantController extends Controller
{
    private const AUDITED_FIELDS = ['business_name', 'contact_email', 'plan', 'monthly_price_usd_cents', 'status', 'room_prefix', 'webhook_url', 'client_id'];

    public function __construct(private readonly NaitalkCallPricing $pricing) {}

    public function index()
    {
        $monthStart = now()->startOfMonth();
        $seconds = NaitalkCallUsageEvent::query()
            ->where('left_at', '>=', $monthStart)
            ->groupBy('tenant_id')
            ->selectRaw('tenant_id, SUM(seconds) as total')
            ->pluck('total', 'tenant_id');

        return response()->json([
            'data' => NaitalkCallTenant::query()->with('client.user:id,name,email')->orderBy('business_name')->get()
                ->map(fn (NaitalkCallTenant $tenant) => $this->serialize($tenant, (int) ($seconds[$tenant->id] ?? 0))),
            'plans' => array_map(fn (array $plan) => [...$plan, 'monthly_ngn' => $plan['monthly_ngn_kobo'] === null ? null : Money::naira($plan['monthly_ngn_kobo'])], $this->pricing->plans()),
            'exchange_rate' => $this->pricing->exchangeRate(),
            'public_url' => config('naitalk_call.public_url'),
            'last_sync' => AppSetting::get('naitalk_call_last_sync'),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validated($request);
        $tenant = NaitalkCallTenant::query()->create(['plan' => config('naitalk_call.default_plan'), ...$payload]);
        $secret = $tenant->issueKey();
        $this->audit($request, 'naitalk_call_tenant_created', "Onboarded {$tenant->business_name} onto Naitalk Call.", null, $tenant);

        return response()->json(['data' => $this->serialize($tenant->refresh()), 'api_secret' => $secret], 201);
    }

    public function update(Request $request, NaitalkCallTenant $tenant)
    {
        $before = $tenant->only(self::AUDITED_FIELDS);
        $tenant->update($this->validated($request, $tenant));
        $this->audit($request, 'naitalk_call_tenant_updated', "Updated Naitalk Call business {$tenant->business_name}.", $before, $tenant);

        return response()->json(['data' => $this->serialize($tenant->refresh())]);
    }

    /** Fetch the CBN official rate now instead of waiting for the schedule. */
    public function refreshExchangeRate(CbnExchangeRate $cbn)
    {
        try {
            return response()->json(['exchange_rate' => $cbn->refresh()]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not fetch the CBN rate right now: '.$e->getMessage()], 502);
        }
    }

    /** Registered client accounts matching a name, email or client code, for onboarding. */
    public function searchClients(Request $request)
    {
        $q = trim((string) $request->validate(['q' => ['nullable', 'string', 'max:100']])['q'] ?? '');
        if (mb_strlen($q) < 2) {
            return response()->json(['data' => []]);
        }
        $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $q).'%';

        return response()->json([
            'data' => Client::query()->with('user:id,name,email')
                ->where(fn ($w) => $w->where('company_name', 'like', $like)->orWhere('billing_email', 'like', $like)->orWhere('client_code', 'like', $like)
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'like', $like)->orWhere('name', 'like', $like)))
                ->orderBy('company_name')->limit(10)->get()
                ->map(fn (Client $c) => self::clientSummary($c)),
        ]);
    }

    /**
     * Takes the key out of livekit.yaml at the next server sync (within minutes,
     * once no calls are live): apps using it can no longer connect. A new key
     * can be issued later.
     */
    public function revokeKey(Request $request, NaitalkCallTenant $tenant)
    {
        if ($tenant->key_source === 'server') {
            return response()->json(['message' => 'This key is still kept on the server. Hand it to Naitalk first (sync.mjs --adopt '.$tenant->room_prefix.'), then revoke it here.'], 422);
        }
        if (! $tenant->api_key || $tenant->revoked_at) {
            return response()->json(['message' => 'This app has no live key to revoke.'], 422);
        }

        $tenant->forceFill(['revoked_at' => now()])->save();
        $this->audit($request, 'naitalk_call_key_revoked', "Revoked the Naitalk Call key {$tenant->api_key} of {$tenant->business_name}.", null, $tenant);

        return response()->json(['data' => $this->serialize($tenant->refresh())]);
    }

    private static function clientSummary(Client $c): array
    {
        return ['id' => $c->id, 'name' => $c->company_name ?: $c->user?->name, 'email' => $c->user?->email ?: $c->billing_email, 'client_code' => $c->client_code];
    }

    /** New key and secret; the old pair stops working at the next server sync. */
    public function rotateKey(Request $request, NaitalkCallTenant $tenant)
    {
        if ($tenant->key_source === 'server') {
            return response()->json(['message' => 'This business\'s key is kept on the server (outside Naitalk\'s managed keys). Change it there.'], 422);
        }

        $secret = $tenant->issueKey();
        $this->audit($request, 'naitalk_call_key_rotated', "Issued a new Naitalk Call key for {$tenant->business_name}.", null, $tenant);

        return response()->json(['data' => $this->serialize($tenant->refresh()), 'api_secret' => $secret]);
    }

    /** Choosing a plan sets its price, unless a price is given as well. */
    private function validated(Request $request, ?NaitalkCallTenant $tenant = null): array
    {
        $payload = $request->validate([
            // Only registered client accounts subscribe; existing apps may still be unlinked (Cradle at first).
            'client_id' => [...($tenant ? ['sometimes', 'nullable'] : ['required']), 'integer', 'exists:clients,id'],
            // The app's name, e.g. "Cradle": a client can have several apps.
            'business_name' => ['required', 'string', 'max:120'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:190'],
            'plan' => ['sometimes', Rule::in(array_keys(config('naitalk_call.plans')))],
            'monthly_price_usd_cents' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(NaitalkCallTenant::STATUSES)],
            // Lowercase letters, digits and inner hyphens; it starts every room name.
            'room_prefix' => ['required', 'string', 'max:32', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/', Rule::unique('naitalk_call_tenants', 'room_prefix')->ignore($tenant?->id)],
            'webhook_url' => ['nullable', 'url', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $plan = $payload['plan'] ?? ($tenant ? null : config('naitalk_call.default_plan'));
        if ($plan !== null && ! array_key_exists('monthly_price_usd_cents', $payload) && $plan !== $tenant?->plan) {
            $payload['monthly_price_usd_cents'] = (int) config("naitalk_call.plans.$plan.monthly_usd_cents");
        }

        return $payload;
    }

    private function audit(Request $request, string $action, string $reason, ?array $before, NaitalkCallTenant $tenant): void
    {
        AuditLog::query()->create([
            'staff_user_id' => $request->user()?->id,
            'action' => $action,
            'reason' => $reason,
            'before_state' => $before,
            'after_state' => $tenant->only(self::AUDITED_FIELDS),
        ]);
    }

    private function serialize(NaitalkCallTenant $tenant, ?int $secondsThisMonth = null): array
    {
        $price = $this->pricing->plan($tenant->plan, $tenant->monthly_price_usd_cents);

        return [
            'id' => $tenant->id,
            'business_name' => $tenant->business_name,
            'contact_email' => $tenant->contact_email,
            'client' => $tenant->client ? self::clientSummary($tenant->client) : null,
            'revoked_at' => $tenant->revoked_at?->toIso8601String(),
            'plan' => $tenant->plan,
            'monthly_price_usd_cents' => $tenant->monthly_price_usd_cents,
            'monthly_price_usd' => $price['monthly_usd'],
            'monthly_price_ngn' => $price['monthly_ngn_kobo'] === null ? null : Money::naira($price['monthly_ngn_kobo']),
            'plan_name' => $price['name'],
            'included_minutes' => $price['included_minutes'],
            'status' => $tenant->status,
            'room_prefix' => $tenant->room_prefix,
            'key_source' => $tenant->key_source,
            'api_key' => $tenant->api_key,
            'webhook_url' => $tenant->webhook_url,
            'notes' => $tenant->notes,
            'minutes_this_month' => $secondsThisMonth === null ? null : (int) ceil($secondsThisMonth / 60),
            'created_at' => $tenant->created_at?->toIso8601String(),
        ];
    }
}
