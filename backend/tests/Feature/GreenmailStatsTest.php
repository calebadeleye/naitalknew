<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class GreenmailStatsTest extends TestCase
{
    use FakesIspConfig, RefreshDatabase;

    public function test_it_counts_client_businesses_and_active_mailboxes_but_not_our_own(): void
    {
        config(['app.url' => 'https://www.naitalk.com']);
        $isp = $this->fakeIspConfig();
        $sid = $isp->login();
        foreach (['info@elinthgroup.com', 'hr@elinthgroup.com', 'hello@utme.com.ng', 'info@naitalk.com'] as $email) {
            $isp->mailUserAdd($sid, 1, ['email' => $email, 'postfix' => 'y']);
        }
        $isp->mailUserAdd($sid, 1, ['email' => 'old@closed.com', 'postfix' => 'n']);

        $this->getJson('/api/v1/public/greenmail/stats')->assertOk()->assertExactJson(['businesses' => 2, 'mailboxes' => 3]);
    }
}
