<?php

namespace Tests\Feature;

use App\Jobs\ProvisionHostingServiceJob;
use App\Models\HostingUsageSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class ServerCapacityTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_admin_sees_active_websites_per_package_space_promised_used_and_disk_left(): void
    {
        $this->fakeIspConfig();
        $services = collect([1, 2])->map(function () {
            $service = $this->createProvisionableHostingService([], ['status' => 'active']);
            ProvisionHostingServiceJob::dispatch($service->id);

            return $service->fresh();
        });
        $services[1]->forceFill(['status' => 'suspended'])->save();

        foreach ($services as $i => $service) {
            // An older reading must be ignored in favour of the latest one.
            HostingUsageSnapshot::query()->create(['hosting_service_id' => $service->id, 'disk_used_mb' => 1, 'disk_quota_mb' => 1, 'captured_at' => now()->subDay()]);
            HostingUsageSnapshot::query()->create(['hosting_service_id' => $service->id, 'disk_used_mb' => 300 + $i, 'disk_quota_mb' => 10240, 'captured_at' => now()]);
        }

        $admin = User::factory()->create(['role' => 'super_admin', 'account_status' => 'active', 'email_verified_at' => now(), 'password' => 'password']);
        $token = $this->postJson('/api/v1/auth/login', ['email' => $admin->email, 'password' => 'password'])->assertOk()->json('token');

        $response = $this->withToken($token)->getJson('/api/v1/admin/server-capacity')->assertOk();

        $response->assertJsonPath('websites.active', 1)
            ->assertJsonPath('websites.suspended_or_expired', 1)
            ->assertJsonPath('storage.allocated_mb', 20480)
            ->assertJsonPath('storage.used_by_sites_mb', 601);
        $this->assertGreaterThan(0, $response->json('disk.free_mb'));
        $this->assertSame(1, $response->json('packages.0.active'));
    }

    public function test_clients_cannot_see_server_capacity(): void
    {
        $this->fakeIspConfig();
        $service = $this->createProvisionableHostingService();
        $user = $service->client->user;
        $user->forceFill(['password' => 'password'])->save();
        $token = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk()->json('token');

        $this->withToken($token)->getJson('/api/v1/admin/server-capacity')->assertForbidden();
    }
}
