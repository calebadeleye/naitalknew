<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\UsageStats;

/** Counters for the public Green Mail page and homepage section. */
class GreenmailStatsController extends Controller
{
    public function __invoke(UsageStats $stats)
    {
        return response()->json($stats->get())->header('Cache-Control', 'public, max-age=3600');
    }
}
