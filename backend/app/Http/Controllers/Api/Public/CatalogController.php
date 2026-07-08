<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Services\Billing\Money;

class CatalogController extends Controller
{
    public function hostingPlans()
    {
        return HostingPlan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (HostingPlan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'short_description' => $plan->short_description,
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
            ]);
    }

    public function addOns()
    {
        return HostingAddOn::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (HostingAddOn $addOn) => [
                'name' => $addOn->name,
                'slug' => $addOn->slug,
                'description' => $addOn->description,
                'monthly_price' => Money::naira($addOn->monthly_price_kobo),
                'annual_price' => Money::naira($addOn->annual_price_kobo),
            ]);
    }
}
