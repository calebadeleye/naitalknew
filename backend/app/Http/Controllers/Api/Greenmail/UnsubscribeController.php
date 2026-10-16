<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailCampaignRecipient;
use App\Models\Greenmail\GreenmailUnsubscribe;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The unsubscribe link in campaign emails (public). Opening the link asks
 * for a click — link scanners that open every URL mustn't unsubscribe
 * people; mail apps' one-click unsubscribe POSTs straight here.
 */
class UnsubscribeController extends Controller
{
    public function show(string $token): Response
    {
        $recipient = $this->recipient($token);

        if (! $recipient) {
            return $this->page('Link not recognised', '<p>This unsubscribe link is not valid any more.</p>', 404);
        }

        $owner = e($recipient->campaign->owner_email);

        return $this->page('Unsubscribe', "<p>Stop receiving emails like this from <strong>{$owner}</strong>?</p>"
            .'<form method="post"><button type="submit">Unsubscribe '.e($recipient->email).'</button></form>');
    }

    public function store(Request $request, string $token): Response
    {
        $recipient = $this->recipient($token);
        abort_unless($recipient, 404);

        GreenmailUnsubscribe::query()->firstOrCreate(['owner_email' => $recipient->campaign->owner_email, 'email' => $recipient->email]);

        return $this->page('Unsubscribed', '<p>Done — <strong>'.e($recipient->email).'</strong> will not get these emails from '.e($recipient->campaign->owner_email).' any more.</p>');
    }

    private function recipient(string $token): ?GreenmailCampaignRecipient
    {
        [$id] = explode('.', $token, 2) + [null];
        $recipient = ctype_digit((string) $id) ? GreenmailCampaignRecipient::query()->with('campaign')->find((int) $id) : null;

        return $recipient && $recipient->campaign && hash_equals($recipient->unsubscribeToken(), $token) ? $recipient : null;
    }

    private function page(string $title, string $body, int $status = 200): Response
    {
        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
            .'<title>'.e($title).'</title><style>body{font-family:system-ui,sans-serif;background:#f3f5f7;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}'
            .'main{background:#fff;border-radius:16px;padding:32px;max-width:440px;box-shadow:0 10px 30px rgba(15,23,42,.08)}h1{font-size:22px;margin:0 0 12px}'
            .'button{background:#15803d;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-weight:700;font-size:15px;cursor:pointer;margin-top:8px}</style></head>'
            .'<body><main><h1>'.e($title).'</h1>'.$body.'</main></body></html>';

        return response($html, $status, ['Content-Type' => 'text/html; charset=utf-8', 'X-Robots-Tag' => 'noindex']);
    }
}
