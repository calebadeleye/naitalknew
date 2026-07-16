<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\WebsiteQuoteRequest;
use Illuminate\Http\Request;

class WebsiteQuoteController extends Controller
{
    private const STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'converted', 'closed', 'spam'];

    public function updateStatus(Request $request, WebsiteQuoteRequest $websiteQuoteRequest)
    {
        $payload = $request->validate([
            'status' => ['required', 'string', 'in:'.implode(',', self::STATUSES)],
        ]);

        $websiteQuoteRequest->status = $payload['status'];

        if ($payload['status'] === 'contacted' && ! $websiteQuoteRequest->contacted_at) {
            $websiteQuoteRequest->contacted_at = now();
        }

        if ($payload['status'] === 'converted' && ! $websiteQuoteRequest->converted_at) {
            $websiteQuoteRequest->converted_at = now();
        }

        $websiteQuoteRequest->save();

        return response()->json(['data' => $websiteQuoteRequest]);
    }
}
