<?php

namespace Tests\Feature;

use App\Services\Domains\Registrars\CloudflareRegistrarService;
use App\Services\Domains\Registrars\Data\DomainOperationStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CloudflareRegistrarServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.cloudflare.sandbox_mode' => false]);
        config(['services.cloudflare.account_id' => 'THE-ACCOUNT-ID']);
        config(['services.cloudflare.registrar_api_token' => 'A-TOKEN']);
        config(['services.cloudflare.base_url' => 'https://cloudflare.test/client/v4']);
    }

    public function test_list_registrations_normalizes_realistic_cloudflare_json_into_dtos(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => [
                    [
                        'id' => 'domain-1',
                        'name' => 'example.com',
                        'auto_renew' => true,
                        'created_at' => '2026-01-01T00:00:00Z',
                        'expires_at' => '2027-01-01T00:00:00Z',
                        'name_servers' => ['ns1.cloudflare.com', 'ns2.cloudflare.com'],
                        'registrant_contact' => ['email' => 'should-never-appear@example.com'],
                    ],
                ],
                'result_info' => ['page' => 1, 'per_page' => 50, 'count' => 1, 'total_count' => 1],
            ], 200),
        ]);

        $page = app(CloudflareRegistrarService::class)->listRegistrations();

        $this->assertCount(1, $page->items);
        $this->assertFalse($page->hasMore);
        $item = $page->items[0];
        $this->assertSame('example.com', $item->domainName);
        $this->assertSame('.com', $item->tld);
        $this->assertTrue($item->autoRenewEnabled);
        $this->assertSame(['ns1.cloudflare.com', 'ns2.cloudflare.com'], $item->nameservers);
        $this->assertArrayNotHasKey('registrant_contact', $item->providerMetadata);
    }

    public function test_pagination_cursor_propagates_to_the_next_page(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => array_fill(0, 50, ['id' => 'x', 'name' => 'example.com']),
                'result_info' => ['page' => 1, 'per_page' => 50, 'count' => 50, 'total_count' => 120],
            ], 200),
        ]);

        $page = app(CloudflareRegistrarService::class)->listRegistrations();

        $this->assertTrue($page->hasMore);
        $this->assertSame('2', $page->nextCursor);
    }

    public function test_malformed_response_does_not_crash_and_skips_unusable_records(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => [
                    ['id' => 'no-name-here'],
                    ['id' => 'domain-2', 'name' => 'valid.com'],
                ],
                'result_info' => ['page' => 1, 'per_page' => 50, 'count' => 2, 'total_count' => 2],
            ], 200),
        ]);

        $page = app(CloudflareRegistrarService::class)->listRegistrations();

        $this->assertCount(1, $page->items);
        $this->assertSame('valid.com', $page->items[0]->domainName);
    }

    public function test_unsupported_tld_is_surfaced_via_availability_result_not_a_crash(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response([
                'success' => true,
                'result' => ['id' => 'x', 'name' => 'example.ng', 'available' => false, 'can_register' => false],
            ], 200),
        ]);

        $result = app(CloudflareRegistrarService::class)->checkAvailability('example.ng');

        $this->assertFalse($result->tldSupported);
    }

    public function test_missing_domain_returns_null_not_an_exception(): void
    {
        Http::fake([
            'cloudflare.test/*' => Http::response(['success' => false, 'errors' => [['message' => 'not found']]], 404),
        ]);

        $result = app(CloudflareRegistrarService::class)->getRegistration('missing.com');

        $this->assertNull($result);
    }

    public function test_renew_returns_pending_status_since_completion_is_confirmed_by_a_later_sync(): void
    {
        config(['services.cloudflare.sandbox_mode' => true]);
        Http::fake();

        $result = app(CloudflareRegistrarService::class)->renew('example.com');

        $this->assertSame(DomainOperationStatus::Pending, $result->status);
    }
}
