<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use App\Services\Billing\Money;
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
            'data' => NaitalkCallTenant::query()->with('client:id,company_name,billing_email')->orderBy('business_name')->get()
                ->map(fn (NaitalkCallTenant $tenant) => $this->serialize($tenant, (int) ($seconds[$tenant->id] ?? 0))),
            'plan' => $this->pricing->plan(),
            'plans' => collect(config('naitalk_call.plans'))->map(fn (array $plan, string $id) => ['id' => $id, 'name' => $plan['name'], 'monthly_usd' => $this->pricing->plan($id)['monthly_usd']])->values(),
            'public_url' => config('naitalk_call.public_url'),
            'last_sync' => AppSetting::get('naitalk_call_last_sync'),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validated($request);
        $tenant = NaitalkCallTenant::query()->create(['plan' => 'business', ...$payload]);
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
            'business_name' => ['required', 'string', 'max:120'],
            'contact_email' => ['nullable', 'email', 'max:190'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'plan' => ['sometimes', Rule::in(array_keys(config('naitalk_call.plans')))],
            'monthly_price_usd_cents' => ['sometimes', 'integer', 'min:0'],
            'status' => ['sometimes', Rule::in(NaitalkCallTenant::STATUSES)],
            // Lowercase letters, digits and inner hyphens; it starts every room name.
            'room_prefix' => ['required', 'string', 'max:32', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/', Rule::unique('naitalk_call_tenants', 'room_prefix')->ignore($tenant?->id)],
            'webhook_url' => ['nullable', 'url', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $plan = $payload['plan'] ?? ($tenant ? null : 'business');
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
            'client' => $tenant->client ? ['id' => $tenant->client->id, 'name' => $tenant->client->company_name, 'email' => $tenant->client->billing_email] : null,
            'plan' => $tenant->plan,
            'monthly_price_usd_cents' => $tenant->monthly_price_usd_cents,
            'monthly_price_usd' => $price['monthly_usd'],
            'monthly_price_ngn' => $price['monthly_ngn_kobo'] === null ? null : Money::naira($price['monthly_ngn_kobo']),
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
