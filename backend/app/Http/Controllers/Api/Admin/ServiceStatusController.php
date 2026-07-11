<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceStatus;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * There's no automated uptime monitoring wired up yet, so status is
 * whatever an admin last set it to here — never fabricated from a health
 * check that doesn't exist.
 */
class ServiceStatusController extends Controller
{
    public function index()
    {
        return response()->json(['data' => ServiceStatus::query()->orderBy('sort_order')->get()]);
    }

    public function update(Request $request, ServiceStatus $serviceStatus)
    {
        $payload = $request->validate([
            'status' => ['required', Rule::in(['operational', 'degraded', 'maintenance', 'incident'])],
            'message' => ['nullable', 'string', 'max:255'],
        ]);
        $serviceStatus->update($payload);

        return response()->json($serviceStatus->refresh());
    }
}
