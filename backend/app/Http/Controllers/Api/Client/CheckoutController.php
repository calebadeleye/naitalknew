<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\Billing\CheckoutService;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function store(Request $request, CheckoutService $checkout)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'plan_slug' => ['required', 'string', 'exists:hosting_plans,slug'],
            'billing_cycle' => ['required', 'in:monthly,annual'],
            'primary_domain' => ['required', 'string', 'max:255'],
            'add_ons' => ['array'],
            'add_ons.*' => ['string', 'exists:hosting_add_ons,slug'],
            'auto_renew' => ['boolean'],
            'payment_gateway' => ['nullable', 'in:paystack,flutterwave'],
            'terms_accepted' => ['accepted'],
            'discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        return response()->json($checkout->createHostingOrder($payload, $client), 201);
    }
}
