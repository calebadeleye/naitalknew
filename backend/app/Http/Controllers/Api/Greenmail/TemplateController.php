<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailTemplate;
use App\Services\Greenmail\HtmlSanitizer;
use Illuminate\Http\Request;

/** Reusable emails: pick one in the composer to fill in the subject and message. */
class TemplateController extends Controller
{
    public function index(Request $request)
    {
        $templates = GreenmailTemplate::query()->where('owner_email', $this->owner($request))->orderBy('name')->limit(200)->get();

        return response()->json(['templates' => $templates]);
    }

    public function store(Request $request, HtmlSanitizer $sanitizer)
    {
        $template = GreenmailTemplate::query()->create($this->validated($request, $sanitizer) + ['owner_email' => $this->owner($request)]);

        return response()->json(['template' => $template, 'message' => 'Template saved.'], 201);
    }

    public function update(Request $request, GreenmailTemplate $template, HtmlSanitizer $sanitizer)
    {
        abort_unless($template->owner_email === $this->owner($request), 404);
        $template->update($this->validated($request, $sanitizer));

        return response()->json(['template' => $template->fresh(), 'message' => 'Template saved.']);
    }

    public function destroy(Request $request, GreenmailTemplate $template)
    {
        abort_unless($template->owner_email === $this->owner($request), 404);
        $template->delete();

        return response()->json(['message' => 'Template deleted.']);
    }

    private function validated(Request $request, HtmlSanitizer $sanitizer): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'subject' => ['nullable', 'string', 'max:300'],
            'body_html' => ['nullable', 'string', 'max:200000'],
        ]);

        $data['body_html'] = filled($data['body_html'] ?? null) ? $sanitizer->clean($data['body_html']) : null;

        return $data;
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
