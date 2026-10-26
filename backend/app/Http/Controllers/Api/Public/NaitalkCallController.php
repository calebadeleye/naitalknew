<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Services\Billing\Money;
use App\Services\NaitalkCall\NaitalkCallPricing;

class NaitalkCallController extends Controller
{
    public function pricing(NaitalkCallPricing $pricing)
    {
        $plan = $pricing->plan();

        return response()->json([
            ...$plan,
            'monthly_ngn' => $plan['monthly_ngn_kobo'] === null ? null : Money::naira($plan['monthly_ngn_kobo']),
        ]);
    }
}
