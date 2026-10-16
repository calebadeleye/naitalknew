<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailSetting;
use App\Services\Greenmail\HtmlSanitizer;
use Illuminate\Http\Request;

/** Display name and signature for the signed-in mailbox. */
class SettingsController extends Controller
{
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
