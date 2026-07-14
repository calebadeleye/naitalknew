<?php

use App\Services\Domains\Registrars\CloudflareRegistrarService;
use App\Services\Domains\Registrars\SpaceshipRegistrarAdapter;

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'pexels' => [
        'api_key' => env('PEXELS_API_KEY'),
        'cache_ttl' => (int) env('PEXELS_CACHE_TTL', 86400),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'paystack' => [
        'public_key' => env('PAYSTACK_PUBLIC_KEY'),
        'secret_key' => env('PAYSTACK_SECRET_KEY'),
    ],

    'flutterwave' => [
        'public_key' => env('FLUTTERWAVE_PUBLIC_KEY'),
        'secret_key' => env('FLUTTERWAVE_SECRET_KEY'),
        'webhook_hash' => env('FLUTTERWAVE_WEBHOOK_SECRET_HASH'),
    ],

    'bank_transfer' => [
        'bank_name' => env('BANK_TRANSFER_BANK_NAME', 'Zenith Bank'),
        'account_name' => env('BANK_TRANSFER_ACCOUNT_NAME', 'NAI TALK'),
        'account_number' => env('BANK_TRANSFER_ACCOUNT_NUMBER', '1310414891'),
    ],

    'spaceship' => [
        'api_key' => env('SPACESHIP_API_KEY'),
        'api_secret' => env('SPACESHIP_API_SECRET'),
        'base_url' => env('SPACESHIP_API_BASE_URL', 'https://spaceship.dev/api/v1'),
        // Spaceship has no public sandbox environment — when true, SpaceshipClient
        // simulates responses locally instead of calling the live (real-money,
        // irreversible) API. Defaults to true so a fresh checkout of this app
        // never accidentally registers a real domain.
        'sandbox_mode' => (bool) env('SPACESHIP_SANDBOX_MODE', true),
        'webhook_secret' => env('SPACESHIP_WEBHOOK_SECRET'),
    ],

    'cloudflare' => [
        'account_id' => env('CLOUDFLARE_ACCOUNT_ID'),
        // A scoped Registrar-only API token — never the Global API Key.
        'registrar_api_token' => env('CLOUDFLARE_REGISTRAR_API_TOKEN'),
        'base_url' => env('CLOUDFLARE_API_BASE_URL', 'https://api.cloudflare.com/client/v4'),
        // Same rationale as Spaceship's sandbox_mode above — defaults true so
        // this integration never makes a real registrar-changing call until
        // explicitly turned off with real credentials in place.
        'sandbox_mode' => (bool) env('CLOUDFLARE_SANDBOX_MODE', true),
        // The registrar-scoped token above likely lacks Zones:Read — the
        // "Cloudflare DNS only" distinction stays disabled until a
        // Zones-capable token is available. See CloudflareZonesClient.
        'zones_lookup_enabled' => (bool) env('CLOUDFLARE_ZONES_LOOKUP_ENABLED', false),
    ],

    'registrars' => [
        'default' => 'spaceship',
        'map' => [
            'spaceship' => SpaceshipRegistrarAdapter::class,
            'cloudflare' => CloudflareRegistrarService::class,
        ],
        // Nigerian domains stay manual/unavailable-for-instant-registration
        // regardless of provider — no currently configured registrar
        // supports automated purchase of these.
        'manual_only_tlds' => ['.ng', '.com.ng', '.org.ng', '.net.ng'],
    ],

];
