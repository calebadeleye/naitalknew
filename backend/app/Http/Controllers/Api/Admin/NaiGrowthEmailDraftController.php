<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\NaiGrowthDraftMail;
use App\Models\NaiGrowthEmailDraft;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Throwable;

class NaiGrowthEmailDraftController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => NaiGrowthEmailDraft::query()->latest('id')->get(),
        ]);
    }

    public function update(Request $request, NaiGrowthEmailDraft $naiGrowthEmailDraft)
    {
        if ($naiGrowthEmailDraft->status !== 'pending_review') {
            return response()->json(['message' => 'Only a pending draft can be edited.'], 422);
        }

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
        ]);

        $naiGrowthEmailDraft->update($validated);

        return response()->json(['data' => $naiGrowthEmailDraft->refresh()]);
    }

    public function approve(Request $request, NaiGrowthEmailDraft $naiGrowthEmailDraft)
    {
        if ($naiGrowthEmailDraft->status !== 'pending_review') {
            return response()->json(['message' => 'This draft has already been '.$naiGrowthEmailDraft->status.'.'], 422);
        }

        try {
            Mail::to($naiGrowthEmailDraft->recipient_email)
                ->send(new NaiGrowthDraftMail($naiGrowthEmailDraft->subject, $naiGrowthEmailDraft->body));
        } catch (Throwable $exception) {
            report($exception);

            return response()->json([
                'message' => "Could not send this email — {$exception->getMessage()}",
            ], 502);
        }

        $naiGrowthEmailDraft->update([
            'status' => 'sent',
            'sent_at' => now(),
            'reviewed_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $naiGrowthEmailDraft->refresh()]);
    }

    public function discard(Request $request, NaiGrowthEmailDraft $naiGrowthEmailDraft)
    {
        if ($naiGrowthEmailDraft->status !== 'pending_review') {
            return response()->json(['message' => 'This draft has already been '.$naiGrowthEmailDraft->status.'.'], 422);
        }

        $naiGrowthEmailDraft->update([
            'status' => 'discarded',
            'reviewed_by_user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $naiGrowthEmailDraft->refresh()]);
    }
}
