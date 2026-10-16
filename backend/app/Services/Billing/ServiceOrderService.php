<?php

namespace App\Services\Billing;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\ServiceOffering;
use App\Notifications\NaiTalkInvoiceCreated;
use App\Services\Support\SupportTicketService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * Buying a service offering on its own (e.g. an SSL certificate): an order
 * and invoice like any other purchase. There is nothing to provision
 * automatically — once the invoice is paid, a support ticket is opened for
 * the client so our team is emailed and reaches out to set it up.
 */
class ServiceOrderService
{
    public function __construct(private readonly VatCalculator $vatCalculator = new VatCalculator)
    {
    }

    /** @return array{order: Order, invoice: Invoice} */
    public function create(Client $client, ServiceOffering $offering, ?string $domain, ?string $notes): array
    {
        abort_unless($offering->is_active && $offering->is_orderable && $offering->price_kobo > 0, 422, 'This service cannot be ordered online. Please contact us.');

        $result = DB::transaction(function () use ($client, $offering, $domain, $notes) {
            if (in_array($client->account_type, ['registered_user', 'prospect'], true)) {
                $client->forceFill(['account_type' => 'billing_client', 'client_status' => 'active', 'last_activity_at' => now()])->save();
            }

            $price = (int) $offering->price_kobo;
            $vat = $this->vatCalculator->calculate($price, 0);
            $description = $offering->name.($domain ? " — {$domain}" : '').($offering->billing_type === 'yearly' ? ' (1 year)' : '');

            $order = Order::query()->create([
                'client_id' => $client->id,
                'order_number' => $this->number('ORD'),
                'status' => 'pending_payment',
                'billing_cycle' => $offering->billing_type === 'yearly' ? 'annual' : $offering->billing_type,
                'subtotal_kobo' => $price,
                'discount_kobo' => 0,
                'tax_kobo' => $vat['vat_amount_kobo'],
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $vat['total_kobo'],
                'accepted_terms_at' => now(),
                'metadata' => [
                    'kind' => 'service_offering',
                    'offering' => $offering->slug,
                    'domain' => $domain,
                    'notes' => $notes,
                ],
            ]);

            $order->items()->create([
                'orderable_type' => ServiceOffering::class,
                'orderable_id' => $offering->id,
                'description' => $description,
                'quantity' => 1,
                'unit_price_kobo' => $price,
                'total_kobo' => $price,
            ]);

            $invoice = Invoice::query()->create([
                'client_id' => $client->id,
                'order_id' => $order->id,
                'invoice_number' => $this->number('INV'),
                'status' => 'unpaid',
                'reconciliation_status' => 'pending',
                'subtotal_kobo' => $price,
                'discount_kobo' => 0,
                'tax_kobo' => $vat['vat_amount_kobo'],
                'vat_rate' => $vat['vat_rate'],
                'total_kobo' => $vat['total_kobo'],
                'outstanding_amount_kobo' => $vat['total_kobo'],
                'issued_at' => now()->toDateString(),
                'due_at' => now()->addDays(7)->toDateString(),
                'line_items' => $order->items()->get(['description', 'quantity', 'unit_price_kobo', 'total_kobo'])->toArray(),
            ]);

            return ['order' => $order->load('items'), 'invoice' => $invoice];
        });

        $client->user?->notify(new NaiTalkInvoiceCreated($result['invoice']));

        return $result;
    }

    /**
     * Called once an invoice is fully paid: for each stand-alone service on
     * the order (a single service order, or service lines in a cart), open a
     * setup ticket (once each) so the team is told and the client can follow it.
     */
    public function handlePaid(Invoice $invoice): void
    {
        $order = $invoice->order;

        if ($invoice->status !== 'paid' || ! $order) {
            return;
        }

        $metadata = $order->metadata ?? [];
        $lines = $metadata['service_lines'] ?? [];

        if (($metadata['kind'] ?? null) === 'service_offering') {
            $lines = [['offering' => $metadata['offering'] ?? '', 'domain' => $metadata['domain'] ?? null, 'notes' => $metadata['notes'] ?? null]];
        }

        $client = $invoice->client;
        $user = $client?->user;

        if (! $lines || ! $user) {
            return;
        }

        $tickets = $metadata['setup_tickets'] ?? [];

        // Orders made before several lines were possible recorded one ticket here.
        if (! empty($metadata['setup_ticket'])) {
            $tickets[0] ??= $metadata['setup_ticket'];
        }

        foreach ($lines as $index => $line) {
            if (isset($tickets[$index])) {
                continue;
            }

            $offering = ServiceOffering::query()->where('slug', $line['offering'] ?? '')->first();
            $name = $offering?->name ?? 'Service';
            $domain = $line['domain'] ?? null;
            $notes = $line['notes'] ?? null;

            try {
                $ticket = app(SupportTicketService::class)->open($client, $user, [
                    'subject' => "{$name} setup".($domain ? " — {$domain}" : ''),
                    'category' => 'technical',
                    'priority' => 'high',
                    'message' => "{$name}".($domain ? " for {$domain}" : '')." — paid (invoice {$invoice->invoice_number})."
                        .($notes ? "\n\nNotes from the order: {$notes}" : '')
                        ."\n\nThis ticket was opened automatically. The NAI TALK team will reach out here and by email to set it up with you.",
                ]);

                $tickets[$index] = $ticket->ticket_number;
            } catch (Throwable $exception) {
                // The payment stands; the team can still see the paid order.
                report($exception);
            }
        }

        $order->forceFill(['metadata' => array_merge($order->metadata ?? [], ['setup_tickets' => $tickets])])->save();
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
    }
}
