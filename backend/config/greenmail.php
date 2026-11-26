<?php

/*
 * Greenmail — NAI TALK's own webmail for hosted mailboxes (www.naitalk.com/greenmail).
 * The backend runs on the mail server itself, so IMAP/SMTP go over 127.0.0.1;
 * the certificate is for mail.naitalk.com, so it isn't verified on loopback.
 */
return [
    'public_url' => env('GREENMAIL_PUBLIC_URL', rtrim((string) env('FRONTEND_URL', 'https://www.naitalk.com'), '/').'/greenmail'),

    'imap' => [
        'host' => env('GREENMAIL_IMAP_HOST', '127.0.0.1'),
        'port' => (int) env('GREENMAIL_IMAP_PORT', 993),
        'encryption' => env('GREENMAIL_IMAP_ENCRYPTION', 'ssl'),
        'validate_cert' => (bool) env('GREENMAIL_IMAP_VALIDATE_CERT', false),
        'timeout' => (int) env('GREENMAIL_IMAP_TIMEOUT', 20),
    ],

    'smtp' => [
        'host' => env('GREENMAIL_SMTP_HOST', '127.0.0.1'),
        'port' => (int) env('GREENMAIL_SMTP_PORT', 587),
        'verify_peer' => (bool) env('GREENMAIL_SMTP_VERIFY_PEER', false),
    ],

    // A signed-in browser stays signed in while used; it is signed out after
    // this much inactivity, and after the absolute limit regardless.
    'session_idle_minutes' => (int) env('GREENMAIL_SESSION_IDLE_MINUTES', 480),
    'session_max_days' => (int) env('GREENMAIL_SESSION_MAX_DAYS', 7),
    // "Keep me signed in on this device" (and the phone app): much longer, so
    // opening the app the next morning or from a notification doesn't ask for
    // the password again.
    'remembered_idle_days' => (int) env('GREENMAIL_REMEMBERED_IDLE_DAYS', 30),
    'remembered_max_days' => (int) env('GREENMAIL_REMEMBERED_MAX_DAYS', 90),

    'per_page' => 25,
    'max_attachment_mb' => 20,

    // ISPConfig reads the vacation reply's start/end times in the server's own zone.
    'server_timezone' => env('GREENMAIL_SERVER_TIMEZONE', 'Europe/Berlin'),

    // Filters and automation rules per mailbox (each kind).
    'max_rules' => 50,

    // Campaigns go out a few at a time so the server's reputation (and every
    // other customer's mail) isn't put at risk by one big send.
    'campaign_per_minute' => (int) env('GREENMAIL_CAMPAIGN_PER_MINUTE', 20),
    // The mail server (rspamd ratelimit.conf) lets each mailbox send 50 emails an
    // hour; campaigns stay under it and leave room for ordinary mail.
    'campaign_hourly_limit' => (int) env('GREENMAIL_CAMPAIGN_HOURLY_LIMIT', 40),
    // When the mail server still says "try later" (4xx), wait this long and carry on.
    'campaign_retry_minutes' => (int) env('GREENMAIL_CAMPAIGN_RETRY_MINUTES', 15),
    // Raised from 500 with credit packs, so a bought 1,000 isn't spread over days;
    // the hourly limit above still paces sending.
    'campaign_daily_limit' => (int) env('GREENMAIL_CAMPAIGN_DAILY_LIMIT', 2000),

    // Campaign emails each month come free with the hosting plan
    // (hosting_plans.campaign_emails_monthly); this is the amount for a domain
    // with no plan set (e.g. legacy hosting). After that, prepaid packs.
    'campaign_free_monthly' => (int) env('GREENMAIL_CAMPAIGN_FREE_MONTHLY', 500),
    'campaign_credit_packs' => [
        // emails => price in kobo (VAT inclusive)
        1000 => 250_000,
        5000 => 1_000_000,
        10000 => 1_750_000,
    ],
    'campaign_credit_valid_months' => 12,
    // NAI TALK's own domains: no cap.
    'campaign_unlimited_domains' => array_filter(explode(',', (string) env('GREENMAIL_CAMPAIGN_UNLIMITED_DOMAINS', 'naitalk.com'))),
    'campaign_max_recipients' => (int) env('GREENMAIL_CAMPAIGN_MAX_RECIPIENTS', 1000),
    'max_scheduled' => 50,

    // Web Push (phone/desktop notifications). Keys: php artisan greenmail:vapid-keys --write
    'vapid' => [
        'public_key' => env('GREENMAIL_VAPID_PUBLIC_KEY'),
        'private_key' => env('GREENMAIL_VAPID_PRIVATE_KEY'),
        'subject' => env('GREENMAIL_VAPID_SUBJECT', 'mailto:hello@naitalk.com'),
    ],

    // Devices signed up for notifications per mailbox.
    'max_push_devices' => 10,
];
