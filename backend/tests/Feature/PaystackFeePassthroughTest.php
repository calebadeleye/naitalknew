<?php

namespace Tests\Feature;

use App\Services\Payments\PaystackGateway;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaystackFeePassthroughTest extends TestCase
{
    public function test_verify_uses_requested_amount_instead_of_the_fee_inflated_amount(): void
    {
        Http::fake([
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true,
                'data' => [
                    'status' => 'success',
                    'amount' => 555838,
                    'requested_amount' => 537500,
                    'fees' => 18338,
                    'currency' => 'NGN',
                    'reference' => 'fee-test-ref',
                ],
            ], 200),
        ]);

        $result = (new PaystackGateway())->verify('fee-test-ref');

        $this->assertSame(537500, $result['amount_kobo']);
    }

    public function test_verify_falls_back_to_amount_when_requested_amount_is_absent(): void
    {
        Http::fake([
            'api.paystack.co/transaction/verify/*' => Http::response([
                'status' => true,
                'data' => [
                    'status' => 'success',
                    'amount' => 537500,
                    'currency' => 'NGN',
                    'reference' => 'no-fee-ref',
                ],
            ], 200),
        ]);

        $result = (new PaystackGateway())->verify('no-fee-ref');

        $this->assertSame(537500, $result['amount_kobo']);
    }

    public function test_charge_authorization_uses_requested_amount_instead_of_the_fee_inflated_amount(): void
    {
        Http::fake([
            'api.paystack.co/transaction/charge_authorization' => Http::response([
                'status' => true,
                'data' => [
                    'status' => 'success',
                    'amount' => 555838,
                    'requested_amount' => 537500,
                    'fees' => 18338,
                    'currency' => 'NGN',
                    'reference' => 'fee-auth-ref',
                ],
            ], 200),
        ]);

        $result = (new PaystackGateway())->chargeAuthorization('AUTH_test', 'client@example.test', 537500, 'fee-auth-ref');

        $this->assertSame(537500, $result['amount_kobo']);
    }
}
