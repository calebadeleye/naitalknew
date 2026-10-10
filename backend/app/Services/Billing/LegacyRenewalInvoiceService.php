<?php

namespace App\Services\Billing;

use App\Models\HostingService;
use App\Models\Invoice;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Generates yearly renewal invoices for legacy (ISPConfig-imported) hosting
 * services — the hosting price only (no separate SSL line since 2026-10-10), no order
 * attached (legacy renewals aren't checkout orders).
 */
class LegacyRenewalInvoiceService
{
    public function __construct(
        private readonly VatCalculator $vatCalculator = new VatCalculator,
        private readonly ClientNotifier $notifier = new ClientNotifier,
    ) {
    }

    public function generate(HostingService $service): Invoice
    {
        $plan = $service->hostingPlan;

        if (! $plan || $plan->plan_type !== 'legacy') {
            throw new RuntimeException('generate() only supports hosting services on the Legacy Hosting + SSL package.');
        }

        $hostingAmountKobo = (int) ($plan->hosting_amount_kobo ?? 2_500_000);
        $subtotalKobo = $hostingAmountKobo;
        $vat = $this->vatCalculator->calculate($subtotalKobo);

        $dueAt = $service->next_invoice_date ?? now()->addDays(7);

        $invoice = DB::transaction(function () use ($service, $hostingAmountKobo, $subtotalKobo, $vat, $dueAt) {
            return Invoice::query()->create([
                'client_id' => $service->client_id,
                'order_id' => null,
                'hosting_service_id' => $service->id,
                'invoice_number' => 'INV-LEGACY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
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
                        'description' => 'Hosting Renewal',
                        'quantity' => 1,
                        'unit_price_kobo' => $hostingAmountKobo,
                        'total_kobo' => $hostingAmountKobo,
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
}
