<?php

namespace Tests\Feature;

use App\Jobs\SendDomainExpiryReminderJob;
use App\Models\Domain;
use App\Notifications\NaiTalkDomainExpiryReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\CreatesDomainFixtures;
use Tests\TestCase;

class DomainExpiryReminderTest extends TestCase
{
    use CreatesDomainFixtures, RefreshDatabase;

    private function createDomain(string $email, string $domainName, int $daysToExpiry): Domain
    {
        ['client' => $client] = $this->registerVerifiedDomainClient($email);

        return Domain::query()->create([
            'client_id' => $client->id,
            'domain_name' => $domainName,
            'tld' => '.com',
            'source' => 'spaceship_registered',
            'provider' => 'spaceship',
            'status' => 'active',
            'registration_status' => 'registered',
            'auto_renew' => false,
            'expires_at' => now()->addDays($daysToExpiry),
        ]);
    }

    public function test_reminder_is_sent_30_days_before_expiry_and_not_duplicated_on_a_rerun(): void
    {
        Notification::fake();
        $domain = $this->createDomain('expiry-30@example.test', 'expiring30.com', 30);

        app()->call([app(SendDomainExpiryReminderJob::class), 'handle']);

        Notification::assertSentToTimes($domain->client->user, NaiTalkDomainExpiryReminder::class, 1);

        // Re-running the same day's sweep must not double-send.
        app()->call([app(SendDomainExpiryReminderJob::class), 'handle']);

        Notification::assertSentToTimes($domain->client->user, NaiTalkDomainExpiryReminder::class, 1);
    }

    public function test_reminder_is_not_sent_for_a_domain_outside_every_reminder_window(): void
    {
        Notification::fake();
        $domain = $this->createDomain('expiry-none@example.test', 'notexpiringsoon.com', 45);

        app()->call([app(SendDomainExpiryReminderJob::class), 'handle']);

        Notification::assertNotSentTo($domain->client->user, NaiTalkDomainExpiryReminder::class);
    }

    public function test_reminder_is_sent_on_the_expiry_date_itself(): void
    {
        Notification::fake();
        $domain = $this->createDomain('expiry-0@example.test', 'expirestoday.com', 0);

        app()->call([app(SendDomainExpiryReminderJob::class), 'handle']);

        Notification::assertSentTo($domain->client->user, NaiTalkDomainExpiryReminder::class, fn ($n) => $n->daysBeforeExpiry === 0);
    }
}
