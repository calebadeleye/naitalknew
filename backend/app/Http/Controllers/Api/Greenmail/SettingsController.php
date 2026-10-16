<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailSetting;
use App\Services\Greenmail\HtmlSanitizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/** Display name and signature for the signed-in mailbox. */
class SettingsController extends Controller
{
    /**
     * An image for the signature. Stored on the server and served from a
     * public address, because a signature image must load in the recipient's
     * mail app (many block data: images).
     */
    public function uploadSignatureImage(Request $request)
    {
        $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,gif,webp', 'max:1024']]);

        $owner = $request->attributes->get('greenmail_session')->email;
        $name = Str::random(32).'.'.$request->file('image')->extension();
        $request->file('image')->storeAs('greenmail-signatures/'.hash('sha256', $owner), $name, 'local');

        // The public site address, not url(): API requests reach Laravel through
        // the Node server, so the request's own host isn't one recipients can load.
        return response()->json(['url' => rtrim((string) config('app.url'), '/').'/api/v1/greenmail/signature-images/'.hash('sha256', $owner).'/'.$name], 201);
    }

    /** Public (no sign-in): recipients' mail apps load these. Names are unguessable. */
    public function signatureImage(string $owner, string $name)
    {
        abort_unless(preg_match('/^[a-f0-9]{64}$/', $owner) && preg_match('/^[A-Za-z0-9]{32}\.(jpg|jpeg|png|gif|webp)$/', $name), 404);
        $path = "greenmail-signatures/{$owner}/{$name}";
        abort_unless(Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'public, max-age=31536000, immutable']);
    }

    public function update(Request $request, HtmlSanitizer $sanitizer)
    {
        $data = $request->validate([
            'display_name' => ['nullable', 'string', 'max:120'],
            'signature_html' => ['nullable', 'string', 'max:20000'],
        ]);

        $settings = GreenmailSetting::query()->updateOrCreate(
            ['owner_email' => $request->attributes->get('greenmail_session')->email],
            [
                'display_name' => $data['display_name'] ?? null,
                'signature_html' => filled($data['signature_html'] ?? null) ? $sanitizer->clean($data['signature_html']) : null,
            ],
        );

        return response()->json(['display_name' => $settings->display_name, 'signature_html' => $settings->signature_html]);
    }
}
