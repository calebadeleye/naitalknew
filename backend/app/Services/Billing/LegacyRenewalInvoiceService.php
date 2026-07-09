<?php

namespace App\Services\Billing;

use App\Models\HostingService;
use App\Models\Invoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Generates yearly renewal invoices for legacy (ISPConfig-imported) hosting
 * services — always Hosting Renewal + SSL Renewal line items, no order
 * attached (legacy renewals aren't checkout orders).
 */
class LegacyRenewalInvoiceService
{
    public function generate(HostingService $service): Invoice
    {
        $plan = $service->hostingPlan;

        if (! $plan || $plan->plan_type !== 'legacy') {
            throw new RuntimeException('generate() only supports hosting services on the Legacy Hosting + SSL package.');
        }

        $hostingAmountKobo = (int) ($plan->hosting_amount_kobo ?? 2_500_000);
        $sslAmountKobo = (int) ($plan->ssl_amount_kobo ?? 1_500_000);
        $totalKobo = $hostingAmountKobo + $sslAmountKobo;

        $dueAt = $service->next_invoice_date ?? now()->addDays(7);

        return DB::transaction(function () use ($service, $hostingAmountKobo, $sslAmountKobo, $totalKobo, $dueAt) {
            return Invoice::query()->create([
                'client_id' => $service->client_id,
                'order_id' => null,
                'hosting_service_id' => $service->id,
                'invoice_number' => 'INV-LEGACY-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
                'status' => 'unpaid',
                'subtotal_kobo' => $totalKobo,
                'discount_kobo' => 0,
                'tax_kobo' => 0,
                'total_kobo' => $totalKobo,
                'issued_at' => now()->toDateString(),
                'due_at' => $dueAt->toDateString(),
                'line_items' => [
                    [
                        'description' => 'Hosting Renewal',
                        'quantity' => 1,
                        'unit_price_kobo' => $hostingAmountKobo,
                        'total_kobo' => $hostingAmountKobo,
                    ],
                    [
                        'description' => 'SSL Renewal',
                        'quantity' => 1,
                        'unit_price_kobo' => $sslAmountKobo,
                        'total_kobo' => $sslAmountKobo,
                    ],
                ],
            ]);
        });
    }
}
