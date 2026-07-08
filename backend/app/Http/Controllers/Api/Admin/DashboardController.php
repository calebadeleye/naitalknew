<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Dashboard\AdminDashboardService;

class DashboardController extends Controller
{
    public function __invoke(AdminDashboardService $dashboard)
    {
        return response()->json($dashboard->snapshot());
    }
}
