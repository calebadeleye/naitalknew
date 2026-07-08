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
            'data' => HostingPlan::query()
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
        $hostingPlan->forceFill(['is_active' => false])->save();

        return response()->json($this->serialize($hostingPlan->refresh()));
    }

    private function validatePayload(Request $request, ?HostingPlan $hostingPlan = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', Rule::unique('hosting_plans', 'slug')->ignore($hostingPlan)],
            'short_description' => ['required', 'string', 'max:255'],
            'monthly_price_kobo' => ['required', 'integer', 'min:0'],
            'annual_price_kobo' => ['required', 'integer', 'min:0'],
            'setup_fee_kobo' => ['nullable', 'integer', 'min:0'],
            'storage_allocation' => ['required', 'string', 'max:80'],
            'bandwidth_policy' => ['required', 'string', 'max:120'],
            'websites' => ['required', 'integer', 'min:0'],
            'databases' => ['required', 'integer', 'min:0'],
            'email_accounts' => ['required', 'integer', 'min:0'],
            'backup_frequency' => ['nullable', 'string', 'max:80'],
            'support_tier' => ['required', 'string', 'max:80'],
            'migration_included' => ['boolean'],
            'is_featured' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['required', 'integer', 'min:0'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
        ]);
    }

    private function serialize(HostingPlan $plan): array
    {
        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'slug' => $plan->slug,
            'short_description' => $plan->short_description,
            'monthly_price_kobo' => $plan->monthly_price_kobo,
            'annual_price_kobo' => $plan->annual_price_kobo,
            'setup_fee_kobo' => $plan->setup_fee_kobo,
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
            'is_active' => $plan->is_active,
            'sort_order' => $plan->sort_order,
            'internal_notes' => $plan->internal_notes,
        ];
    }
}
