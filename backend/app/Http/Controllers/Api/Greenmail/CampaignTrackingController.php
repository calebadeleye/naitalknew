<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Http\Controllers\Controller;
use App\Services\Greenmail\CampaignTracking;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Public: the open picture and tracked links in campaign emails. */
class CampaignTrackingController extends Controller
{
    /** A transparent 1×1 GIF. */
    private const PIXEL = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    public function open(string $token, CampaignTracking $tracking): Response
    {
        if ($recipient = $tracking->recipient($token)) {
            rescue(fn () => $tracking->recordOpen($recipient), report: false);
        }

        return response(base64_decode(self::PIXEL), 200, [
            'Content-Type' => 'image/gif',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'X-Robots-Tag' => 'noindex',
        ]);
    }

    public function click(Request $request, string $token, int $link, CampaignTracking $tracking): Response
    {
        $recipient = $tracking->recipient($token);
        $url = $recipient ? $tracking->recordClick($recipient, $link, $request->userAgent()) : null;

        abort_unless($url, 404);

        return redirect()->away($url, 302)->withHeaders(['Cache-Control' => 'no-store', 'X-Robots-Tag' => 'noindex']);
    }
}
