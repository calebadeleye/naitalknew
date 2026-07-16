<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\WebsiteQuoteRequest;
use App\Notifications\NaiTalkWebsiteQuoteSubmitted;
use App\Notifications\WebsiteQuoteReceived;
use App\Services\Leads\WebsiteQuoteReferenceGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class WebsiteQuoteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->clearWebsiteQuoteRateLimiter();
    }

    /**
     * The rate limiter's cache store persists across tests within the same
     * PHPUnit process (unlike the database, which RefreshDatabase resets) —
     * clear it so each test starts with a fresh throttle window. The key
     * format (md5(limiterName.ip), no separator) mirrors ThrottleRequests's
     * own key hashing, which defaults to on in this Laravel version.
     */
    private function clearWebsiteQuoteRateLimiter(): void
    {
        RateLimiter::clear(md5('website-quote127.0.0.1'));
    }

    private function validPayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Ada Lovelace',
            'phone' => '08012345678',
            'email' => 'ada@example.test',
            'website_type' => 'Business or Corporate Website',
            'estimated_budget' => '₦200,000 – ₦400,000',
            'project_description' => 'I need a modern website for my consulting business with a booking form.',
            'landing_page' => 'https://www.naitalk.com/get-a-website',
            'utm_source' => 'google',
            'utm_medium' => 'cpc',
            'utm_campaign' => 'website-design-lagos',
            'utm_term' => 'website designer nigeria',
            'utm_content' => 'ad-1',
            'gclid' => 'Cj0KCQjw_test_gclid',
            'referrer' => 'https://www.google.com/',
        ], $overrides);
    }

    public function test_a_valid_enquiry_can_be_created(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/v1/public/website-quote', $this->validPayload())
            ->assertCreated();

        $response->assertJsonPath('status', 'success');
        $reference = $response->json('data.reference');

        $this->assertMatchesRegularExpression('/^NWT-\d{8}-\d{4}$/', $reference);
        $this->assertDatabaseHas('website_quote_requests', [
            'reference' => $reference,
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
            'status' => 'new',
        ]);
    }

    public function test_required_fields_are_enforced(): void
    {
        foreach (['name', 'phone', 'email', 'website_type', 'estimated_budget', 'project_description'] as $field) {
            $this->clearWebsiteQuoteRateLimiter();
            $payload = $this->validPayload();
            unset($payload[$field]);

            $this->postJson('/api/v1/public/website-quote', $payload)
                ->assertStatus(422)
                ->assertJsonValidationErrors([$field]);
        }
    }

    public function test_invalid_email_is_rejected(): void
    {
        $this->postJson('/api/v1/public/website-quote', $this->validPayload(['email' => 'not-an-email']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_invalid_website_type_is_rejected(): void
    {
        $this->postJson('/api/v1/public/website-quote', $this->validPayload(['website_type' => 'Not A Real Type']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['website_type']);
    }

    public function test_invalid_budget_option_is_rejected(): void
    {
        $this->postJson('/api/v1/public/website-quote', $this->validPayload(['estimated_budget' => 'A million naira']))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['estimated_budget']);
    }

    public function test_attribution_data_is_stored(): void
    {
        $response = $this->postJson('/api/v1/public/website-quote', $this->validPayload())->assertCreated();
        $reference = $response->json('data.reference');

        $this->assertDatabaseHas('website_quote_requests', [
            'reference' => $reference,
            'utm_source' => 'google',
            'utm_medium' => 'cpc',
            'utm_campaign' => 'website-design-lagos',
            'gclid' => 'Cj0KCQjw_test_gclid',
            'referrer' => 'https://www.google.com/',
            'landing_page' => 'https://www.naitalk.com/get-a-website',
        ]);
    }

    public function test_reference_numbers_are_sequential_and_uniquely_formatted(): void
    {
        $generator = app(WebsiteQuoteReferenceGenerator::class);

        $first = $generator->generate();
        $second = $generator->generate();

        $today = now()->format('Ymd');
        $this->assertSame("NWT-{$today}-0001", $first);
        $this->assertSame("NWT-{$today}-0002", $second);
    }

    public function test_rate_limiting_blocks_after_five_requests_per_minute(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/public/website-quote', $this->validPayload(['email' => "ada{$i}@example.test"]))
                ->assertCreated();
        }

        $this->postJson('/api/v1/public/website-quote', $this->validPayload(['email' => 'ada-overflow@example.test']))
            ->assertStatus(429);
    }

    public function test_notifications_are_dispatched_to_prospect_and_staff(): void
    {
        Notification::fake();

        $admin = User::factory()->create(['role' => 'super_admin']);

        $response = $this->postJson('/api/v1/public/website-quote', $this->validPayload())->assertCreated();
        $reference = $response->json('data.reference');
        $quote = WebsiteQuoteRequest::where('reference', $reference)->firstOrFail();

        Notification::assertSentOnDemand(
            WebsiteQuoteReceived::class,
            fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === $quote->email
        );

        Notification::assertSentTo($admin, NaiTalkWebsiteQuoteSubmitted::class);
    }

    public function test_api_response_has_the_expected_structure(): void
    {
        $this->postJson('/api/v1/public/website-quote', $this->validPayload())
            ->assertCreated()
            ->assertJsonStructure([
                'status',
                'message',
                'data' => ['reference'],
            ]);
    }
}
