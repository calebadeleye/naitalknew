<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Services\Billing\Money;

class CatalogController extends Controller
{
    /**
     * Customer-facing package list. Deliberately excludes technical fields
     * (storage, bandwidth, website/database counts, SSH/SFTP, PHP version,
     * etc.) — those live in HostingPlan::$internal_limits/configuration_json
     * for provisioning and the admin dashboard only. Business owners see
     * plain-English benefits via public_features instead.
     */
    public function hostingPlans()
    {
        return HostingPlan::query()
            ->where('is_active', true)
            ->where('is_public', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (HostingPlan $plan) => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'short_description' => $plan->short_description,
                'monthly_price' => Money::naira($plan->monthly_price_kobo),
                'annual_price' => Money::naira($plan->annual_price_kobo),
                'currency' => $plan->currency,
                'display_badge' => $plan->display_badge,
                'is_popular' => $plan->is_popular,
                'is_recommended' => $plan->is_recommended,
                'cta_label' => $plan->cta_label ?: 'Choose plan',
                'sort_order' => $plan->sort_order,
                'public_features' => $plan->public_features ?? [],
            ]);
    }

    /**
     * Checkout-orderable add-ons only. Website Migration is intentionally
     * excluded — it has no fixed price (cost depends on the source site's
     * size/complexity and is quoted after the client is contacted), so it
     * can't be a fixed-price checkbox line item here. It still appears on
     * the client Services Catalogue as a "contact us" item.
     */
    public function addOns()
    {
        return HostingAddOn::query()
            ->where('is_active', true)
            ->where('slug', '!=', 'website-migration')
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
