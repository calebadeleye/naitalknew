<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\ContactMessage;
use App\Notifications\NaiTalkContactMessageReceived;
use App\Rules\PassesTurnstile;
use App\Services\Turnstile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * The website's contact form. The message is saved first, then emailed to
 * NAI TALK through the platform's mailer, so a mail problem never loses it.
 */
class ContactMessageController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:60'],
            'service' => ['required', 'string', 'max:120'],
            'details' => ['required', 'string', 'max:5000'],
            'page' => ['nullable', 'string', 'max:60'],
            'turnstile_token' => Turnstile::enabled() ? ['required', 'string', 'max:2048', new PassesTurnstile] : ['nullable'],
        ], [
            'turnstile_token.required' => 'Please complete the security check before sending.',
        ]);

        $contact = ContactMessage::query()->create([
            ...collect($data)->except('turnstile_token')->all(),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 255),
        ]);

        try {
            Notification::route('mail', config('company.email', 'info@naitalk.com'))->notifyNow(new NaiTalkContactMessageReceived($contact));
            $contact->forceFill(['emailed_at' => now()])->save();
        } catch (Throwable $exception) {
            // Saved anyway: it can be read from the contact_messages table.
            Log::error('Contact form email failed', ['contact_message_id' => $contact->id, 'error' => $exception->getMessage()]);
        }

        return response()->json(['message' => 'Message sent successfully. We will get back to you shortly.'], 201);
    }
}
