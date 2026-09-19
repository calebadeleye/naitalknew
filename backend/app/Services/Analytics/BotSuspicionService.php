<?php

namespace App\Services\Analytics;

use App\Models\AnalyticsVisit;

/**
 * Flags visits that look automated even though they run JavaScript in a
 * real-looking browser — the kind the plain User-Agent check in
 * TrackingController can't catch. A flagged visit is hidden from the admin
 * dashboard by default but never deleted, so it can be reviewed.
 *
 * Deliberately conservative: each rule needs a strong signal, because a
 * false positive hides a real visitor from the numbers.
 */
class BotSuspicionService
{
    /**
     * ASNs of cloud/hosting networks and Meta's own infrastructure — traffic
     * from these is servers, not people on home or mobile connections.
     * (Meta: its link-preview/ad-review crawlers run from Meta datacenters,
     * whereas real Facebook users clicking a link come from ordinary ISPs.)
     */
    private const DATACENTER_ASNS = [
        16509, 14618,          // Amazon AWS
        15169, 396982,         // Google / Google Cloud
        8075,                  // Microsoft Azure
        14061,                 // DigitalOcean
        16276,                 // OVH
        24940,                 // Hetzner
        63949,                 // Linode / Akamai Connected Cloud
        20473,                 // Vultr
        45102, 37963,          // Alibaba Cloud
        45090, 132203,         // Tencent Cloud
        31898,                 // Oracle Cloud
        32934,                 // Meta / Facebook
        9009,                  // M247
        60781, 30633,          // Leaseweb
        51167,                 // Contabo
        12876,                 // Scaleway
    ];

    private const UA_BURST_DISTINCT_IPS = 5;

    private const UA_BURST_WINDOW_MINUTES = 10;

    public function reasonFor(?string $userAgent, ?int $asn): ?string
    {
        if ($asn !== null && in_array($asn, self::DATACENTER_ASNS, true)) {
            return 'datacenter_network';
        }

        $ua = trim((string) $userAgent);
        if ($ua !== '' && (str_starts_with($ua, '"') || str_ends_with($ua, '"') || str_starts_with($ua, "'"))) {
            return 'malformed_user_agent';
        }

        return null;
    }

    /**
     * Many brand-new visits, from many different IPs, all with the same
     * User-Agent and no referrer, inside a few minutes is one crawler on a
     * proxy pool — not organic traffic to a site this size. Referrer-less
     * only: a real campaign (e.g. a Facebook post) produces bursts too, but
     * those visits arrive with a referrer, and are left alone.
     */
    public function flagUaBurst(AnalyticsVisit $visit): int
    {
        if ($visit->referrer || ! $visit->user_agent) {
            return 0;
        }

        $burst = AnalyticsVisit::query()
            ->where('user_agent', $visit->user_agent)
            ->whereNull('referrer')
            ->where('started_at', '>=', $visit->started_at->copy()->subMinutes(self::UA_BURST_WINDOW_MINUTES))
            ->where('started_at', '<=', $visit->started_at)
            ->get();

        if ($burst->pluck('ip_hash')->unique()->count() < self::UA_BURST_DISTINCT_IPS) {
            return 0;
        }

        return AnalyticsVisit::query()
            ->whereIn('id', $burst->pluck('id'))
            ->whereNull('suspected_bot_reason')
            ->update(['suspected_bot_reason' => 'ua_burst']);
    }
}
