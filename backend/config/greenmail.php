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

    'per_page' => 25,
    'max_attachment_mb' => 20,
];
