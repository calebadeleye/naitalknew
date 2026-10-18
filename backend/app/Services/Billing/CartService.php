<?php

namespace App\Services\Billing;

use App\Models\Client;
use App\Models\Domain;
use App\Models\DomainOrder;
use App\Models\HostingAddOn;
use App\Models\HostingPlan;
use App\Models\HostingService;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ServiceOffering;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Domains\DomainNameValidator;
use App\Services\Domains\DomainPricingService;
use App\Services\Domains\SpaceshipDomainAvailabilityService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Services\Email\BusinessEmail;
use RuntimeException;

/**
 * The shopping cart. A cart is a list of lines the client collected before
 * checking out: hosting plans (for an existing domain, or with a new domain
 * registered), domain registrations, and stand-alone services (SSL).
 *
 * The browser only keeps *what* was chosen. Every price here is worked out
 * on the server — for the cart page (price()) and again, from scratch, when
 * the order is placed (checkout()) — so nothing the browser sends can change
 * what is charged. Checkout makes ONE order and ONE invoice with a line per
 * item; paying it provisions every website, queues every domain and opens
 * the setup ticket for every service, exactly as separate orders would.
 */
class CartService
{
    public const MAX_LINES = 10;

    public function __construct(
        private readonly VatCalculator $vatCalculator = new VatCalculator,
        private readonly DomainPricingService $domainPricing = new DomainPricingService,
    ) {
    }

    /**
     * Cleans and validates the cart's shape (not its prices).
     *
     * @return array<int, array<string, mixed>>
     *
     * @throws ValidationException
     */
    public function validateLines(mixed $lines): array
    {
        $domain = ['string', 'max:255', DomainNameValidator::rule()];

        $lines = is_array($lines) ? array_values($lines) : [];

        // People paste "https://www.shop.com/" — keep just the address (no scheme, path or www).
        foreach ($lines as $i => $line) {
            foreach (['primary_domain', 'domain_name', 'domain'] as $field) {
                if (is_array($line) && isset($line[$field]) && is_string($line[$field])) {
                    $lines[$i][$field] = (string) preg_replace('/^www\./', '', strtolower(trim((string) preg_replace('#^https?://|/.*$#i', '', trim($line[$field])))));
                }
            }
        }

        $data = Validator::make(['lines' => $lines], [
            'lines' => ['required', 'array', 'min:1', 'max:'.self::MAX_LINES],
            'lines.*.type' => ['required', Rule::in(['hosting', 'domain', 'service'])],
            'lines.*.plan_slug' => ['required_if:lines.*.type,hosting', 'nullable', 'string', 'max:120'],
            'lines.*.primary_domain' => array_merge(['required_if:lines.*.type,hosting', 'nullable'], $domain),
            'lines.*.add_ons' => ['nullable', 'array', 'max:20'],
            'lines.*.add_ons.*' => ['string', 'max:120'],
            'lines.*.register_domain' => ['nullable', 'boolean'],
            'lines.*.auto_renew' => ['nullable', 'boolean'],
            'lines.*.domain_name' => array_merge(['required_if:lines.*.type,domain', 'nullable'], $domain),
            'lines.*.offering' => ['required_if:lines.*.type,service', 'nullable', 'string', 'max:120'],
            'lines.*.domain' => array_merge(['nullable'], $domain),
            'lines.*.notes' => ['nullable', 'string', 'max:2000'],
        ], [
            'lines.required' => 'Your cart is empty.',
            'lines.min' => 'Your cart is empty.',
            'lines.max' => 'A cart can hold up to '.self::MAX_LINES.' items. Check out, then start another.',
            'lines.*.primary_domain.regex' => 'One of the website addresses in your cart is not valid.',
            'lines.*.domain_name.regex' => 'One of the domain names in your cart is not valid.',
            'lines.*.domain.regex' => 'One of the website addresses in your cart is not valid.',
        ])->validate();

        return $data['lines'];
    }

    /**
     * Prices every line from the live catalog.
     *
     * @param  array<int, array<string, mixed>>  $lines
     * @return array{lines: array<int, array<string, mixed>>, subtotal_kobo: int, vat_rate: float, vat_kobo: int, total_kobo: int, has_errors: bool}
     */
    public function price(Client $client, array $lines): array
    {
        $priced = [];
        $seen = [];

        foreach ($lines as $index => $line) {
            try {
                $priced[] = $this->priceLine($client, $line, $index, $seen);
            } catch (RuntimeException $exception) {
                $priced[] = ['index' => $index, 'type' => $line['type'], 'title' => $this->fallbackTitle($line), 'subtitle' => null, 'items' => [], 'subtotal_kobo' => 0, 'error' => $exception->getMessage()];
            }
        }

        $subtotal = array_sum(array_map(fn (array $line) => $line['subtotal_kobo'], $priced));
        $vat = $this->vatCalculator->calculate($subtotal);

        return [
            'lines' => $priced,
            'subtotal_kobo' => $subtotal,
            'vat_rate' => $vat['vat_rate'],
            'vat_kobo' => $vat['vat_amount_kobo'],
            'total_kobo' => $vat['total_kobo'],
            'has_errors' => collect($priced)->contains(fn (array $line) => isset($line['error'])),
        ];
    }

    /**
     * Places the order for the whole cart.
     *
     * @param  array<int, array<string, mixed>>  $lines
     * @return array{order: Order, invoice: Invoice, services: \Illuminate\Support\Collection}
     *
     * @throws ValidationException when a line can't be ordered (the message says which)
     */
    public function checkout(Client $client, array $lines, SpaceshipDomainAvailabilityService $availability): array
    {
        $quote = $this->price($client, $lines);

        if ($quote['has_errors']) {
            $first = collect($quote['lines'])->first(fn (array $line) => isset($line['error']));
            throw ValidationException::withMessages(['lines' => ["{$first['title']}: {$first['error']}"]]);
        }

        // A domain sitting in a cart can have been taken since it was searched.
        // Re-check any registration whose "available" check has expired.
        foreach ($lines as $line) {
            $registering = $this->registeredDomain($line);

            if ($registering && ! $availability->wasRecentlyVerifiedAvailable($registering)) {
                $check = $availability->search($registering);

                if (! $check['available']) {
                    throw ValidationException::withMessages(['lines' => ["{$registering} is no longer available. Remove it from your cart (or choose a different name) and try again."]]);
                }
            }
        }

        $result = DB::transaction(function () use ($client, $lines, $quote) {
            if (in_array($client->account_type, ['registered_user', 'prospect'], true)) {
                $client->forceFill(['account_type' => 'billing_client', 'client_status' => 'active', 'last_activity_at' => now()])->save();
            }

            $vat = $this->vatCalculator->calculate($quote['subtotal_kobo']);

            $order = Order::query()->create([
                'client_id' => $client->id,
                'order_number' => $this->number('ORD'),
                'status' => 'pending_payment',
                'billing_cycle' => 'annual',
                'subtotal_kobo' => $vat['subtotal_kobo'],
                'discount_kobo' => 0,
                'tax_kobo' => $vat['vat_amount_kobo'],
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $vat['total_kobo'],
                'accepted_terms_at' => now(),
                'metadata' => ['kind' => 'cart', 'line_count' => count($lines), 'payment_gateway' => 'paystack'],
            ]);

            // First pass: items and services (the invoice needs the items).
            $pendingDomains = [];
            $serviceLines = [];
            $services = collect();

            foreach ($lines as $index => $line) {
                $detail = $quote['lines'][$index];

                foreach ($detail['items'] as $item) {
                    $order->items()->create([
                        'orderable_type' => $item['orderable_type'],
                        'orderable_id' => $item['orderable_id'],
                        'description' => $item['description'],
                        'quantity' => 1,
                        'unit_price_kobo' => $item['amount_kobo'],
                        'total_kobo' => $item['amount_kobo'],
                    ]);
                }

                if ($line['type'] === 'hosting') {
                    $service = $this->createHostingService($client, $order, $line, $detail);
                    $services->push($service);
                    $pendingDomains[] = ['domain' => $this->registeredDomain($line), 'service' => $service, 'price' => $detail['domain_kobo'] ?? 0];

                    if (! $this->registeredDomain($line)) {
                        app(CheckoutService::class)->recordExternalDomainIfNeeded($client, $line['primary_domain'], $service);
                    }
                } elseif ($line['type'] === 'domain') {
                    $pendingDomains[] = ['domain' => $line['domain_name'], 'service' => null, 'price' => $detail['domain_kobo']];
                } else {
                    $serviceLines[] = ['offering' => $line['offering'], 'domain' => $line['domain'] ?? null, 'notes' => $line['notes'] ?? null];
                }
            }

            $order->forceFill(['metadata' => array_merge($order->metadata, ['service_lines' => $serviceLines])])->save();

            $invoice = Invoice::query()->create([
                'client_id' => $client->id,
                'order_id' => $order->id,
                'invoice_number' => $this->number('INV'),
                'status' => 'unpaid',
                'reconciliation_status' => 'pending',
                'subtotal_kobo' => $vat['subtotal_kobo'],
                'discount_kobo' => 0,
                'tax_kobo' => $vat['vat_amount_kobo'],
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $vat['total_kobo'],
                'outstanding_amount_kobo' => $vat['total_kobo'],
                'issued_at' => now()->toDateString(),
                'due_at' => now()->addDays(7)->toDateString(),
                'line_items' => $order->items()->get(['description', 'quantity', 'unit_price_kobo', 'total_kobo'])->toArray(),
                // One website: show it on the invoice like a normal hosting order. Several: the invoice stands for the whole order.
                'hosting_service_id' => $services->count() === 1 ? $services->first()->id : null,
            ]);

            // Second pass: domain registrations (they need the invoice).
            foreach (array_filter($pendingDomains, fn (array $row) => $row['domain']) as $row) {
                $this->createDomainRecords($client, $order, $invoice, $row['domain'], $row['service'], (int) $row['price']);
            }

            return ['order' => $order->load('items'), 'invoice' => $invoice, 'services' => $services];
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    /** The domain a line will register (new domain for a hosting line, or a domain line), if any. */
    private function registeredDomain(array $line): ?string
    {
        if ($line['type'] === 'domain') {
            return $line['domain_name'];
        }

        if ($line['type'] === 'hosting' && ! empty($line['register_domain'])) {
            return $line['primary_domain'];
        }

        return null;
    }

    /**
     * @param  array<string, true>  $seen  domains already used by an earlier line
     * @return array<string, mixed>
     */
    private function priceLine(Client $client, array $line, int $index, array &$seen): array
    {
        return match ($line['type']) {
            'hosting' => $this->priceHostingLine($client, $line, $index, $seen),
            'domain' => $this->priceDomainLine($client, $line, $index, $seen),
            default => $this->priceServiceLine($line, $index),
        };
    }

    private function priceHostingLine(Client $client, array $line, int $index, array &$seen): array
    {
        $plan = HostingPlan::query()->where('slug', $line['plan_slug'])->where('is_active', true)->where('is_orderable', true)->first();

        if (! $plan) {
            throw new RuntimeException('This hosting plan is no longer available.');
        }

        $domain = $line['primary_domain'];
        $this->claimDomain($domain, $seen);

        if ($conflict = app(BusinessEmail::class)->emailPlanConflict($plan, $domain)) {
            throw new RuntimeException($conflict);
        }

        $addOns = HostingAddOn::query()->whereIn('slug', $line['add_ons'] ?? [])->where('is_active', true)->get();
        $planKobo = (int) $plan->annual_price_kobo + (int) $plan->setup_fee_kobo;

        $items = [['orderable_type' => HostingPlan::class, 'orderable_id' => $plan->id, 'description' => "{$plan->orderLabel()} — {$domain}", 'amount_kobo' => $planKobo]];
        foreach ($addOns as $addOn) {
            $items[] = ['orderable_type' => HostingAddOn::class, 'orderable_id' => $addOn->id, 'description' => "{$addOn->name} — {$domain}", 'amount_kobo' => (int) $addOn->annual_price_kobo];
        }

        $hostingKobo = array_sum(array_column($items, 'amount_kobo'));
        $domainKobo = 0;

        if (! empty($line['register_domain'])) {
            $domainKobo = $this->registrationPrice($client, $domain);
            $items[] = ['orderable_type' => DomainOrder::class, 'orderable_id' => null, 'description' => "Domain Registration — {$domain}", 'amount_kobo' => $domainKobo];
        }

        return [
            'index' => $index,
            'type' => 'hosting',
            'title' => $plan->orderLabel(),
            'subtitle' => $domain.(! empty($line['register_domain']) ? ' (new domain)' : ''),
            'items' => $items,
            'hosting_kobo' => $hostingKobo,
            'domain_kobo' => $domainKobo,
            'subtotal_kobo' => $hostingKobo + $domainKobo,
        ];
    }

    private function priceDomainLine(Client $client, array $line, int $index, array &$seen): array
    {
        $domain = $line['domain_name'];
        $this->claimDomain($domain, $seen);
        $price = $this->registrationPrice($client, $domain);

        return [
            'index' => $index,
            'type' => 'domain',
            'title' => 'Domain Registration',
            'subtitle' => $domain,
            'items' => [['orderable_type' => DomainOrder::class, 'orderable_id' => null, 'description' => "Domain Registration — {$domain}", 'amount_kobo' => $price]],
            'domain_kobo' => $price,
            'subtotal_kobo' => $price,
        ];
    }

    private function priceServiceLine(array $line, int $index): array
    {
        $offering = ServiceOffering::query()->where('slug', $line['offering'])->where('is_active', true)->where('is_orderable', true)->where('price_kobo', '>', 0)->first();

        if (! $offering) {
            throw new RuntimeException('This service can no longer be ordered online.');
        }

        if ($offering->requires_domain && blank($line['domain'] ?? null)) {
            throw new RuntimeException('Enter the website address this is for.');
        }

        $domain = $line['domain'] ?? null;
        $price = (int) $offering->price_kobo;

        return [
            'index' => $index,
            'type' => 'service',
            'title' => $offering->name,
            'subtitle' => $domain ?: null,
            'items' => [['orderable_type' => ServiceOffering::class, 'orderable_id' => $offering->id, 'description' => $offering->name.($domain ? " — {$domain}" : '').($offering->billing_type === 'yearly' ? ' (1 year)' : ''), 'amount_kobo' => $price]],
            'subtotal_kobo' => $price,
        ];
    }

    /** One domain, one line: the same name can't be in the cart twice. */
    private function claimDomain(string $domain, array &$seen): void
    {
        if (isset($seen[$domain])) {
            throw new RuntimeException("{$domain} is in your cart more than once.");
        }

        $seen[$domain] = true;
    }

    private function registrationPrice(Client $client, string $domain): int
    {
        $tld = '.'.Str::after($domain, '.');
        $price = $this->domainPricing->priceFor($tld);

        if (! $price) {
            throw new RuntimeException("Registration pricing for {$tld} is not configured yet. Please contact support.");
        }

        $existing = Domain::query()->where('client_id', $client->id)->where('domain_name', $domain)->first();

        if ($existing && in_array($existing->registration_status, ['registered', 'registration_pending', 'payment_confirmed'], true)) {
            throw new RuntimeException('You already have an order in progress or a registration for this domain.');
        }

        return (int) $price['registration_kobo'];
    }

    private function createHostingService(Client $client, Order $order, array $line, array $detail): HostingService
    {
        $plan = HostingPlan::query()->where('slug', $line['plan_slug'])->firstOrFail();
        $domain = $line['primary_domain'];
        $vat = $this->vatCalculator->calculate((int) $detail['hosting_kobo']);
        $renews = now()->addYear()->toDateString();

        return HostingService::query()->create([
            'client_id' => $client->id,
            'hosting_plan_id' => $plan->id,
            'order_id' => $order->id,
            'service_number' => $this->number('SRV'),
            'display_name' => $domain,
            'primary_domain' => $domain,
            'status' => 'pending_payment',
            'billing_cycle' => 'annual',
            'amount_kobo' => $vat['total_kobo'],
            'auto_renew_enabled' => (bool) ($line['auto_renew'] ?? true),
            'provisioning_status' => 'not_provisioned',
            'renews_at' => $renews,
            'next_due_date' => $renews,
            'provisioning_payload' => array_filter([
                'plan' => $plan->slug,
                'add_ons' => HostingAddOn::query()->whereIn('slug', $line['add_ons'] ?? [])->where('is_active', true)->pluck('slug')->values(),
                'domain_purchase' => ! empty($line['register_domain']) ?: null,
                'from_cart' => true,
            ]),
        ]);
    }

    private function createDomainRecords(Client $client, Order $order, Invoice $invoice, string $domainName, ?HostingService $service, int $priceKobo): void
    {
        $domain = Domain::query()->where('client_id', $client->id)->where('domain_name', $domainName)->first()
            ?: Domain::query()->create([
                'client_id' => $client->id,
                'domain_name' => $domainName,
                'tld' => '.'.Str::after($domainName, '.'),
                'source' => 'spaceship_registered',
                'provider' => 'spaceship',
                'status' => 'pending',
                'registration_status' => 'pending_payment',
                'auto_renew' => true,
            ]);

        $vat = $this->vatCalculator->calculate($priceKobo);

        DomainOrder::query()->create([
            'client_id' => $client->id,
            'domain_id' => $domain->id,
            'order_id' => $order->id,
            'hosting_service_id' => $service?->id,
            'domain_name' => $domainName,
            'order_type' => 'registration',
            'provider' => 'spaceship',
            'invoice_id' => $invoice->id,
            'status' => 'pending_payment',
            'price_kobo' => $priceKobo,
            'vat_amount_kobo' => $vat['vat_amount_kobo'],
            'total_amount_kobo' => $vat['total_kobo'],
        ]);

        if ($service) {
            $domain->forceFill(['linked_hosting_service_id' => $service->id])->save();
        }
    }

    private function fallbackTitle(array $line): string
    {
        return match ($line['type']) {
            'hosting' => ($line['plan_slug'] ?? 'Hosting').' — '.($line['primary_domain'] ?? ''),
            'domain' => 'Domain — '.($line['domain_name'] ?? ''),
            default => (string) ($line['offering'] ?? 'Service'),
        };
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
