<?php

namespace App\Http\Controllers\Api\Public;

use App\Exceptions\SpaceshipApiException;
use App\Http\Controllers\Controller;
use App\Models\DomainPricing;
use App\Services\Billing\Money;
use App\Services\Domains\DomainNameValidator;
use App\Services\Domains\DomainPricingService;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use Illuminate\Http\Request;

class DomainSearchController extends Controller
{
    public function search(Request $request, SpaceshipDomainAvailabilityService $availability)
    {
        $payload = $request->validate([
            'domain' => ['required', 'string', 'max:255', DomainNameValidator::rule()],
        ]);

        try {
            return response()->json($availability->search($payload['domain']));
        } catch (SpaceshipApiException $exception) {
            // Spaceship is the sole source of truth for availability — if it's
            // unreachable we never fabricate a result, we just say so plainly.
            return response()->json([
                'message' => 'Domain search is temporarily unavailable. Please try again shortly.',
            ], 503);
        }
    }

    /**
     * Feeds the marketing TLD price cards on the public domains landing
     * page — real admin-configured prices, never hardcoded numbers.
     */
    public function pricing(DomainPricingService $pricing)
    {
        $rows = DomainPricing::query()->where('status', 'active')->orderBy('tld')->get();

        return response()->json([
            'data' => $rows->map(function (DomainPricing $row) use ($pricing) {
                $price = $pricing->priceFor($row->tld);

                return [
                    'tld' => $row->tld,
                    'registration_price_kobo' => $price['registration_kobo'] ?? null,
                    'registration_price' => $price ? Money::naira($price['registration_kobo']) : null,
                ];
            })->values(),
        ]);
    }
}
