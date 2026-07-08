<?php

return [
    'host' => env('ISPCONFIG_HOST'),
    'port' => (int) env('ISPCONFIG_PORT', 8080),
    'remote_user' => env('ISPCONFIG_REMOTE_USER'),
    'remote_password' => env('ISPCONFIG_REMOTE_PASSWORD'),
    'server_id' => (int) env('ISPCONFIG_SERVER_ID', 1),
    // The hostname clients should enter in their FTP/mail client — not
    // necessarily the same as the ISPConfig control panel host above.
    'public_hostname' => env('ISPCONFIG_PUBLIC_HOSTNAME', 'millions.naitalk.com'),
    'client_template_id' => env('ISPCONFIG_CLIENT_TEMPLATE_ID'),
    'website_template_id' => env('ISPCONFIG_WEBSITE_TEMPLATE_ID'),
    'verify_ssl' => (bool) env('ISPCONFIG_VERIFY_SSL', true),
];
