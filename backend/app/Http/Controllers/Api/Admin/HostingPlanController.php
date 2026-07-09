<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\HostingPlan;
use App\Services\Billing\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class HostingPlanController extends Controller
{
    public function index()
    {
        return response()->json([
            // Active packages first so deprecated/legacy plans (kept around
            // only so existing subscriptions aren't orphaned) don't clutter
            // the top of the admin list.
            'data' => HostingPlan::query()
                ->orderByDesc('is_active')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map(fn (HostingPlan $plan) => $this->serialize($plan)),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validatePayload($request);
        $payload['slug'] = $payload['slug'] ?: Str::slug($payload['name']);

        $plan = HostingPlan::query()->create($payload);

        return response()->json($this->serialize($plan), 201);
    }

    public function update(Request $request, HostingPlan $hostingPlan)
    {
        $payload = $this->validatePayload($request, $hostingPlan);
        $payload['slug'] = $payload['slug'] ?: Str::slug($payload['name']);
        $hostingPlan->update($payload);

        return response()->json($this->serialize($hostingPlan->refresh()));
    }

    public function destroy(HostingPlan $hostingPlan)
    {
        // Hosting services reference plans via a restrictOnDelete() FK, so
        // packages are always deactivated in place rather than deleted —
        // this keeps existing subscriptions/invoices intact.
        $hostingPlan->forceFill(['is_active' => false, 'status' => 'inactive'])->save();

        return response()->json($this->serialize($hostingPlan->refresh()));
    }

    private function validatePayload(Request $request, ?HostingPlan $hostingPlan = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', Rule::unique('hosting_plans', 'slug')->ignore($hostingPlan)],
            'short_description' => ['required', 'string', 'max:255'],
            'plan_type' => ['nullable', 'string', Rule::in(['website_care', 'legacy'])],
            'monthly_price_kobo' => ['required', 'integer', 'min:0'],
            'annual_price_kobo' => ['required', 'integer', 'min:0'],
            'setup_fee_kobo' => ['nullable', 'integer', 'min:0'],
            'hosting_amount_kobo' => ['nullable', 'integer', 'min:0'],
            'ssl_amount_kobo' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'max:3'],
            'storage_allocation' => ['required', 'string', 'max:80'],
            'bandwidth_policy' => ['required', 'string', 'max:120'],
            'websites' => ['required', 'integer', 'min:0'],
            'databases' => ['required', 'integer', 'min:0'],
            'email_accounts' => ['required', 'integer', 'min:0'],
            'backup_frequency' => ['nullable', 'string', 'max:80'],
            'support_tier' => ['required', 'string', 'max:80'],
            'migration_included' => ['boolean'],
            'is_featured' => ['boolean'],
            'is_popular' => ['boolean'],
            'is_recommended' => ['boolean'],
            'is_active' => ['boolean'],
            'is_public' => ['boolean'],
            'is_orderable' => ['boolean'],
            'status' => ['nullable', 'string', Rule::in(['active', 'inactive', 'deprecated', 'active_internal'])],
            'sort_order' => ['required', 'integer', 'min:0'],
            'display_badge' => ['nullable', 'string', 'max:60'],
            'cta_label' => ['nullable', 'string', 'max:60'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'public_features' => ['nullable', 'array'],
            'public_features.*' => ['string', 'max:160'],
            'internal_limits' => ['nullable', 'array'],
        ]);
    }

    private function serialize(HostingPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'slug' => $plan->slug,
            'plan_type' => $plan->plan_type,
            'short_description' => $plan->short_description,
            'monthly_price_kobo' => $plan->monthly_price_kobo,
            'annual_price_kobo' => $plan->annual_price_kobo,
            'setup_fee_kobo' => $plan->setup_fee_kobo,
            'hosting_amount_kobo' => $plan->hosting_amount_kobo,
            'ssl_amount_kobo' => $plan->ssl_amount_kobo,
            'currency' => $plan->currency,
            'monthly_price' => Money::naira($plan->monthly_price_kobo),
            'annual_price' => Money::naira($plan->annual_price_kobo),
            'setup_fee' => Money::naira($plan->setup_fee_kobo),
            'storage_allocation' => $plan->storage_allocation,
            'bandwidth_policy' => $plan->bandwidth_policy,
            'websites' => $plan->websites,
            'databases' => $plan->databases,
            'email_accounts' => $plan->email_accounts,
            'backup_frequency' => $plan->backup_frequency,
            'support_tier' => $plan->support_tier,
            'migration_included' => $plan->migration_included,
            'is_featured' => $plan->is_featured,
            'is_popular' => $plan->is_popular,
            'is_recommended' => $plan->is_recommended,
            'is_active' => $plan->is_active,
            'is_public' => $plan->is_public,
            'is_orderable' => $plan->is_orderable,
            'status' => $plan->status,
            'sort_order' => $plan->sort_order,
            'display_badge' => $plan->display_badge,
            'cta_label' => $plan->cta_label,
            'internal_notes' => $plan->internal_notes,
            'public_features' => $plan->public_features ?? [],
            'internal_limits' => $plan->internal_limits ?? [],
        ];
    }
}
