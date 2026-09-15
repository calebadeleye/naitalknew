<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\NaiGrowth\NaiGrowthService;
use Illuminate\Http\Request;
use Throwable;

class NaiGrowthController extends Controller
{
    public function __construct(private readonly NaiGrowthService $naiGrowth)
    {
    }

    public function index(Request $request)
    {
        return response()->json(['data' => $this->naiGrowth->history($request->user())]);
    }

    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
        ]);

        try {
            $result = $this->naiGrowth->reply($request->user(), $validated['message']);
        } catch (Throwable $exception) {
            // Any failure reaching Gemini (bad key, timeout, DNS, rate limit) lands
            // here — always a clean, honest error, never a fabricated reply.
            report($exception);

            return response()->json([
                'message' => "NaiGrowth couldn't reach Gemini — {$exception->getMessage()}",
            ], 502);
        }

        return response()->json($result);
    }

    public function clear(Request $request)
    {
        $this->naiGrowth->clear($request->user());

        return response()->json(['message' => 'NaiGrowth conversation cleared.']);
    }
}
