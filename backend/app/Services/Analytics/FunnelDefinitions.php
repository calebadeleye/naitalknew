<?php

namespace App\Services\Analytics;

/**
 * Single source of truth for which funnel/event_name pairs the tracking
 * endpoint accepts, their order, and their admin-facing labels. Two
 * funnels, matching the two customer journeys the site actually has —
 * combining them would mix "requested a website design quote" with
 * "bought hosting" in one misleading chart.
 */
class FunnelDefinitions
{
    public const FUNNELS = [
        'domain_hosting' => [
            'label' => 'Domains & Hosting',
            'steps' => [
                'domain_search' => 'Searched a domain',
                'hosting_plan_view' => 'Viewed hosting plans',
                'hosting_plan_buy_click' => 'Clicked Buy on a plan',
                'checkout_begin' => 'Started checkout',
                'purchase' => 'Completed purchase',
            ],
        ],
        'website_quote' => [
            'label' => 'Website Design Quote',
            'steps' => [
                'website_quote_view' => 'Viewed the quote form',
                'website_quote_submit' => 'Submitted the quote request',
            ],
        ],
    ];

    public static function isValidEvent(string $funnel, string $eventName): bool
    {
        return isset(self::FUNNELS[$funnel]['steps'][$eventName]);
    }
}
