<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Services\Payments\SavedPaymentMethodService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SavedPaymentMethodTest extends TestCase
{
    use RefreshDatabase;

    private function makeClient(): Client
    {
        $user = User::factory()->create();

        return Client::query()->create([
            'user_id' => $user->id,
            'client_code' => 'CL-'.$user->id,
            'account_type' => 'registered_user',
            'client_status' => 'active',
            'billing_email' => $user->email,
        ]);
    }

    public function test_paystack_capture_stores_only_the_token_brand_last4_and_expiry_never_raw_card_data(): void
    {
        $client = $this->makeClient();

        $method = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($client, 'paystack', [
            'status' => 'success',
            'customer' => ['customer_code' => 'CUS_abc123'],
            'authorization' => [
                'authorization_code' => 'AUTH_xyz789',
                'card_type' => 'visa',
                'last4' => '4081',
                'exp_month' => '12',
                'exp_year' => '2030',
                'reusable' => true,
                // Paystack does return a masked "bin" but never the full PAN or CVV —
                // simulate the full raw payload shape to prove we only pick safe fields.
                'bin' => '408408',
                'signature' => 'SIG_whatever',
            ],
        ]);

        $this->assertNotNull($method);
        $this->assertSame('paystack', $method->payment_provider);
        $this->assertSame('AUTH_xyz789', $method->provider_authorization_code);
        $this->assertSame('visa', $method->card_brand);
        $this->assertSame('4081', $method->last4);
        $this->assertSame(12, $method->exp_month);
        $this->assertSame(2030, $method->exp_year);

        $stored = $method->getAttributes();
        $this->assertArrayNotHasKey('cvv', $stored);
        $this->assertArrayNotHasKey('card_number', $stored);
        $this->assertArrayNotHasKey('pan', $stored);
        // Only ever a 4-digit masked value is stored for the card, never the full PAN.
        $this->assertSame(4, strlen($method->last4));
    }

    public function test_non_reusable_paystack_authorization_is_not_saved(): void
    {
        $client = $this->makeClient();

        $method = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($client, 'paystack', [
            'authorization' => [
                'authorization_code' => 'AUTH_onetime',
                'reusable' => false,
            ],
        ]);

        $this->assertNull($method);
        $this->assertDatabaseCount('saved_payment_methods', 0);
    }

    public function test_flutterwave_capture_stores_token_and_masked_card_details(): void
    {
        $client = $this->makeClient();

        $method = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($client, 'flutterwave', [
            'customer' => ['id' => 555],
            'card' => [
                'first_6digits' => '539923',
                'last_4digits' => '9192',
                'type' => 'MASTERCARD',
                'expiry' => '09/28',
                'token' => 'flw-token-abc',
            ],
        ]);

        $this->assertNotNull($method);
        $this->assertSame('flutterwave', $method->payment_provider);
        $this->assertSame('flw-token-abc', $method->provider_authorization_code);
        $this->assertSame('MASTERCARD', $method->card_brand);
        $this->assertSame('9192', $method->last4);
        $this->assertSame(9, $method->exp_month);
        $this->assertSame(2028, $method->exp_year);
    }

    public function test_client_can_toggle_and_delete_a_saved_payment_method(): void
    {
        $token = $this->postJson('/api/v1/auth/register', [
            'name' => 'Card Owner',
            'email' => 'card-owner@example.test',
            'password' => 'secret-password',
            'phone' => '08000000044',
        ])->assertCreated()->json('token');

        $user = User::query()->where('email', 'card-owner@example.test')->firstOrFail();
        $user->forceFill(['email_verified_at' => now()])->save();

        $method = app(SavedPaymentMethodService::class)->captureFromGatewayPayload($user->client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_toggle', 'reusable' => true, 'last4' => '1234'],
        ]);

        $this->withToken($token)
            ->patchJson("/api/v1/client/payment-methods/{$method->id}", [
                'use_for_auto_renewal' => true,
                'is_default' => true,
            ])
            ->assertOk()
            ->assertJsonPath('data.use_for_auto_renewal', true)
            ->assertJsonPath('data.is_default', true);

        $this->withToken($token)
            ->patchJson("/api/v1/client/payment-methods/{$method->id}", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        // A disabled card must never be selected for auto-renewal.
        $this->assertNull(app(SavedPaymentMethodService::class)->defaultAutoRenewalMethod($user->client));

        $this->withToken($token)
            ->deleteJson("/api/v1/client/payment-methods/{$method->id}")
            ->assertOk();

        $this->assertDatabaseMissing('saved_payment_methods', ['id' => $method->id]);
    }

    public function test_default_auto_renewal_method_only_considers_active_enabled_cards(): void
    {
        $client = $this->makeClient();
        $service = app(SavedPaymentMethodService::class);

        $disabled = $service->captureFromGatewayPayload($client, 'paystack', [
            'authorization' => ['authorization_code' => 'AUTH_disabled', 'reusable' => true, 'last4' => '1111'],
        ]);
        $disabled->forceFill(['use_for_auto_renewal' => false])->save();

        $enabled = $service->captureFromGatewayPayload($client, 'flutterwave', [
            'card' => ['token' => 'flw-token-enabled', 'last_4digits' => '2222', 'type' => 'visa'],
        ]);
        $enabled->forceFill(['use_for_auto_renewal' => true])->save();

        $chosen = $service->defaultAutoRenewalMethod($client);
        $this->assertNotNull($chosen);
        $this->assertSame($enabled->id, $chosen->id);
    }
}
