<?php

/**
 * The client-facing "Software" catalog. Each entry describes one installable
 * application: where to fetch it, what to build and run, and what a client
 * must actually supply versus what the installer generates on its own.
 *
 * Adding a second app should mostly mean adding another entry here plus
 * whatever install-step specifics that app needs in SoftwareInstallOrchestrator
 * — not new client-facing UI or routes.
 */
return [

    'naipay' => [
        'name' => 'Every Merchant (naipay)',
        'tagline' => 'Merchant microfinance administration platform',
        'description' => 'Onboard merchants, originate and manage loans, record repayments '
            .'and keep a double-entry ledger — the same system running production banking '
            .'operations at everymerchant.naitalk.com.',

        'git_url' => 'https://github.com/calebadeleye/naipay.git',
        'git_ref' => 'main',

        // Paths inside the cloned repo. Only these two components are real
        // today — naipay's own README marks apps/merchant-web and apps/mobile
        // as unbuilt placeholders for a future phase, so they're excluded.
        'backend_path' => 'backend/api',
        'frontend_path' => 'apps/admin-web',
        'frontend_workspace' => 'apps/admin-web',
        'frontend_build_command' => 'npm run build --workspace apps/admin-web',
        'frontend_start_command' => 'npm run start --workspace apps/admin-web -- -p {port}',
        // Confirmed against apps/admin-web/src/lib/env.ts: these are inlined
        // into the JS bundle at BUILD time (Next.js NEXT_PUBLIC_* rule), so
        // this file must exist with the final subdomain's URL *before*
        // `frontend_build_command` runs — not after.
        'frontend_env' => [
            'NEXT_PUBLIC_API_URL' => 'https://{subdomain}/api/v1',
            'NEXT_PUBLIC_APP_NAME' => 'Every Merchant',
            'NEXT_PUBLIC_ENVIRONMENT' => 'production',
        ],

        'queue_worker_command' => 'php artisan queue:work redis --queue=naipay-high,naipay-default,naipay-reports --sleep=3 --tries=3 --max-time=3600',

        'needs_redis' => true,
        'needs_mysql' => true,

        // Declarative prerequisites shown to the client before install.
        // `generate: true` means the installer supplies it; only fields
        // without `generate` are ever asked of the client.
        'prerequisites' => [
            [
                'key' => 'subdomain',
                'label' => 'Subdomain for this install',
                'type' => 'subdomain',
                'required' => true,
                'help' => 'e.g. "banking" becomes banking.yourdomain.com — this is where the app will live.',
            ],
            [
                'key' => 'admin_email',
                'label' => 'Your admin email address',
                'type' => 'email',
                'required' => true,
                'help' => 'The first login for the app is created with this email. A one-time password is generated for you.',
            ],
            ['key' => 'database', 'label' => 'MySQL database', 'generate' => true],
            ['key' => 'redis_isolation', 'label' => 'Redis cache/queue/session isolation', 'generate' => true],
            ['key' => 'app_key', 'label' => 'Application encryption key', 'generate' => true],
            ['key' => 'admin_password', 'label' => 'Admin password', 'generate' => true],
        ],
    ],

];
