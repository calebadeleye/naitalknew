<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Models\ServiceOffering;
use App\Services\Billing\Money;

class ServiceCatalogController extends Controller
{
    public function __invoke()
    {
        $hostingPlans = HostingPlan::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->map(fn (HostingPlan $plan) => [
                'name' => $plan->name,
                'slug' => $plan->slug,
                'category' => 'hosting',
                'short_description' => $plan->short_description,
                'benefits' => array_filter([
                    $plan->storage_allocation,
                    $plan->bandwidth_policy,
                    $plan->backup_frequency ? "{$plan->backup_frequency} backups" : null,
                    "{$plan->support_tier} support",
                ]),
                'starting_price' => Money::naira($plan->monthly_price_kobo),
                'billing_type' => 'monthly',
                'is_quote_only' => false,
                'order_route' => '/client/order/hosting?plan='.$plan->slug,
            ]);

        $addOns = HostingAddOn::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (HostingAddOn $addOn) => [
                'name' => $addOn->name,
                'slug' => $addOn->slug,
                'category' => 'add_on',
                'short_description' => $addOn->description,
                'benefits' => [],
                'starting_price' => Money::naira($addOn->monthly_price_kobo),
                'billing_type' => 'monthly',
                'is_quote_only' => false,
                'order_route' => '/client/order/hosting',
            ]);

        $offerings = ServiceOffering::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get()
            ->map(fn (ServiceOffering $offering) => [
                'name' => $offering->name,
                'slug' => $offering->slug,
                'category' => $offering->category,
                'short_description' => $offering->short_description,
                'benefits' => $offering->benefits ?? [],
                'starting_price' => $offering->price_kobo ? Money::naira($offering->price_kobo) : null,
                'billing_type' => $offering->billing_type,
                'is_quote_only' => $offering->is_quote_only,
                'order_route' => $offering->is_quote_only ? '/client/support/tickets/new?topic='.$offering->slug : null,
            ]);

        return response()->json([
            'data' => $hostingPlans->concat($addOns)->concat($offerings)->values(),
        ]);
    }
}
