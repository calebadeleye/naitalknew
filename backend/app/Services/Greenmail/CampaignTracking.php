<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailCampaign;
use App\Models\Greenmail\GreenmailCampaignEvent;
use App\Models\Greenmail\GreenmailCampaignLink;
use App\Models\Greenmail\GreenmailCampaignRecipient;
use Illuminate\Support\Facades\DB;

/**
 * Campaign reports. Each email gets a 1×1 picture that tells us when it is
 * opened, and its links go through Green Mail first so clicks can be counted
 * (then straight on to the real address).
 *
 * Opens are approximate: some mail apps load pictures for privacy before the
 * person reads the email (Apple Mail), others block pictures, so a click also
 * counts as an open.
 */
class CampaignTracking
{
    /** Stands in for each recipient's token in the prepared email. */
    private const TOKEN = '__GM_TRACK__';

    /** Security scanners that follow every link in an email the moment it arrives. */
    private const SCANNERS = '/bot|crawler|spider|scanner|barracuda|mimecast|proofpoint|safelinks|urldefense|symantec|trendmicro|sophos|forcepoint|zscaler|python-requests|curl\/|wget|go-http-client|headless/i';

    /**
     * The campaign's HTML with its links pointing through Green Mail, plus the
     * open picture. Personalise it, then call forRecipient().
     */
    public function prepare(GreenmailCampaign $campaign, string $html): string
    {
        if (! $campaign->track) {
            return $html;
        }

        $base = $this->base();

        $html = (string) preg_replace_callback('/(<a\b[^>]*?\bhref\s*=\s*)(["\'])(.*?)\2/is', function (array $m) use ($campaign, $base) {
            $url = html_entity_decode(trim($m[3]), ENT_QUOTES | ENT_HTML5);
            if (! preg_match('#^https?://#i', $url) || strlen($url) > 4000) {
                return $m[0];
            }
            $link = GreenmailCampaignLink::query()->firstOrCreate(
                ['campaign_id' => $campaign->id, 'url_hash' => hash('sha256', $url)],
                ['url' => $url],
            );

            return $m[1].$m[2].e("{$base}/c/".self::TOKEN."/{$link->id}").$m[2];
        }, $html);

        return $html.'<img src="'.e("{$base}/o/".self::TOKEN.'.gif').'" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0">';
    }

    public function forRecipient(string $prepared, GreenmailCampaignRecipient $recipient): string
    {
        return str_replace(self::TOKEN, $recipient->trackingToken(), $prepared);
    }

    public function recipient(string $token): ?GreenmailCampaignRecipient
    {
        [$id] = explode('.', $token, 2) + [null];
        $recipient = ctype_digit((string) $id) ? GreenmailCampaignRecipient::query()->find((int) $id) : null;

        return $recipient && hash_equals($recipient->trackingToken(), $token) ? $recipient : null;
    }

    public function recordOpen(GreenmailCampaignRecipient $recipient): void
    {
        DB::transaction(function () use ($recipient) {
            $recipient->forceFill(['opened_at' => $recipient->opened_at ?? now(), 'open_count' => $recipient->open_count + 1])->save();
            GreenmailCampaignEvent::query()->create(['campaign_id' => $recipient->campaign_id, 'recipient_id' => $recipient->id, 'type' => 'open', 'created_at' => now()]);
        });
    }

    /** @return string|null where to send the person (null: not a link of this email) */
    public function recordClick(GreenmailCampaignRecipient $recipient, int $linkId, ?string $userAgent): ?string
    {
        $link = GreenmailCampaignLink::query()->where('campaign_id', $recipient->campaign_id)->find($linkId);
        if (! $link) {
            return null;
        }

        if (! preg_match(self::SCANNERS, (string) $userAgent)) {
            DB::transaction(function () use ($recipient, $link) {
                $link->increment('clicks');
                $recipient->forceFill([
                    'clicked_at' => $recipient->clicked_at ?? now(),
                    'click_count' => $recipient->click_count + 1,
                    // Pictures were blocked, but a click means they read it.
                    'opened_at' => $recipient->opened_at ?? now(),
                    'open_count' => max(1, $recipient->open_count),
                ])->save();
                GreenmailCampaignEvent::query()->create(['campaign_id' => $recipient->campaign_id, 'recipient_id' => $recipient->id, 'type' => 'click', 'link_id' => $link->id, 'created_at' => now()]);
            });
        }

        return $link->url;
    }

    /** The numbers for a campaign's report. */
    public function report(GreenmailCampaign $campaign): array
    {
        $recipients = $campaign->recipients();
        $sent = (int) $campaign->sent_count;
        $opened = (clone $recipients)->whereNotNull('opened_at')->count();
        $clicked = (clone $recipients)->whereNotNull('clicked_at')->count();
        $unsubscribed = (clone $recipients)->whereNotNull('unsubscribed_at')->count();
        $rate = fn (int $n, int $of) => $of > 0 ? round($n / $of * 100, 1) : 0.0;

        $uniqueByLink = GreenmailCampaignEvent::query()->where('campaign_id', $campaign->id)->where('type', 'click')
            ->selectRaw('link_id, count(distinct recipient_id) as people')->groupBy('link_id')->pluck('people', 'link_id');

        return [
            'tracked' => (bool) $campaign->track,
            'sent' => $sent,
            'opened' => $opened,
            'opens' => (int) (clone $recipients)->sum('open_count'),
            'clicked' => $clicked,
            'clicks' => (int) (clone $recipients)->sum('click_count'),
            'unsubscribed' => $unsubscribed,
            'open_rate' => $rate($opened, $sent),
            'click_rate' => $rate($clicked, $sent),
            'click_to_open_rate' => $rate($clicked, $opened),
            'unsubscribe_rate' => $rate($unsubscribed, $sent),
            'links' => $campaign->links()->orderByDesc('clicks')->orderBy('id')->get()
                ->map(fn (GreenmailCampaignLink $l) => ['id' => $l->id, 'url' => $l->url, 'clicks' => (int) $l->clicks, 'people' => (int) ($uniqueByLink[$l->id] ?? 0)])->all(),
            'timeline' => $this->timeline($campaign),
        ];
    }

    /** First opens and first clicks per hour (first two days) or per day (after that). */
    private function timeline(GreenmailCampaign $campaign): array
    {
        $start = $campaign->started_at;
        if (! $start) {
            return ['unit' => 'hour', 'points' => []];
        }

        $byDay = $start->lt(now()->subHours(48));
        $first = $campaign->recipients()->where(fn ($q) => $q->whereNotNull('opened_at')->orWhereNotNull('clicked_at'))->get(['opened_at', 'clicked_at']);
        $key = fn ($time) => $byDay ? $time->copy()->startOfDay()->toIso8601String() : $time->copy()->startOfHour()->toIso8601String();

        $points = [];
        $cursor = $byDay ? $start->copy()->startOfDay() : $start->copy()->startOfHour();
        $end = $byDay ? min(now(), $start->copy()->addDays(30)) : min(now(), $start->copy()->addHours(48));
        while ($cursor->lte($end)) {
            $points[$cursor->toIso8601String()] = ['at' => $cursor->toIso8601String(), 'opens' => 0, 'clicks' => 0];
            $byDay ? $cursor->addDay() : $cursor->addHour();
        }
        foreach ($first as $r) {
            if ($r->opened_at && isset($points[$key($r->opened_at)])) {
                $points[$key($r->opened_at)]['opens']++;
            }
            if ($r->clicked_at && isset($points[$key($r->clicked_at)])) {
                $points[$key($r->clicked_at)]['clicks']++;
            }
        }

        return ['unit' => $byDay ? 'day' : 'hour', 'points' => array_values($points)];
    }

    private function base(): string
    {
        return rtrim((string) config('app.url'), '/').'/api/v1/greenmail/t';
    }
}
