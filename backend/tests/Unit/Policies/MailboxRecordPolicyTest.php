<?php

namespace Tests\Unit\Policies;

use App\Models\MailboxRecord;
use App\Policies\MailboxRecordPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\TestCase;

class MailboxRecordPolicyTest extends TestCase
{
    use CreatesHostingFixtures, RefreshDatabase;

    public function test_create_is_denied_once_the_plan_limit_is_reached(): void
    {
        $service = $this->createProvisionableHostingService(['max_email_accounts' => 1], ['status' => 'active']);
        $policy = new MailboxRecordPolicy;

        $this->assertTrue($policy->create($service->client->user, $service));

        MailboxRecord::query()->create([
            'hosting_service_id' => $service->id,
            'email_address' => 'a@example.test',
            'status' => 'active',
        ]);

        $this->assertFalse($policy->create($service->client->user, $service));
    }

    public function test_create_is_denied_when_the_plan_has_no_email_accounts(): void
    {
        $service = $this->createProvisionableHostingService(['max_email_accounts' => 0], ['status' => 'active']);
        $policy = new MailboxRecordPolicy;

        $this->assertFalse($policy->create($service->client->user, $service));
    }

    public function test_a_non_owner_cannot_view_or_update_a_mailbox(): void
    {
        $service = $this->createProvisionableHostingService([], ['status' => 'active']);
        $other = $this->createProvisionableHostingService();

        $mailbox = MailboxRecord::query()->create([
            'hosting_service_id' => $service->id,
            'email_address' => 'owner@example.test',
            'status' => 'active',
        ]);

        $policy = new MailboxRecordPolicy;

        $this->assertFalse($policy->view($other->client->user, $mailbox));
        $this->assertFalse($policy->update($other->client->user, $mailbox));
        $this->assertTrue($policy->view($service->client->user, $mailbox));
    }
}
