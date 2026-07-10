<?php

namespace App\Services\Billing;

use App\Models\Client;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Notifications\NaiTalkInvoiceCreated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutService
{
    public function __construct(private readonly VatCalculator $vatCalculator = new VatCalculator)
    {
    }

    public function createHostingOrder(array $payload, Client $client): array
    {
        $result = DB::transaction(function () use ($payload, $client) {
            $billingCycle = $payload['billing_cycle'] ?? 'annual';
            $plan = HostingPlan::query()
                ->where('slug', $payload['plan_slug'])
                ->where('is_active', true)
                ->where('is_orderable', true)
                ->firstOrFail();

            $this->promoteToBillingClient($client);
            $planPrice = $billingCycle === 'monthly' ? $plan->monthly_price_kobo : $plan->annual_price_kobo;
            $addOns = HostingAddOn::query()
                ->whereIn('slug', $payload['add_ons'] ?? [])
                ->where('is_active', true)
                ->get();

            $subtotal = $planPrice + $plan->setup_fee_kobo + $addOns->sum(fn (HostingAddOn $addOn) => $billingCycle === 'monthly'
                ? $addOn->monthly_price_kobo
                : $addOn->annual_price_kobo);

            $discountKobo = (int) round($subtotal * ((float) ($payload['discount_percent'] ?? 0)) / 100);
            $vat = $this->vatCalculator->calculate($subtotal, $discountKobo);
            $taxKobo = $vat['vat_amount_kobo'];
            $totalKobo = $vat['total_kobo'];

            $order = Order::query()->create([
                'client_id' => $client->id,
                'order_number' => $this->number('ORD'),
                'status' => 'pending_payment',
                'billing_cycle' => $billingCycle,
                'subtotal_kobo' => $subtotal,
                'discount_kobo' => $discountKobo,
                'tax_kobo' => $taxKobo,
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $totalKobo,
                'accepted_terms_at' => now(),
                'metadata' => [
                    'auto_renew' => (bool) ($payload['auto_renew'] ?? true),
                    'primary_domain' => $payload['primary_domain'],
                    'payment_gateway' => $payload['payment_gateway'] ?? 'paystack',
                ],
            ]);

            $order->items()->create([
                'orderable_type' => HostingPlan::class,
                'orderable_id' => $plan->id,
                'description' => $plan->name.' Hosting',
                'quantity' => 1,
                'unit_price_kobo' => $planPrice + $plan->setup_fee_kobo,
                'total_kobo' => $planPrice + $plan->setup_fee_kobo,
            ]);

            foreach ($addOns as $addOn) {
                $price = $billingCycle === 'monthly' ? $addOn->monthly_price_kobo : $addOn->annual_price_kobo;
                $order->items()->create([
                    'orderable_type' => HostingAddOn::class,
                    'orderable_id' => $addOn->id,
                    'description' => $addOn->name,
                    'quantity' => 1,
                    'unit_price_kobo' => $price,
                    'total_kobo' => $price,
                ]);
            }

            $invoice = Invoice::query()->create([
                'client_id' => $client->id,
                'order_id' => $order->id,
                'invoice_number' => $this->number('INV'),
                'status' => 'unpaid',
                'reconciliation_status' => 'pending',
                'subtotal_kobo' => $subtotal,
                'discount_kobo' => $discountKobo,
                'tax_kobo' => $taxKobo,
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $totalKobo,
                'outstanding_amount_kobo' => $totalKobo,
                'issued_at' => now()->toDateString(),
                'due_at' => now()->addDays(7)->toDateString(),
                'line_items' => $order->items()->get(['description', 'quantity', 'unit_price_kobo', 'total_kobo'])->toArray(),
            ]);

            $service = HostingService::query()->create([
                'client_id' => $client->id,
                'hosting_plan_id' => $plan->id,
                'order_id' => $order->id,
                'service_number' => $this->number('SRV'),
                'display_name' => $payload['primary_domain'],
                'primary_domain' => $payload['primary_domain'],
                'status' => 'pending_payment',
                'billing_cycle' => $billingCycle,
                'amount_kobo' => $totalKobo,
                'auto_renew_enabled' => (bool) ($payload['auto_renew'] ?? true),
                'provisioning_status' => 'not_provisioned',
                'renews_at' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
                'next_due_date' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
                'provisioning_payload' => [
                    'plan' => $plan->slug,
                    'add_ons' => $addOns->pluck('slug')->values(),
                ],
            ]);

            $invoice->forceFill(['hosting_service_id' => $service->id])->save();

            return [
                'order' => $order->load('items'),
                'invoice' => $invoice,
                'service' => $service->load('hostingPlan'),
            ];
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    private function promoteToBillingClient(Client $client): void
    {
        if (in_array($client->account_type, ['registered_user', 'prospect'], true)) {
            $client->forceFill([
                'account_type' => 'billing_client',
                'client_status' => 'active',
                'last_activity_at' => now(),
            ])->save();
        }
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
