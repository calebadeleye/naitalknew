<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt {{ $receipt['receipt_number'] }}</title>
    @include('invoices._styles')
    <style>
        .received-note { margin: 0 0 18px; padding: 10px 12px; border: 1px solid #9bea16; background: #9bea1612; font-size: 12px; }
    </style>
</head>
<body>
    @include('invoices._letterhead', [
        'documentTitle' => 'Payment Receipt',
        'documentNumber' => $receipt['receipt_number'],
        'statusLabel' => $receipt['paid_in_full'] ? 'Paid in full' : 'Part payment',
        'statusClass' => $receipt['paid_in_full'] ? 'paid' : 'unpaid',
    ])

    <div class="body-wrap">
    <div class="meta-grid">
        <div class="cell"><div class="meta-label">Receipt Date</div>{{ $receipt['receipt_date'] }}</div>
        <div class="cell"><div class="meta-label">For Invoice</div>{{ $receipt['invoice_number'] }}</div>
        @if ($receipt['order_number'])
            <div class="cell"><div class="meta-label">Order</div>{{ $receipt['order_number'] }}</div>
        @endif
        <div class="cell"><div class="meta-label">Amount Received</div>{{ $receipt['total_received'] }}</div>
    </div>

    <div class="parties">
        <div class="cell">
            <div class="party-label">Received By</div>
            <p><strong>{{ $receipt['from']['name'] }}</strong></p>
            @foreach (array_filter($receipt['from']['address_lines'] ?? []) as $line)
                <p>{{ $line }}</p>
            @endforeach
            @if ($receipt['from']['phone']) <p>{{ $receipt['from']['phone'] }}</p> @endif
            @if ($receipt['from']['email']) <p>{{ $receipt['from']['email'] }}</p> @endif
        </div>
        <div class="cell">
            <div class="party-label">Received From</div>
            <p><strong>{{ $receipt['bill_to']['name'] }}</strong></p>
            @foreach (array_filter($receipt['bill_to']['address_lines'] ?? []) as $line)
                <p>{{ $line }}</p>
            @endforeach
            @if ($receipt['bill_to']['email']) <p>{{ $receipt['bill_to']['email'] }}</p> @endif
        </div>
    </div>

    <p class="received-note">
        We confirm receipt of <strong>{{ $receipt['total_received'] }}</strong> towards invoice {{ $receipt['invoice_number'] }}.
        @if ($receipt['paid_in_full'])
            This invoice is paid in full.
        @else
            An outstanding balance of <strong>{{ $receipt['outstanding_amount'] }}</strong> remains on this invoice.
        @endif
    </p>

    <table class="items">
        <thead>
            <tr>
                <th>Date</th>
                <th>Payment Method</th>
                <th>Reference</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($receipt['payments'] as $payment)
                <tr>
                    <td>{{ $payment['date'] }}</td>
                    <td>{{ $payment['method'] }}</td>
                    <td>{{ $payment['reference'] }}</td>
                    <td class="right">{{ $payment['amount'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <table class="items">
        <thead>
            <tr>
                <th>For</th>
                <th class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($receipt['line_items'] as $item)
                <tr>
                    <td>{{ $item['description'] }}@if ((int) $item['quantity'] > 1) × {{ $item['quantity'] }}@endif</td>
                    <td class="right">{{ $item['total'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals">
        <div><span>Invoice Total</span><span>{{ $receipt['invoice_total'] }}</span></div>
        <div class="grand"><span>Total Received</span><span>{{ $receipt['total_received'] }}</span></div>
        <div><span>Outstanding Balance</span><span>{{ $receipt['outstanding_amount'] }}</span></div>
    </div>

    <div class="footer">
        <p>This receipt was generated electronically and is valid without a signature. Thank you for choosing {{ $receipt['from']['name'] }}.</p>
    </div>
    </div>
</body>
</html>
