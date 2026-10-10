<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $invoice['invoice_number'] }}</title>
    @include('invoices._styles')
</head>
<body>
    @include('invoices._letterhead', [
        'documentTitle' => 'Invoice',
        'documentNumber' => $invoice['invoice_number'],
        'statusLabel' => $invoice['status'],
        'statusClass' => $invoice['status'] === 'paid' ? 'paid' : 'unpaid',
    ])

    <div class="body-wrap">
    <div class="meta-grid">
        <div class="cell"><div class="meta-label">Issue Date</div>{{ $invoice['issued_at'] ?? '—' }}</div>
        <div class="cell"><div class="meta-label">Due Date</div>{{ $invoice['due_at'] ?? '—' }}</div>
        @if ($invoice['paid_at'])
            <div class="cell"><div class="meta-label">Paid Date</div>{{ $invoice['paid_at'] }}</div>
        @endif
    </div>

    <div class="parties">
        <div class="cell">
            <div class="party-label">From</div>
            <p><strong>{{ $invoice['from']['name'] }}</strong></p>
            @foreach (array_filter($invoice['from']['address_lines'] ?? []) as $line)
                <p>{{ $line }}</p>
            @endforeach
            @if ($invoice['from']['phone']) <p>{{ $invoice['from']['phone'] }}</p> @endif
            @if ($invoice['from']['email']) <p>{{ $invoice['from']['email'] }}</p> @endif
        </div>
        <div class="cell">
            <div class="party-label">Bill To</div>
            <p><strong>{{ $invoice['bill_to']['name'] }}</strong></p>
            @foreach (array_filter($invoice['bill_to']['address_lines'] ?? []) as $line)
                <p>{{ $line }}</p>
            @endforeach
            @if ($invoice['bill_to']['email']) <p>{{ $invoice['bill_to']['email'] }}</p> @endif
            @if ($invoice['bill_to']['tax_id']) <p>TIN: {{ $invoice['bill_to']['tax_id'] }}</p> @endif
        </div>
    </div>

    <table class="items">
        <thead>
            <tr>
                <th>#</th>
                <th>Description</th>
                <th class="right">Qty</th>
                <th class="right">Unit Price</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($invoice['line_items'] as $index => $item)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $item['description'] }}</td>
                    <td class="right">{{ $item['quantity'] }}</td>
                    <td class="right">{{ $item['unit_price'] }}</td>
                    <td class="right">{{ $item['total'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <div><span>Subtotal</span><span>{{ $invoice['subtotal'] }}</span></div>
        <div><span>Discount</span><span>{{ $invoice['discount'] }}</span></div>
        <div><span>{{ $invoice['vat_label'] }}</span><span>{{ $invoice['tax'] }}</span></div>
        <div class="grand"><span>Total Payable</span><span>{{ $invoice['total'] }}</span></div>
        <div><span>Amount Paid</span><span>{{ $invoice['amount_paid'] }}</span></div>
        @if (($invoice['wallet_amount_applied_kobo'] ?? 0) > 0)
            <div><span>Wallet Credit Applied</span><span>{{ $invoice['wallet_amount_applied'] }}</span></div>
        @endif
        @if (($invoice['overpayment_amount_kobo'] ?? 0) > 0)
            <div><span>Overpayment (saved to wallet)</span><span>{{ $invoice['overpayment_amount'] }}</span></div>
        @endif
        @if (($invoice['underpayment_amount_kobo'] ?? 0) > 0)
            <div><span>Underpayment</span><span>{{ $invoice['underpayment_amount'] }}</span></div>
        @endif
        <div><span>Outstanding Balance</span><span>{{ $invoice['outstanding_amount'] ?? $invoice['balance_due'] }}</span></div>
    </div>

    <div class="footer">
        <p>Payment is due by the date shown above. Late payments may attract additional charges.</p>
        <p>All services are delivered electronically. Thank you for choosing NAI TALK SERVICES.</p>
    </div>
    </div>
</body>
</html>
