<?php

namespace App\Services\Domains;

use App\Models\Client;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\DomainTransfer;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Billing\VatCalculator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * The domain-purchase equivalent of CheckoutService — builds the real
 * Order/OrderItem/Invoice rows (VAT via VatCalculator, exactly like every
 * other invoice) for domain-only, domain+hosting, and domain-transfer
 * orders, so nothing downstream (InvoiceBreakdown, the PDF, emails, wallet
 * reconciliation) needs to special-case a domain line item.
 */
class DomainOrderService
{
    public function __construct(
        private readonly VatCalculator $vatCalculator = new VatCalculator,
        private readonly DomainPricingService $pricing = new DomainPricingService,
    ) {
    }

    /**
     * Flow 1: Domain Only.
     */
    public function createDomainOnlyOrder(Client $client, string $domainName): array
    {
        return $this->createOrder($client, $domainName, hostingPayload: null);
    }

    /**
     * Flow 2: Domain + Hosting.
     */
    public function createDomainAndHostingOrder(Client $client, string $domainName, array $hostingPayload): array
    {
        return $this->createOrder($client, $domainName, $hostingPayload);
    }

    /**
     * Flow 4: Domain Transfer. $eppCode is encrypted at rest via
     * DomainTransfer's `encrypted` cast — never stored/logged in the clear.
     */
    public function createTransferOrder(Client $client, string $domainName, string $eppCode): array
    {
        $domainName = $this->normalizeDomain($domainName);
        $tld = $this->extractTld($domainName);
        $breakdown = $this->pricing->breakdownFor($tld, 'transfer');

        if (! $breakdown) {
            throw new RuntimeException("Transfer pricing for {$tld} is not configured yet. Please contact support.");
        }

        $result = DB::transaction(function () use ($client, $domainName, $tld, $eppCode, $breakdown) {
            $this->promoteToBillingClient($client);

            $domain = Domain::query()->firstOrCreate(
                ['client_id' => $client->id, 'domain_name' => $domainName],
                [
                    'tld' => $tld,
                    'source' => 'spaceship_transferred',
                    'provider' => 'spaceship',
                    'status' => 'pending',
                    'registration_status' => null,
                    'transfer_status' => 'transfer_pending_payment',
                    'auto_renew' => true,
                ]
            );

            $order = $this->createOrderRecord($client, $breakdown);
            $this->createOrderItem($order, DomainOrder::class, null, "Domain Transfer — {$domainName}", $breakdown['taxable_kobo']);
            $invoice = $this->createInvoiceRecord($client, $order, $breakdown);

            $domainOrder = DomainOrder::query()->create([
                'client_id' => $client->id,
                'domain_id' => $domain->id,
                'order_id' => $order->id,
                'hosting_service_id' => null,
                'domain_name' => $domainName,
                'order_type' => 'transfer',
                'provider' => 'spaceship',
                'invoice_id' => $invoice->id,
                'status' => 'pending_payment',
                'price_kobo' => $breakdown['taxable_kobo'],
                'vat_amount_kobo' => $breakdown['vat_amount_kobo'],
                'total_amount_kobo' => $breakdown['total_kobo'],
            ]);

            $transfer = DomainTransfer::query()->create([
                'client_id' => $client->id,
                'domain_id' => $domain->id,
                'domain_name' => $domainName,
                'provider' => 'spaceship',
                'epp_code_encrypted' => $eppCode,
                'transfer_status' => 'transfer_pending_payment',
                'invoice_id' => $invoice->id,
            ]);

            return compact('order', 'invoice', 'domain', 'domainOrder', 'transfer');
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    /**
     * Flow 5: Buy Hosting Later for a domain the client already owns in
     * NAI TALK. Reuses the exact same HostingService creation shape as
     * CheckoutService so nothing downstream needs to know the difference.
     */
    public function addHostingToDomain(Client $client, Domain $domain, array $hostingPayload): array
    {
        if ($domain->linked_hosting_service_id) {
            throw new RuntimeException('This domain already has a hosting service linked to it.');
        }

        $result = DB::transaction(function () use ($client, $domain, $hostingPayload) {
            [$order, $invoice, $service, $hostingBreakdown] = $this->createHostingOnlyOrderRecords($client, $hostingPayload, $domain->domain_name);

            $domain->forceFill(['linked_hosting_service_id' => $service->id])->save();

            return compact('order', 'invoice', 'service', 'domain');
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    /**
     * @param  array<string, mixed>|null  $hostingPayload
     */
    private function createOrder(Client $client, string $domainName, ?array $hostingPayload): array
    {
        $domainName = $this->normalizeDomain($domainName);
        $tld = $this->extractTld($domainName);
        $domainPrice = $this->pricing->priceFor($tld);

        if (! $domainPrice) {
            throw new RuntimeException("Registration pricing for {$tld} is not configured yet. Please contact support.");
        }

        $result = DB::transaction(function () use ($client, $domainName, $tld, $domainPrice, $hostingPayload) {
            $this->promoteToBillingClient($client);

            $existing = Domain::query()->where('client_id', $client->id)->where('domain_name', $domainName)->first();

            if ($existing && in_array($existing->registration_status, ['registered', 'registration_pending', 'payment_confirmed'], true)) {
                throw new RuntimeException('You already have an order in progress or a registration for this domain.');
            }

            $domain = $existing ?: Domain::query()->create([
                'client_id' => $client->id,
                'domain_name' => $domainName,
                'tld' => $tld,
                'source' => 'spaceship_registered',
                'provider' => 'spaceship',
                'status' => 'pending',
                'registration_status' => 'pending_payment',
                'auto_renew' => true,
            ]);

            $domainSubtotal = (int) $domainPrice['registration_kobo'];
            $hostingPlan = null;
            $hostingAddOns = collect();
            $hostingSubtotal = 0;
            $billingCycle = $hostingPayload['billing_cycle'] ?? 'annual';

            if ($hostingPayload) {
                $hostingPlan = HostingPlan::query()
                    ->where('slug', $hostingPayload['plan_slug'])
                    ->where('is_active', true)
                    ->where('is_orderable', true)
                    ->firstOrFail();

                $planPrice = $billingCycle === 'monthly' ? $hostingPlan->monthly_price_kobo : $hostingPlan->annual_price_kobo;
                $hostingAddOns = HostingAddOn::query()
                    ->whereIn('slug', $hostingPayload['add_ons'] ?? [])
                    ->where('is_active', true)
                    ->get();

                $hostingSubtotal = $planPrice + $hostingPlan->setup_fee_kobo + $hostingAddOns->sum(
                    fn (HostingAddOn $addOn) => $billingCycle === 'monthly' ? $addOn->monthly_price_kobo : $addOn->annual_price_kobo
                );
            }

            $combinedSubtotal = $domainSubtotal + $hostingSubtotal;
            $vat = $this->vatCalculator->calculate($combinedSubtotal);

            $order = $this->createOrderRecord($client, $vat, $billingCycle, $hostingPayload);
            $this->createOrderItem($order, DomainOrder::class, null, "Domain Registration — {$domainName}", $domainSubtotal);

            $service = null;

            if ($hostingPlan) {
                $planItemPrice = ($billingCycle === 'monthly' ? $hostingPlan->monthly_price_kobo : $hostingPlan->annual_price_kobo) + $hostingPlan->setup_fee_kobo;
                $this->createOrderItem($order, HostingPlan::class, $hostingPlan->id, $hostingPlan->name.' Hosting', $planItemPrice);

                foreach ($hostingAddOns as $addOn) {
                    $addOnPrice = $billingCycle === 'monthly' ? $addOn->monthly_price_kobo : $addOn->annual_price_kobo;
                    $this->createOrderItem($order, HostingAddOn::class, $addOn->id, $addOn->name, $addOnPrice);
                }

                $hostingVat = $this->vatCalculator->calculate($hostingSubtotal);

                $service = HostingService::query()->create([
                    'client_id' => $client->id,
                    'hosting_plan_id' => $hostingPlan->id,
                    'order_id' => $order->id,
                    'service_number' => $this->number('SRV'),
                    'display_name' => $domainName,
                    'primary_domain' => $domainName,
                    'status' => 'pending_payment',
                    'billing_cycle' => $billingCycle,
                    'amount_kobo' => $hostingVat['total_kobo'],
                    'auto_renew_enabled' => (bool) ($hostingPayload['auto_renew'] ?? true),
                    'provisioning_status' => 'not_provisioned',
                    'renews_at' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
                    'next_due_date' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
                    'provisioning_payload' => [
                        'plan' => $hostingPlan->slug,
                        'add_ons' => $hostingAddOns->pluck('slug')->values(),
                        'domain_purchase' => true,
                    ],
                ]);
            }

            $invoice = $this->createInvoiceRecord($client, $order, $vat);

            if ($service) {
                $invoice->forceFill(['hosting_service_id' => $service->id])->save();
            }

            $domainOnlyVat = $this->vatCalculator->calculate($domainSubtotal);

            $domainOrder = DomainOrder::query()->create([
                'client_id' => $client->id,
                'domain_id' => $domain->id,
                'order_id' => $order->id,
                'hosting_service_id' => $service?->id,
                'domain_name' => $domainName,
                'order_type' => 'registration',
                'provider' => 'spaceship',
                'invoice_id' => $invoice->id,
                'status' => 'pending_payment',
                'price_kobo' => $domainSubtotal,
                'vat_amount_kobo' => $domainOnlyVat['vat_amount_kobo'],
                'total_amount_kobo' => $domainOnlyVat['total_kobo'],
            ]);

            if ($service) {
                $domain->forceFill(['linked_hosting_service_id' => $service->id])->save();
            }

            return [
                'order' => $order->load('items'),
                'invoice' => $invoice,
                'domain' => $domain->fresh(),
                'domainOrder' => $domainOrder,
                'service' => $service?->load('hostingPlan'),
            ];
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    /**
     * Generates a renewal invoice for a domain due for renewal — mirrors
     * RenewalInvoiceService's order_id = null convention (a renewal isn't a
     * checkout order). Used by the auto-renewal pipeline (RenewDomainJob).
     */
    public function createRenewalOrder(Domain $domain): array
    {
        $breakdown = $this->pricing->breakdownFor($domain->tld, 'renewal');

        if (! $breakdown) {
            throw new RuntimeException("Renewal pricing for {$domain->tld} is not configured yet.");
        }

        return DB::transaction(function () use ($domain, $breakdown) {
            $invoice = Invoice::query()->create([
                'client_id' => $domain->client_id,
                'order_id' => null,
                'invoice_number' => $this->number('INV'),
                'status' => 'unpaid',
                'reconciliation_status' => 'pending',
                'subtotal_kobo' => $breakdown['taxable_kobo'],
                'discount_kobo' => 0,
                'tax_kobo' => $breakdown['vat_amount_kobo'],
                'vat_rate' => $breakdown['vat_rate'],
                'total_kobo' => $breakdown['total_kobo'],
                'outstanding_amount_kobo' => $breakdown['total_kobo'],
                'issued_at' => now()->toDateString(),
                'due_at' => $domain->expires_at?->toDateString() ?? now()->addDays(7)->toDateString(),
                'line_items' => [[
                    'description' => "Domain Renewal — {$domain->domain_name}",
                    'quantity' => 1,
                    'unit_price_kobo' => $breakdown['taxable_kobo'],
                    'total_kobo' => $breakdown['taxable_kobo'],
                ]],
            ]);

            $domainOrder = DomainOrder::query()->create([
                'client_id' => $domain->client_id,
                'domain_id' => $domain->id,
                'order_id' => null,
                'hosting_service_id' => null,
                'domain_name' => $domain->domain_name,
                'order_type' => 'renewal',
                'provider' => 'spaceship',
                'invoice_id' => $invoice->id,
                'status' => 'pending_payment',
                'price_kobo' => $breakdown['taxable_kobo'],
                'vat_amount_kobo' => $breakdown['vat_amount_kobo'],
                'total_amount_kobo' => $breakdown['total_kobo'],
            ]);

            return compact('invoice', 'domainOrder');
        });
    }

    /**
     * Dedupe guard so the daily renewal-invoice sweep never generates a
     * second renewal invoice while one is already outstanding.
     */
    public function hasPendingRenewalOrder(Domain $domain): bool
    {
        return DomainOrder::query()
            ->where('domain_id', $domain->id)
            ->where('order_type', 'renewal')
            ->where('status', 'pending_payment')
            ->whereHas('invoice', fn ($query) => $query->whereIn('status', ['unpaid', 'partially_paid']))
            ->exists();
    }

    /**
     * @param  array<string, mixed>  $hostingPayload
     * @return array{0: Order, 1: Invoice, 2: HostingService, 3: array}
     */
    private function createHostingOnlyOrderRecords(Client $client, array $hostingPayload, string $domainName): array
    {
        $billingCycle = $hostingPayload['billing_cycle'] ?? 'annual';
        $hostingPlan = HostingPlan::query()
            ->where('slug', $hostingPayload['plan_slug'])
            ->where('is_active', true)
            ->where('is_orderable', true)
            ->firstOrFail();

        $planPrice = $billingCycle === 'monthly' ? $hostingPlan->monthly_price_kobo : $hostingPlan->annual_price_kobo;
        $hostingAddOns = HostingAddOn::query()
            ->whereIn('slug', $hostingPayload['add_ons'] ?? [])
            ->where('is_active', true)
            ->get();

        $hostingSubtotal = $planPrice + $hostingPlan->setup_fee_kobo + $hostingAddOns->sum(
            fn (HostingAddOn $addOn) => $billingCycle === 'monthly' ? $addOn->monthly_price_kobo : $addOn->annual_price_kobo
        );

        $vat = $this->vatCalculator->calculate($hostingSubtotal);
        $order = $this->createOrderRecord($client, $vat, $billingCycle, $hostingPayload);

        $planItemPrice = $planPrice + $hostingPlan->setup_fee_kobo;
        $this->createOrderItem($order, HostingPlan::class, $hostingPlan->id, $hostingPlan->name.' Hosting', $planItemPrice);

        foreach ($hostingAddOns as $addOn) {
            $addOnPrice = $billingCycle === 'monthly' ? $addOn->monthly_price_kobo : $addOn->annual_price_kobo;
            $this->createOrderItem($order, HostingAddOn::class, $addOn->id, $addOn->name, $addOnPrice);
        }

        $service = HostingService::query()->create([
            'client_id' => $client->id,
            'hosting_plan_id' => $hostingPlan->id,
            'order_id' => $order->id,
            'service_number' => $this->number('SRV'),
            'display_name' => $domainName,
            'primary_domain' => $domainName,
            'status' => 'pending_payment',
            'billing_cycle' => $billingCycle,
            'amount_kobo' => $vat['total_kobo'],
            'auto_renew_enabled' => (bool) ($hostingPayload['auto_renew'] ?? true),
            'provisioning_status' => 'not_provisioned',
            'renews_at' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
            'next_due_date' => $billingCycle === 'monthly' ? now()->addMonth()->toDateString() : now()->addYear()->toDateString(),
            'provisioning_payload' => [
                'plan' => $hostingPlan->slug,
                'add_ons' => $hostingAddOns->pluck('slug')->values(),
                'added_to_existing_domain' => true,
            ],
        ]);

        $invoice = $this->createInvoiceRecord($client, $order, $vat);
        $invoice->forceFill(['hosting_service_id' => $service->id])->save();

        return [$order, $invoice, $service, ['vat' => $vat]];
    }

    /**
     * @param  array{vat_rate: float, subtotal_kobo: int, discount_kobo: int, taxable_kobo: int, vat_amount_kobo: int, total_kobo: int}  $vat
     */
    private function createOrderRecord(Client $client, array $vat, string $billingCycle = 'annual', ?array $hostingPayload = null): Order
    {
        return Order::query()->create([
            'client_id' => $client->id,
            'order_number' => $this->number('ORD'),
            'status' => 'pending_payment',
            'billing_cycle' => $billingCycle,
            'subtotal_kobo' => $vat['subtotal_kobo'],
            'discount_kobo' => $vat['discount_kobo'],
            'tax_kobo' => $vat['vat_amount_kobo'],
            'vat_rate' => $vat['vat_rate'],
            'total_kobo' => $vat['total_kobo'],
            'accepted_terms_at' => now(),
            'metadata' => [
                'auto_renew' => (bool) ($hostingPayload['auto_renew'] ?? true),
                'payment_gateway' => $hostingPayload['payment_gateway'] ?? 'paystack',
            ],
        ]);
    }

    private function createOrderItem(Order $order, string $orderableType, ?int $orderableId, string $description, int $totalKobo): void
    {
        $order->items()->create([
            'orderable_type' => $orderableType,
            'orderable_id' => $orderableId,
            'description' => $description,
            'quantity' => 1,
            'unit_price_kobo' => $totalKobo,
            'total_kobo' => $totalKobo,
        ]);
    }

    /**
     * @param  array{vat_rate: float, subtotal_kobo: int, discount_kobo: int, taxable_kobo: int, vat_amount_kobo: int, total_kobo: int}  $vat
     */
    private function createInvoiceRecord(Client $client, Order $order, array $vat): Invoice
    {
        return Invoice::query()->create([
            'client_id' => $client->id,
            'order_id' => $order->id,
            'invoice_number' => $this->number('INV'),
            'status' => 'unpaid',
            'reconciliation_status' => 'pending',
            'subtotal_kobo' => $vat['subtotal_kobo'],
            'discount_kobo' => $vat['discount_kobo'],
            'tax_kobo' => $vat['vat_amount_kobo'],
            'vat_rate' => $vat['vat_rate'],
            'total_kobo' => $vat['total_kobo'],
            'outstanding_amount_kobo' => $vat['total_kobo'],
            'issued_at' => now()->toDateString(),
            'due_at' => now()->addDays(7)->toDateString(),
            'line_items' => $order->items()->get(['description', 'quantity', 'unit_price_kobo', 'total_kobo'])->toArray(),
        ]);
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

    public function normalizeDomain(string $domain): string
    {
        return Str::of($domain)->lower()->trim()->toString();
    }

    public function extractTld(string $domain): string
    {
        $parts = explode('.', $domain);
        array_shift($parts);

        return '.'.implode('.', $parts);
    }
}
