<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\TermsAcceptance;
use App\Services\Domains\DomainNameValidator;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Flow 1: Domain Only.
 */
class DomainOrderController extends Controller
{
    public function store(Request $request, DomainOrderService $domainOrders, SpaceshipDomainAvailabilityService $availability)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'domain_name' => ['required', 'string', 'max:255', DomainNameValidator::rule()],
            'terms_accepted' => ['accepted'],
        ], ['terms_accepted.accepted' => 'Please agree to the Terms of Service to place this order.']);

        $domainName = $availability->normalize($payload['domain_name']);

        abort_unless(
            $availability->wasRecentlyVerifiedAvailable($domainName),
            422,
            'Please search for this domain again to confirm it is still available before checking out.'
        );

        try {
            $result = $domainOrders->createDomainOnlyOrder($client, $domainName);
            TermsAcceptance::record($request, $request->user(), $client, 'domain_order', $result['order']->order_number ?? null);

            return response()->json($result, 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
