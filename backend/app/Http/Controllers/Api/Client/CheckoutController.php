<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\TermsAcceptance;
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
            'billing_cycle' => ['required', 'in:annual'],
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

            $result = $domainOrders->createDomainAndHostingOrder($client, $domainName, $payload);
            TermsAcceptance::record($request, $request->user(), $client, 'domain_hosting_order', $result['order']->order_number ?? null);

            return response()->json($result, 201);
        }

        $result = $checkout->createHostingOrder($payload, $client);
        TermsAcceptance::record($request, $request->user(), $client, 'hosting_order', $result['order']->order_number ?? null);

        return response()->json($result, 201);
    }
}
