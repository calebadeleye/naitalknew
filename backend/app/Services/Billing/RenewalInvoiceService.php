<?php

namespace App\Services\Billing;

use App\Models\HostingService;
use App\Models\Invoice;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Generates a renewal invoice for a standard (checkout-originated, non-legacy)
 * hosting service coming up for renewal. Mirrors LegacyRenewalInvoiceService's
 * convention of order_id = null — a renewal is billed against the hosting
 * service directly, not the original checkout order, so it can never be
 * mistaken for a first-time-provisioning order by IspConfigProvisioningService.
 */
class RenewalInvoiceService
{
    public function __construct(
        private readonly VatCalculator $vatCalculator = new VatCalculator,
        private readonly ClientNotifier $notifier = new ClientNotifier,
    ) {
    }

    public function generateForRenewal(HostingService $service): Invoice
    {
        // HostingService::amount_kobo is VAT-inclusive (CheckoutService stores
        // the checkout total there) — renewing at the plan's current price
        // avoids double-applying VAT on top of an already VAT-inclusive figure,
        // and means a plan price change is honoured on renewal too.
        $plan = $service->hostingPlan;
        $subtotalKobo = $plan
            ? (int) ($service->billing_cycle === 'monthly' ? $plan->monthly_price_kobo : $plan->annual_price_kobo)
            : (int) round($service->amount_kobo / (1 + (float) config('billing.vat_rate')));
        $vat = $this->vatCalculator->calculate($subtotalKobo);
        $dueAt = $service->renews_at ?? now()->addDays(7);

        $invoice = DB::transaction(function () use ($service, $subtotalKobo, $vat, $dueAt) {
            return Invoice::query()->create([
                'client_id' => $service->client_id,
                'order_id' => null,
                'hosting_service_id' => $service->id,
                'invoice_number' => 'INV-RENEWAL-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'status' => 'unpaid',
                'reconciliation_status' => 'pending',
                'subtotal_kobo' => $subtotalKobo,
                'discount_kobo' => 0,
                'tax_kobo' => $vat['vat_amount_kobo'],
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $vat['total_kobo'],
                'outstanding_amount_kobo' => $vat['total_kobo'],
                'issued_at' => now()->toDateString(),
                'due_at' => $dueAt->toDateString(),
                'line_items' => [
                    [
                        'description' => $service->hostingPlan?->name.' Hosting Renewal — '.$service->primary_domain,
                        'quantity' => 1,
                        'unit_price_kobo' => $subtotalKobo,
                        'total_kobo' => $subtotalKobo,
                    ],
                ],
            ]);
        });

        if ($service->client) {
            $this->notifier->notify(
                $service->client,
                new NaiTalkInvoiceCreated($invoice),
                'invoice_created',
                "Your NAI TALK invoice {$invoice->invoice_number}",
                $service
            );
        }

        return $invoice;
    }

    /**
     * A service is due for renewal invoicing once we're within the lead
     * window and it doesn't already have an unpaid/partially-paid invoice
     * for the current renewal cycle (dedupe against duplicate daily runs).
     */
    public function hasPendingRenewalInvoice(HostingService $service): bool
    {
        return Invoice::query()
            ->where('hosting_service_id', $service->id)
            ->whereNull('order_id')
            ->whereIn('status', ['unpaid', 'partially_paid'])
            ->where('due_at', $service->renews_at)
            ->exists();
    }
}
