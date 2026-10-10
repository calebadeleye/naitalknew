<?php

namespace Tests\Feature;

use App\Jobs\GenerateRenewalInvoiceJob;
use App\Jobs\ProcessAutoRenewalPaymentJob;
use App\Jobs\SendHostingExpiryReminderJob;
use App\Models\Invoice;
use App\Models\NotificationLog;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHostingFixtures;
use Tests\Concerns\FakesIspConfig;
use Tests\TestCase;

class HostingRenewalCycleTest extends TestCase
{
    use CreatesHostingFixtures, FakesIspConfig, RefreshDatabase;

    public function test_the_renewal_invoice_goes_out_two_months_ahead_and_never_twice(): void
    {
        Notification::fake();
        $soon = $this->createProvisionableHostingService([], ['status' => 'active', 'renews_at' => now()->addDays(55)->toDateString()]);
        $later = $this->createProvisionableHostingService([], ['status' => 'active', 'renews_at' => now()->addDays(70)->toDateString()]);

        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);
        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);

        $this->assertSame(1, Invoice::query()->where('hosting_service_id', $soon->id)->count());
        $this->assertSame(0, Invoice::query()->where('hosting_service_id', $later->id)->count());
        $this->assertSame($soon->renews_at->toDateString(), Invoice::query()->where('hosting_service_id', $soon->id)->value('due_at')->toDateString());
    }

    public function test_a_service_already_past_its_renewal_date_without_an_invoice_gets_one(): void
    {
        Notification::fake();
        $overdue = $this->createProvisionableHostingService([], ['status' => 'active', 'renews_at' => now()->subDays(40)->toDateString()]);

        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);

        $this->assertSame(1, Invoice::query()->where('hosting_service_id', $overdue->id)->where('status', 'unpaid')->count());
    }

    public function test_paying_the_renewal_invoice_yourself_moves_the_renewal_date_on_from_its_due_date(): void
    {
        Notification::fake();
        $service = $this->createProvisionableHostingService([], [
            'status' => 'expired', 'renews_at' => now()->subDays(10)->toDateString(),
            'grace_period_ends_at' => now()->addDays(20)->toDateString(),
        ]);
        $dueDate = $service->renews_at->copy();

        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);
        $invoice = Invoice::query()->where('hosting_service_id', $service->id)->firstOrFail();

        app(WalletService::class)->credit($service->client, $invoice->total_kobo, 'wallet_topup');
        Sanctum::actingAs($service->client->user, [], 'sanctum');
        $this->postJson("/api/v1/client/invoices/{$invoice->invoice_number}/pay/wallet")->assertOk();

        $service->refresh();
        $this->assertSame($dueDate->copy()->addYear()->toDateString(), $service->renews_at->toDateString(), 'renewal anniversary kept, not reset to a year from today');
        $this->assertSame('active', $service->status);
        $this->assertNull($service->grace_period_ends_at);
        $this->assertDatabaseHas('provisioning_logs', ['hosting_service_id' => $service->id, 'action' => 'renewal_applied']);
    }

    public function test_reminders_stop_once_the_renewal_invoice_is_paid_and_link_to_it_while_unpaid(): void
    {
        Notification::fake();
        $unpaid = $this->createProvisionableHostingService([], ['status' => 'active', 'renews_at' => now()->addDays(30)->toDateString()]);
        $paid = $this->createProvisionableHostingService([], ['status' => 'active', 'renews_at' => now()->addDays(30)->toDateString()]);
        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);
        Invoice::query()->where('hosting_service_id', $paid->id)->update(['status' => 'paid']);

        $this->app->call([new SendHostingExpiryReminderJob, 'handle']);

        $template = 'hosting_renewal_reminder_30d_'.now()->addDays(30)->toDateString();
        $this->assertTrue(NotificationLog::query()->where('hosting_service_id', $unpaid->id)->where('template', $template)->exists());
        $this->assertFalse(NotificationLog::query()->where('hosting_service_id', $paid->id)->where('template', $template)->exists());
        Notification::assertSentTo($unpaid->client->user, \App\Notifications\HostingRenewalReminder::class, fn ($n) => $n->invoice !== null && $n->daysBeforeExpiry === 30);
    }

    public function test_reminders_go_out_a_month_before_a_week_before_and_on_the_day(): void
    {
        $this->assertSame([30, 7, 0], config('hosting_lifecycle.reminder_days_before_expiry'));
        $this->assertSame(60, config('hosting_lifecycle.renewal_invoice_lead_days'));
    }

    public function test_a_saved_card_or_wallet_is_not_charged_two_months_early(): void
    {
        Notification::fake();
        $service = $this->createProvisionableHostingService([], ['status' => 'active', 'auto_renew_enabled' => true, 'renews_at' => now()->addDays(50)->toDateString()]);
        $this->app->call([new GenerateRenewalInvoiceJob, 'handle']);
        $invoice = Invoice::query()->where('hosting_service_id', $service->id)->firstOrFail();
        app(WalletService::class)->credit($service->client, $invoice->total_kobo, 'wallet_topup');

        $this->app->call([new ProcessAutoRenewalPaymentJob, 'handle']);

        $this->assertSame('unpaid', $invoice->fresh()->status);
    }
}
