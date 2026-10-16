<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\TermsAcceptance;
use App\Services\Billing\CartService;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use Illuminate\Http\Request;

/** The cart: price it (any time), and check out the whole thing as one order and invoice. */
class CartController extends Controller
{
    /** Authoritative prices for what's in the cart (the browser never works out prices itself). */
    public function quote(Request $request, CartService $cart)
    {
        $client = $request->user()->client;
        abort_if(! $client, 404, 'Client profile not found.');

        // An empty cart is simply an empty quote, not an error.
        if (blank($request->input('lines'))) {
            return response()->json(['lines' => [], 'subtotal_kobo' => 0, 'vat_rate' => 0, 'vat_kobo' => 0, 'total_kobo' => 0, 'has_errors' => false]);
        }

        return response()->json($cart->price($client, $cart->validateLines($request->input('lines'))));
    }

    public function checkout(Request $request, CartService $cart, SpaceshipDomainAvailabilityService $availability)
    {
        $client = $request->user()->client;
        abort_if(! $client, 404, 'Client profile not found.');

        $request->validate(['terms_accepted' => ['accepted']], ['terms_accepted.accepted' => 'Please agree to the Terms of Service to place this order.']);

        $result = $cart->checkout($client, $cart->validateLines($request->input('lines')), $availability);
        TermsAcceptance::record($request, $request->user(), $client, 'cart_order', $result['order']->order_number);

        return response()->json(['order' => $result['order'], 'invoice' => $result['invoice']], 201);
    }
}
