<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Payment;
use App\Notifications\ClientAccountDeactivated;
use App\Notifications\ClientAccountRestored;
use App\Notifications\ClientAccountSuspended;
use App\Notifications\ClientNotificationFailed;
use App\Notifications\HostingDeletedFromIspConfig;
use App\Notifications\HostingExpiredNotice;
use App\Notifications\HostingFinalDeletionWarning;
use App\Notifications\HostingProvisioningFailed;
use App\Notifications\HostingRenewalReminder;
use App\Notifications\HostingSuspendedGracePeriodEnded;
use App\Notifications\IspConfigActionFailed;
use App\Notifications\NaiTalkHostingProvisioned;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Notifications\NaiTalkPaymentProofUploaded;
use App\Notifications\NaiTalkVerificationCode;
use App\Notifications\WebsiteHostingDeactivated;
use App\Notifications\WebsiteHostingReactivated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Tests\TestCase;

/**
 * Every application email is a Notification rendered through the shared
 * Laravel markdown mail views (resources/views/vendor/mail/... and
 * resources/views/vendor/notifications/email.blade.php) — there are no
 * custom Mailable classes. Restyling those shared views therefore re-skins
 * every email at once without touching a single Notification class, which
 * is what this test asserts: original wording/subjects/links survive
 * untouched, while the new NAI TALK branding appears in the rendered HTML.
 */
class EmailBrandingTest extends TestCase
{
    use RefreshDatabase;

    private Client $client;

    private Invoice $invoice;

    private HostingService $service;

    private Payment $payment;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed();

        $this->client = Client::query()->with('user')->where('client_code', 'CLT-202607-JOHN')->firstOrFail();
        $this->invoice = Invoice::query()->with('order.items')->where('invoice_number', 'INV-2026-0321')->firstOrFail();
        $this->service = HostingService::query()->with('hostingPlan')->where('service_number', 'SRV-2026-001')->firstOrFail();
        $this->payment = Payment::query()->with(['client.user', 'invoice'])->where('reference', 'PAY-SEED-0')->firstOrFail();
    }

    /**
     * @return array<string, array{0: Notification, 1: string, 2: string[], 3: string}>
     */
    private function cases(): array
    {
        $notifiable = $this->client->user;

        return [
            'invoice created' => [
                new NaiTalkInvoiceCreated($this->invoice),
                "Your NAI TALK invoice {$this->invoice->invoice_number}",
                ['Thanks for your order.', "Invoice number:</strong> {$this->invoice->invoice_number}", 'Pay Invoice'],
                'Invoice Notification',
            ],
            'payment proof uploaded' => [
                new NaiTalkPaymentProofUploaded($this->payment),
                "Proof of payment uploaded for {$this->payment->invoice->invoice_number}",
                ['A client has uploaded proof of a bank transfer', 'Review Payment'],
                'Payment Proof Received',
            ],
            'hosting renewal reminder' => [
                new HostingRenewalReminder($this->service, 7),
                'Your NAI TALK hosting renews in 7 days',
                ['due for renewal in 7 days', $this->service->primary_domain],
                'Hosting Renewal Reminder',
            ],
            'hosting expired notice' => [
                new HostingExpiredNotice($this->service),
                'Your NAI TALK hosting has expired',
                ['has expired', 'Renew Now'],
                'Hosting Expiry Notice',
            ],
            'hosting final deletion warning' => [
                new HostingFinalDeletionWarning($this->service, 5, $this->invoice),
                'Final Notice: Your website hosting will be deleted soon',
                ['permanently removed from our hosting server in 5 days', 'Pay Now'],
                'Final Deletion Warning',
            ],
            'hosting suspended grace period ended' => [
                new HostingSuspendedGracePeriodEnded($this->service),
                'Your NAI TALK hosting has been suspended',
                ['grace period has ended', 'Renew Now'],
                'Hosting Suspended',
            ],
            'hosting deleted from ispconfig' => [
                new HostingDeletedFromIspConfig($this->service),
                'Your website hosting has been removed',
                ['renewal was not completed within the grace period'],
                'Website Removed Notice',
            ],
            'hosting provisioned' => [
                new NaiTalkHostingProvisioned($this->service),
                'Your NAI TALK hosting is live — thank you!',
                ['Thank you for choosing NAI TALK SERVICES', 'Manage Your Hosting'],
                'Hosting Provisioned',
            ],
            'hosting provisioning failed' => [
                new HostingProvisioningFailed($this->service, 'ISPConfig timeout'),
                "Hosting provisioning failed for {$this->service->service_number}",
                ['exhausting all retries', 'ISPConfig timeout', 'Review in Admin Panel'],
                'Provisioning Issue',
            ],
            'website deactivated' => [
                new WebsiteHostingDeactivated($this->service, 'non_payment', 'Invoice overdue 30 days'),
                'Your website hosting has been deactivated',
                ['non_payment', 'Invoice overdue 30 days'],
                'Website Deactivated',
            ],
            'website reactivated' => [
                new WebsiteHostingReactivated($this->service),
                'Your website hosting has been reactivated',
                ['has been reactivated'],
                'Website Reactivated',
            ],
            'client account suspended' => [
                new ClientAccountSuspended('non_payment', 'Overdue invoice', '2026-08-01'),
                'Your NAI TALK account has been suspended',
                ['non_payment', 'Overdue invoice', '2026-08-01'],
                'Account Suspension Notice',
            ],
            'client account deactivated' => [
                new ClientAccountDeactivated('client_request', 'Client asked to close account', null),
                'Your NAI TALK account has been deactivated',
                ['client_request', 'Client asked to close account', 'immediately'],
                'Account Deactivation Notice',
            ],
            'client account restored' => [
                new ClientAccountRestored,
                'Your NAI TALK account has been restored',
                ['has been restored and is active again'],
                'Account Restored',
            ],
            'client notification failed' => [
                new ClientNotificationFailed($this->client, 'HostingExpiredNotice', 'Your NAI TALK hosting has expired', 'SMTP timeout'),
                'Client email failed to send: Your NAI TALK hosting has expired',
                ['SMTP timeout', 'Review Client'],
                'Notification Delivery Failed',
            ],
            'ispconfig action failed' => [
                new IspConfigActionFailed($this->service, 'deactivate_website', 'Connection refused'),
                'ISPConfig action failed: deactivate_website',
                ['Connection refused', 'Review in Admin Panel'],
                'Action Failed Notice',
            ],
            'verification code' => [
                new NaiTalkVerificationCode('482913'),
                'Your NAI TALK verification code',
                ['482913', 'expires in 15 minutes'],
                'Verification Code',
            ],
        ];
    }

    public function test_every_notification_renders_with_naitalk_branding_and_unchanged_content(): void
    {
        $notifiable = $this->client->user;

        foreach ($this->cases() as $label => [$notification, $expectedSubject, $expectedSubstrings, $expectedNoticeTitle]) {
            /** @var MailMessage $mail */
            $mail = $notification->toMail($notifiable);

            $this->assertSame($expectedSubject, $mail->subject, "[$label] subject changed unexpectedly.");

            // Render exactly how MailChannel does it in production, including the
            // "__laravel_notification" data MailChannel::additionalMessageData()
            // injects — that's what the notice strip's title lookup relies on.
            $data = array_merge($mail->data(), ['__laravel_notification' => get_class($notification)]);
            $html = app(\Illuminate\Mail\Markdown::class)->theme($mail->theme ?? 'default')
                ->render($mail->markdown, $data)
                ->toHtml();

            foreach ($expectedSubstrings as $substring) {
                $this->assertStringContainsString(
                    $substring,
                    $html,
                    "[$label] expected original content \"$substring\" to survive the restyle."
                );
            }

            // Branding: logo, no old plain-text wordmark link, brand slogan, green notice strip with a category title.
            $this->assertStringContainsString('assets/email/naitalk-logo.png', $html, "[$label] NAITALK logo missing from header.");
            $this->assertStringContainsString('we build', $html, "[$label] brand slogan missing.");
            $this->assertStringContainsString('notice-strip', $html, "[$label] compact notice strip missing.");
            $this->assertStringContainsString($expectedNoticeTitle, $html, "[$label] notice strip title incorrect.");
            $this->assertStringNotContainsString('laravel.com/img/notification-logo', $html, "[$label] default Laravel logo leaked into header.");

            // Support section + branded footer with the approved contact details.
            $this->assertStringContainsString('Contact Support', $html, "[$label] support section missing.");
            $this->assertStringContainsString('info@naitalk.com', $html, "[$label] footer support email missing.");
            $this->assertStringContainsString('07087057654', $html, "[$label] footer phone missing.");
            $this->assertStringContainsString('www.naitalk.com', $html, "[$label] footer website missing.");
            $this->assertStringContainsString('7 Unity Rd, Off Command Rd, Ikola, Lagos', $html, "[$label] footer address missing.");
            $this->assertStringContainsString('This is an automated message, please do not reply.', $html, "[$label] automated-message notice missing.");
            $this->assertStringContainsString((string) date('Y'), $html, "[$label] footer copyright year missing.");

            // Green CTA buttons must use the brand green, not Laravel's default black/blue.
            if (str_contains($html, 'class="button')) {
                $this->assertStringContainsString('#159a34', $html, "[$label] CTA button is not using the brand green.");
            }
        }
    }

    public function test_action_button_links_are_preserved_verbatim(): void
    {
        $notifiable = $this->client->user;
        $mail = (new NaiTalkInvoiceCreated($this->invoice))->toMail($notifiable);

        $payUrl = rtrim(config('app.frontend_url'), '/').'/client/orders/'.$this->invoice->order->order_number;

        $this->assertSame($payUrl, $mail->actionUrl);
        $html = $mail->render()->toHtml();
        $this->assertStringContainsString($payUrl, $html);
    }

    public function test_plain_text_email_still_contains_original_content_and_new_footer(): void
    {
        $notifiable = $this->client->user;
        $mail = (new HostingExpiredNotice($this->service))->toMail($notifiable);

        $text = app(\Illuminate\Mail\Markdown::class)->theme($mail->theme ?? 'default')
            ->renderText($mail->markdown, $mail->data())
            ->toHtml();

        $this->assertStringContainsString('Hosting for the following website has expired.', $text);
        $this->assertStringContainsString($this->service->primary_domain, $text);
        $this->assertStringContainsString('info@naitalk.com', $text);
        $this->assertStringContainsString('This is an automated message, please do not reply.', $text);
    }
}
