<?php

/*
 * Naitalk Call: the LiveKit media server on mail.naitalk.com, sold to
 * businesses as a monthly plan. The price is set in US dollars; the Naira
 * figure is worked out from the admin's USD→NGN rate (Domain Pricing
 * settings), so there is only one exchange rate to keep up to date.
 */
return [
    'plans' => [
        // For trying the service out (Cradle is on it for now). No charge.
        'free' => [
            'name' => 'Naitalk Call Free (testing)',
            'monthly_usd_cents' => 0,
        ],
        'business' => [
            'name' => 'Naitalk Call Business',
            'monthly_usd_cents' => 2000,
        ],
    ],

    // The server-side sync script and webhook router send this as a Bearer
    // token. Unset = the internal endpoints refuse every request.
    'sync_token' => env('NAITALK_CALL_SYNC_TOKEN'),

    // Where businesses point their LiveKit SDKs (proxied to the media server).
    'public_url' => env('NAITALK_CALL_PUBLIC_URL', 'wss://call.naitalk.com'),
];
