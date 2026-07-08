<?php

namespace App\Services\Payments;

use App\Models\Invoice;
use App\Models\Payment;
use App\Services\Provisioning\IspConfigProvisioningService;
use Illuminate\Support\Facades\DB;

class PaymentFulfillmentService
{
    public function __construct(private readonly IspConfigProvisioningService $provisioning)
    {
    }

    /**
     * Marks an invoice + payment as paid and unblocks provisioning. Safe to call
     * more than once for the same invoice (webhook + callback can both fire).
     */
    public function markInvoicePaid(Invoice $invoice, Payment $payment, int $amountKobo, array $gatewayPayload = []): void
    {
        if ($invoice->status === 'paid') {
            return;
        }

        DB::transaction(function () use ($invoice, $payment, $amountKobo, $gatewayPayload) {
            $payment->forceFill([
                'status' => 'paid',
                'amount_kobo' => $amountKobo,
                'paid_at' => now(),
                'gateway_payload' => $gatewayPayload,
            ])->save();

            $invoice->forceFill([
                'status' => 'paid',
                'amount_paid_kobo' => $amountKobo,
                'paid_at' => now()->toDateString(),
            ])->save();

            $invoice->order?->forceFill(['status' => 'completed'])->save();

            $services = $invoice->order ? $invoice->order->hostingServices()->get() : collect();

            foreach ($services as $service) {
                $service->forceFill([
                    'status' => 'awaiting_provisioning',
                    'provisioning_status' => 'awaiting_provisioning',
                ])->save();
            }
        });

        $services = $invoice->order ? $invoice->order->hostingServices()->get() : collect();

        foreach ($services as $service) {
            $this->provisioning->queueProvisioning($service);
        }
    }

    public function markPaymentFailed(Payment $payment, array $gatewayPayload = []): void
    {
        $payment->forceFill([
            'status' => 'failed',
            'gateway_payload' => $gatewayPayload,
        ])->save();
    }
}
