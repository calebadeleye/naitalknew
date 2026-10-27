<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Services\Billing\Money;
use App\Services\NaitalkCall\NaitalkCallPricing;

class NaitalkCallController extends Controller
{
    /** All plans with dollar and Naira prices (CBN official rate). */
    public function pricing(NaitalkCallPricing $pricing)
    {
        return response()->json([
            'plans' => array_map(fn (array $plan) => [...$plan, 'monthly_ngn' => $plan['monthly_ngn_kobo'] === null ? null : Money::naira($plan['monthly_ngn_kobo'])], $pricing->plans()),
            'exchange_rate' => $pricing->exchangeRate(),
        ]);
    }
}
