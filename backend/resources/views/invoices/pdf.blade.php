<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $invoice['invoice_number'] }}</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1a1a1a; }
        .header { display: table; width: 100%; margin-bottom: 0; background: #02070a; padding: 20px 24px; }
        .header .brand { display: table-cell; vertical-align: middle; }
        .header .brand img { height: 34px; }
        .header .meta { display: table-cell; text-align: right; vertical-align: middle; color: #fff; }
        h2 { font-size: 16px; text-transform: uppercase; margin: 0; color: #fff; }
        .meta p { color: #ffffffaa; margin: 2px 0; }
        .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .status.paid { background: #9bea1626; color: #9bea16; }
        .status.unpaid { background: #ff4d4d26; color: #ff8080; }
        .body-wrap { padding: 20px 24px; }
        .meta-grid { display: table; width: 100%; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 16px; }
        .meta-grid .cell { display: table-cell; width: 25%; }
        .meta-label { font-size: 9px; text-transform: uppercase; color: #888; }
        .parties { display: table; width: 100%; margin-bottom: 20px; }
        .parties .cell { display: table-cell; width: 50%; vertical-align: top; padding: 10px; border: 1px solid #eee; }
        .parties .cell + .cell { padding-left: 20px; }
        .party-label { font-size: 9px; text-transform: uppercase; color: #6ed414; font-weight: bold; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.items th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 9px; text-transform: uppercase; color: #666; }
        table.items td { padding: 8px; border-top: 1px solid #eee; }
        table.items th.right, table.items td.right { text-align: right; }
        .totals { width: 40%; margin-left: 60%; }
        .totals div { display: table; width: 100%; padding: 4px 0; }
        .totals span:first-child { display: table-cell; color: #666; }
        .totals span:last-child { display: table-cell; text-align: right; font-weight: bold; }
        .totals .grand { border-top: 2px solid #9bea16; padding-top: 8px; font-size: 14px; }
        .totals .grand span:last-child { color: #6ed414; }
        .footer { margin-top: 30px; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">
            <img src="{{ public_path('images/logo.png') }}" alt="NAI TALK">
        </div>
        <div class="meta">
            <h2>Invoice</h2>
            <p>{{ $invoice['invoice_number'] }}</p>
            <span class="status {{ $invoice['status'] === 'paid' ? 'paid' : 'unpaid' }}">{{ $invoice['status'] }}</span>
        </div>
    </div>

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
