<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Billing\ChurnAnalyticsService;
use Illuminate\Http\Request;

class ChurnAnalyticsController extends Controller
{
    public function overview(Request $request, ChurnAnalyticsService $churn)
    {
        $payload = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return response()->json($churn->renewalOverview($payload['from'] ?? null, $payload['to'] ?? null));
    }
}
