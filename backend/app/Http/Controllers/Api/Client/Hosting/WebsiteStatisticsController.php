<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Models\HostingService;
use App\Services\Hosting\SiteStatisticsService;
use Illuminate\Http\Request;

/** The Statistics tab: daily visits, pages and bandwidth for one website. */
class WebsiteStatisticsController extends Controller
{
    public function show(Request $request, HostingService $service, SiteStatisticsService $statistics)
    {
        $this->authorize('manage', $service);

        $days = (int) ($request->validate(['days' => ['nullable', 'integer', 'in:7,30,90']])['days'] ?? 30);

        return response()->json($statistics->summary($service, $days));
    }
}
