<?php

/*
 * Naitalk Call: the LiveKit media server on mail.naitalk.com, sold to
 * businesses as a monthly plan. Prices are set in US dollars; the Naira
 * figure uses the Central Bank of Nigeria's official rate, fetched daily
 * (naitalk-call:fetch-cbn-rate).
 *
 * A participant-minute is one person in a call for one minute: a 10-minute
 * call between 3 people uses 30.
 */
return [
    'plans' => [
        // For trying it out while building (Cradle is on it for now).
        'free' => [
            'name' => 'Free',
            'tagline' => 'For testing while you build',
            'monthly_usd_cents' => 0,
            'included_minutes' => 5_000,
            'features' => [
                'One-to-one and group voice calls',
                'Web, iOS and Android SDKs',
                'Your own API key and webhooks',
                'For development and testing, not live traffic',
            ],
        ],
        'starter' => [
            'name' => 'Starter',
            'tagline' => 'For developers launching an app',
            'monthly_usd_cents' => 2000,
            'included_minutes' => 50_000,
            'features' => [
                'One-to-one and group voice calls',
                'No arbitrary room-size restriction by subscription tier',
                'Web, iOS and Android SDKs',
                'API access and usage dashboard',
                'Upgrade when you need more minutes',
            ],
        ],
        'growth' => [
            'name' => 'Growth',
            'tagline' => 'For growing apps',
            'monthly_usd_cents' => 4900,
            'included_minutes' => 200_000,
            'features' => [
                'All Starter features',
                'Larger monthly usage allowance',
                'Usage alerts and billing reports',
                'Higher API request allowance',
            ],
        ],
        'business' => [
            'name' => 'Business',
            'tagline' => 'For established apps',
            'monthly_usd_cents' => 9900,
            'included_minutes' => 500_000,
            'features' => [
                'All Growth features',
                'Higher usage and API allowances',
                'Priority support',
                'Options for capacity planning as demand grows',
            ],
        ],
    ],

    // New businesses start here unless the admin picks another plan.
    'default_plan' => 'starter',

    // Central Bank of Nigeria rate table (JSON, newest first). US DOLLAR's
    // central rate is the official USD→NGN rate.
    'cbn_rates_url' => env('NAITALK_CALL_CBN_RATES_URL', 'https://www.cbn.gov.ng/api/GetAllExchangeRates'),

    // The server-side sync script and webhook router send this as a Bearer
    // token. Unset = the internal endpoints refuse every request.
    'sync_token' => env('NAITALK_CALL_SYNC_TOKEN'),

    // Where businesses point their LiveKit SDKs (proxied to the media server).
    'public_url' => env('NAITALK_CALL_PUBLIC_URL', 'wss://call.naitalk.com'),
];
