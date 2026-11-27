<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Notifications\NoServiceFollowUp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class NoServiceEmailTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    private function client(string $name, string $company): Client
    {
        $user = User::factory()->create(['role' => 'client', 'account_status' => 'active', 'name' => $name]);

        return Client::query()->create([
            'user_id' => $user->id, 'client_code' => 'CLT-'.Str::upper(Str::random(8)), 'account_type' => 'billing_client',
            'client_status' => 'active', 'status' => 'active', 'billing_email' => $user->email, 'country' => 'Nigeria', 'company_name' => $company,
        ]);
    }

    public function test_greeting_uses_real_looking_first_names_only(): void
    {
        $this->assertSame('Hello Theodore,', NoServiceFollowUp::greetingFor('Theodore Smith'));
        $this->assertSame('Hello,', NoServiceFollowUp::greetingFor('Hgf'));
        $this->assertSame('Hello,', NoServiceFollowUp::greetingFor('tripeljexchange'));
        $this->assertSame('Hello,', NoServiceFollowUp::greetingFor(''));
    }

    public function test_the_email_names_the_company_and_links_the_services(): void
    {
        $mail = (new NoServiceFollowUp($this->client('Theodore Smith', 'Prime Audio Lagos')))->toMail(new \stdClass);
        $html = (string) $mail->render();

        $this->assertSame("Let's get Prime Audio Lagos online", $mail->subject);
        $this->assertStringContainsString('https://www.naitalk.com/web-hosting', $html);
        $this->assertStringContainsString('0708 705 7654', $html);
        $this->assertStringContainsString('https://www.naitalk.com/client/login', $html);
    }

    public function test_nothing_is_sent_without_send_and_clients_with_a_service_are_skipped(): void
    {
        Notification::fake();
        $empty = $this->client('Theodore Smith', 'Prime Audio Lagos');
        $withService = $this->createProvisionableHostingService()->client;

        $this->artisan('clients:no-service-email', ['clients' => [$empty->id, $withService->id]])->assertSuccessful();
        Notification::assertNothingSent();

        $this->artisan('clients:no-service-email', ['clients' => [$empty->id, $withService->id], '--send' => true])->assertSuccessful();
        Notification::assertSentTo($empty->user, NoServiceFollowUp::class);
        Notification::assertNotSentTo($withService->user, NoServiceFollowUp::class);
    }
}
