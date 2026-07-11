<?php

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

];
