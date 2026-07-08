<?php

namespace Tests\Unit\Policies;

use App\Models\User;
use App\Policies\HostingServicePolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class HostingServicePolicyTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    public function test_owner_can_view_their_own_service(): void
    {
        $service = $this->createProvisionableHostingService();
        $policy = new HostingServicePolicy;

        $this->assertTrue($policy->view($service->client->user, $service));
    }

    public function test_a_different_client_cannot_view_the_service(): void
    {
        $service = $this->createProvisionableHostingService();
        $other = $this->createProvisionableHostingService();
        $policy = new HostingServicePolicy;

        $this->assertFalse($policy->view($other->client->user, $service));
    }

    public function test_manage_requires_active_status(): void
    {
        $service = $this->createProvisionableHostingService([], ['status' => 'suspended']);
        $policy = new HostingServicePolicy;

        $this->assertFalse($policy->manage($service->client->user, $service));

        $service->forceFill(['status' => 'active'])->save();

        $this->assertTrue($policy->manage($service->client->user, $service));
    }

    public function test_admin_bypasses_ownership_via_gate(): void
    {
        $service = $this->createProvisionableHostingService();
        $admin = User::factory()->create(['role' => 'super_admin']);

        $this->assertTrue(Gate::forUser($admin)->allows('view', $service));
    }
}
