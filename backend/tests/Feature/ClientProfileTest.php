<?php

namespace Tests\Feature;

use App\Models\ClientActivityLog;
use App\Models\Payment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class ClientProfileTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    public function test_client_can_view_their_own_profile_with_sensible_defaults(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;

        Sanctum::actingAs($client->user, [], 'sanctum');

        $response = $this->getJson('/api/v1/client/profile')->assertOk();

        $response->assertJsonPath('customer_id', $client->client_code);
        $response->assertJsonPath('personal.full_name', $client->user->name);
        $response->assertJsonPath('personal.email', $client->user->email);
        $response->assertJsonPath('security.two_factor_enabled', false);
        $response->assertJsonPath('security.login_alerts_enabled', true);
        $response->assertJsonPath('communication_preferences.invoice_alerts', true);
        $response->assertJsonPath('communication_preferences.renewal_reminders', true);
        $response->assertJsonPath('communication_preferences.product_updates', true);
    }

    public function test_client_can_update_personal_and_company_information(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->putJson('/api/v1/client/profile', [
            'name' => 'Updated Name',
            'phone' => '+2348030000000',
            'country' => 'Nigeria',
            'state' => 'Lagos',
            'city' => 'Lekki',
            'address' => '12 Admiralty Way',
            'company_name' => 'Adeleye Technologies Ltd.',
            'website' => 'https://adeyetech.com',
            'industry' => 'Information Technology',
            'support_email' => 'support@adeyetech.com',
            'company_size' => '11-50 employees',
            'tax_id' => '23456789-0001',
        ])->assertOk()
            ->assertJsonPath('personal.full_name', 'Updated Name')
            ->assertJsonPath('personal.state', 'Lagos')
            ->assertJsonPath('company.business_name', 'Adeleye Technologies Ltd.')
            ->assertJsonPath('company.website', 'https://adeyetech.com');

        $this->assertSame('Updated Name', $client->user->fresh()->name);
        $this->assertSame('Lagos', $client->fresh()->state);
    }

    public function test_updating_the_profile_never_changes_the_email_address(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;
        $originalEmail = $client->user->email;

        Sanctum::actingAs($client->user, [], 'sanctum');

        // Even if a client somehow sends an email field, the endpoint has no
        // validation rule for it, so it's silently ignored rather than applied.
        $this->putJson('/api/v1/client/profile', ['email' => 'someone-else@example.com'])->assertOk();

        $this->assertSame($originalEmail, $client->user->fresh()->email);
    }

    public function test_client_can_update_communication_preferences(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->putJson('/api/v1/client/profile/communication-preferences', [
            'invoice_alerts' => false,
            'renewal_reminders' => true,
            'product_updates' => false,
        ])->assertOk()
            ->assertJsonPath('communication_preferences.invoice_alerts', false)
            ->assertJsonPath('communication_preferences.product_updates', false);

        $this->assertFalse($client->fresh()->communicationPreferences()['invoice_alerts']);
    }

    public function test_client_can_toggle_two_factor_and_login_alerts_and_it_is_logged(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->putJson('/api/v1/client/profile/security', ['two_factor_enabled' => true])
            ->assertOk()
            ->assertJsonPath('two_factor_enabled', true);

        $this->assertTrue($client->user->fresh()->two_factor_enabled);
        $this->assertDatabaseHas('client_activity_logs', [
            'client_id' => $client->id,
            'type' => 'two_factor_enabled',
        ]);
    }

    public function test_changing_password_requires_the_correct_current_password(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;
        $client->user->forceFill(['password' => 'the-old-password'])->save();

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->postJson('/api/v1/client/profile/change-password', [
            'current_password' => 'wrong-password',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertUnprocessable();
    }

    public function test_changing_password_with_the_correct_current_password_succeeds_and_is_logged(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;
        $client->user->forceFill(['password' => 'the-old-password'])->save();

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->postJson('/api/v1/client/profile/change-password', [
            'current_password' => 'the-old-password',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertOk();

        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('a-brand-new-password', $client->user->fresh()->password));
        $this->assertDatabaseHas('client_activity_logs', [
            'client_id' => $client->id,
            'type' => 'password_changed',
        ]);
    }

    public function test_account_activity_merges_real_login_and_payment_events(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;

        ClientActivityLog::query()->create([
            'client_id' => $client->id,
            'type' => 'login',
            'description' => 'Successful login',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDay(),
        ]);

        Payment::query()->create([
            'client_id' => $client->id,
            'gateway' => 'paystack',
            'purpose' => 'invoice_payment',
            'reference' => 'PAY-TEST-1',
            'status' => 'paid',
            'amount_kobo' => 500000,
            'currency' => 'NGN',
            'paid_at' => now(),
        ]);

        Sanctum::actingAs($client->user, [], 'sanctum');

        $response = $this->getJson('/api/v1/client/profile/activity')->assertOk();
        $types = collect($response->json('data'))->pluck('type');

        $this->assertTrue($types->contains('login'));
        $this->assertTrue($types->contains('payment'));
    }

    /**
     * Managing your own account must never be blocked by email verification —
     * only actions that move money or provision real infrastructure require
     * it. A new, unverified signup should still be able to secure their
     * account (2FA, password) and set preferences immediately.
     */
    public function test_an_unverified_client_can_still_manage_their_own_profile_security_and_preferences(): void
    {
        $service = $this->createProvisionableHostingService();
        $client = $service->client;
        $client->user->forceFill(['email_verified_at' => null, 'password' => 'the-old-password'])->save();

        Sanctum::actingAs($client->user, [], 'sanctum');

        $this->putJson('/api/v1/client/profile', ['name' => 'Still Editable'])->assertOk();
        $this->putJson('/api/v1/client/profile/communication-preferences', [
            'invoice_alerts' => false,
            'renewal_reminders' => false,
            'product_updates' => false,
        ])->assertOk();
        $this->putJson('/api/v1/client/profile/security', ['two_factor_enabled' => true])->assertOk();
        $this->postJson('/api/v1/client/profile/change-password', [
            'current_password' => 'the-old-password',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertOk();
    }

    public function test_a_client_cannot_view_or_modify_another_clients_profile_data(): void
    {
        $serviceA = $this->createProvisionableHostingService();
        $serviceB = $this->createProvisionableHostingService();

        Sanctum::actingAs($serviceA->client->user, [], 'sanctum');

        $response = $this->getJson('/api/v1/client/profile')->assertOk();

        $this->assertNotSame($serviceB->client->client_code, $response->json('customer_id'));
    }
}
