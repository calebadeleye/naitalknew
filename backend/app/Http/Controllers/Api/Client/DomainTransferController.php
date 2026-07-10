<?php

namespace App\Http\Controllers\Api\Client;

use App\Exceptions\SpaceshipApiException;
use App\Http\Controllers\Controller;
use App\Services\Domains\DomainNameValidator;
use App\Services\Domains\DomainOrderService;
use App\Services\Domains\SpaceshipDomainTransferService;
use Illuminate\Http\Request;
use RuntimeException;

/**
 * Flow 4: Domain Transfer.
 */
class DomainTransferController extends Controller
{
    public function eligibility(Request $request, SpaceshipDomainTransferService $transferService)
    {
        $payload = $request->validate([
            'domain' => ['required', 'string', 'max:255', DomainNameValidator::rule()],
        ]);

        try {
            return response()->json($transferService->checkEligibility($payload['domain']));
        } catch (SpaceshipApiException $exception) {
            return response()->json([
                'message' => 'Transfer eligibility check is temporarily unavailable. Please try again shortly.',
            ], 503);
        }
    }

    public function store(Request $request, DomainOrderService $domainOrders)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'domain_name' => ['required', 'string', 'max:255', DomainNameValidator::rule()],
            // The EPP/auth code — required, never stored anywhere except
            // encrypted at rest on domain_transfers.epp_code_encrypted.
            'epp_code' => ['required', 'string', 'min:4', 'max:255'],
        ]);

        try {
            return response()->json(
                $domainOrders->createTransferOrder($client, $payload['domain_name'], $payload['epp_code']),
                201
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
