{{--
    The company letterhead for every generated billing document
    (invoices.pdf, invoices.receipt): public/images/letterhead.jpg is drawn
    as the full A4 page behind the content on every page (logo and tagline at
    the top, address/phone/email/website at the bottom). The page margins in
    invoices._styles keep the content between those two bands. A new
    letterhead design only means replacing that image (same A4 proportions).

    Expects $documentTitle, $documentNumber and, optionally,
    $statusLabel / $statusClass ('paid' | 'unpaid').
--}}
<div class="letterhead"><img src="{{ public_path('images/letterhead.jpg') }}" alt=""></div>

<div class="doc-title">
    <div class="title-cell">
        <h1>{{ $documentTitle }}</h1>
    </div>
    <div class="number-cell">
        <p class="doc-number">{{ $documentNumber }}</p>
        @if (! empty($statusLabel))
            <span class="status {{ $statusClass ?? 'unpaid' }}">{{ $statusLabel }}</span>
        @endif
    </div>
</div>
