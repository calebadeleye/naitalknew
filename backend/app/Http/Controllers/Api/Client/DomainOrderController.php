<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
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
        ]);

        $domainName = $availability->normalize($payload['domain_name']);

        abort_unless(
            $availability->wasRecentlyVerifiedAvailable($domainName),
            422,
            'Please search for this domain again to confirm it is still available before checking out.'
        );

        try {
            return response()->json($domainOrders->createDomainOnlyOrder($client, $domainName), 201);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
