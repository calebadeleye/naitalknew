<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\Payments\PaymentMethodSettings;

/** The payment methods the admin has switched on — the only ones a client is offered. */
class PaymentOptionsController extends Controller
{
    public function __invoke(PaymentMethodSettings $settings)
    {
        return response()->json(['methods' => $settings->availableForClients()]);
    }
}
