<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\Billing\CheckoutService;
use App\Services\Domains\DomainNameValidator;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function store(Request $request, CheckoutService $checkout, DomainOrderService $domainOrders, SpaceshipDomainAvailabilityService $availability)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:hosting_plans,slug'],
            'billing_cycle' => ['required', 'in:monthly,annual'],
            'primary_domain' => ['required', 'string', 'max:255', DomainNameValidator::rule()],
            'add_ons' => ['array'],
            'add_ons.*' => ['string', 'exists:hosting_add_ons,slug'],
            'auto_renew' => ['boolean'],
            'payment_gateway' => ['nullable', 'in:paystack,flutterwave'],
            'terms_accepted' => ['accepted'],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            // Flow 2 (Domain + Hosting) — the client searched and confirmed
            // this exact domain is available immediately before checkout.
            'register_domain' => ['boolean'],
        ]);

        if ($payload['register_domain'] ?? false) {
            $domainName = $availability->normalize($payload['primary_domain']);

            abort_unless(
                $availability->wasRecentlyVerifiedAvailable($domainName),
                422,
                'Please search for this domain again to confirm it is still available before checking out.'
            );

            return response()->json($domainOrders->createDomainAndHostingOrder($client, $domainName, $payload), 201);
        }

        return response()->json($checkout->createHostingOrder($payload, $client), 201);
    }
}
