<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\ClientDashboardService;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request, ClientDashboardService $dashboard)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        return response()->json($dashboard->snapshot($client));
    }
}
