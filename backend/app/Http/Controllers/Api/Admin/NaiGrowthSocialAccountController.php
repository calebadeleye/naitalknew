<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NaiGrowthSocialAccount;
use Illuminate\Http\Request;

class NaiGrowthSocialAccountController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => NaiGrowthSocialAccount::query()->orderBy('platform')->get(),
        ]);
    }

    public function connect(Request $request, NaiGrowthSocialAccount $naiGrowthSocialAccount)
    {
        $validated = $request->validate([
            'display_name' => ['nullable', 'string', 'max:255'],
            'external_account_id' => ['required', 'string', 'max:255'],
            'access_token' => ['required', 'string'],
        ]);

        $naiGrowthSocialAccount->update([
            'display_name' => $validated['display_name'] ?? null,
            'external_account_id' => $validated['external_account_id'],
            'access_token_encrypted' => $validated['access_token'],
            'status' => 'connected',
            'connected_by_user_id' => $request->user()->id,
            'connected_at' => now(),
        ]);

        return response()->json(['data' => $naiGrowthSocialAccount->refresh()]);
    }

    public function disconnect(NaiGrowthSocialAccount $naiGrowthSocialAccount)
    {
        $naiGrowthSocialAccount->update([
            'display_name' => null,
            'external_account_id' => null,
            'access_token_encrypted' => null,
            'status' => 'not_connected',
            'connected_by_user_id' => null,
            'connected_at' => null,
            'last_synced_at' => null,
        ]);

        return response()->json(['data' => $naiGrowthSocialAccount->refresh()]);
    }
}
