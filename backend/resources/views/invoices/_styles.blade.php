{{-- Shared stylesheet for the generated billing PDFs (invoices.pdf, invoices.receipt). --}}
<style>
        body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1a1a1a; }
        /* The letterhead's header band ends ~55mm down and its footer band starts ~266mm down
           (of 297mm), so content stays inside these margins on every page. */
        @page { margin: 60mm 16mm 36mm 16mm; }
        .letterhead { position: fixed; top: -60mm; left: -16mm; width: 210mm; height: 297mm; z-index: -1; }
        .letterhead img { width: 210mm; height: 297mm; }
        .doc-title { display: table; width: 100%; margin-bottom: 14px; }
        .doc-title .title-cell, .doc-title .number-cell { display: table-cell; vertical-align: bottom; }
        .doc-title .number-cell { text-align: right; }
        .doc-title h1 { margin: 0; font-size: 22px; letter-spacing: 1px; text-transform: uppercase; color: #1a1a1a; }
        .doc-number { margin: 0 0 4px; color: #555; font-size: 12px; }
        .status { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .status.paid { background: #6cb52d22; color: #3f7d12; }
        .status.unpaid { background: #d9363e1f; color: #b3261e; }
        .body-wrap { padding: 0; }
        .meta-grid { display: table; width: 100%; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 16px; }
        .meta-grid .cell { display: table-cell; width: 25%; }
        .meta-label { font-size: 9px; text-transform: uppercase; color: #888; }
        .parties { display: table; width: 100%; margin-bottom: 20px; }
        .parties .cell { display: table-cell; width: 50%; vertical-align: top; padding: 10px; border: 1px solid #eee; }
        .parties .cell + .cell { padding-left: 20px; }
        .parties p { margin: 0 0 3px; }
        .party-label { font-size: 9px; text-transform: uppercase; color: #6ed414; font-weight: bold; }
        table.items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        table.items th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 9px; text-transform: uppercase; color: #666; }
        table.items td { padding: 6px 8px; border-top: 1px solid #eee; }
        table.items th.right, table.items td.right { text-align: right; }
        .totals { width: 40%; margin-left: 60%; }
        .totals div { display: table; width: 100%; padding: 4px 0; }
        .totals span:first-child { display: table-cell; color: #666; }
        .totals span:last-child { display: table-cell; text-align: right; font-weight: bold; }
        .totals .grand { border-top: 2px solid #9bea16; padding-top: 8px; font-size: 14px; }
        .totals .grand span:last-child { color: #6ed414; }
        .footer { margin-top: 16px; font-size: 9px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
        .footer p { margin: 0 0 3px; }
</style>
