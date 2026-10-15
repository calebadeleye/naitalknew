<?php

return [
    // Days after a hosting service's renews_at date before it moves from
    // 'expired' to 'suspended' (ISPConfig website deactivated).
    'grace_period_days' => (int) env('HOSTING_GRACE_PERIOD_DAYS', 30),

    // Days after suspension before the website is actually deleted from
    // ISPConfig — gives time for the final-warning emails below to land.
    'deletion_notice_days_after_suspension' => (int) env('HOSTING_DELETION_NOTICE_DAYS', 14),

    // Reminders before (and on, 0) a service's renews_at date — sent only
    // while that renewal is still unpaid. The renewal invoice itself goes out
    // renewal_invoice_lead_days (two months) before.
    'reminder_days_before_expiry' => [30, 7, 0],

    // Final warnings sent before a suspended service is deleted from ISPConfig.
    'final_warning_days_before_deletion' => [7, 3, 1],

    // Days before renews_at that a service gets its renewal invoice (and the
    // invoice email). A service already past renews_at without one gets it on
    // the next run (catch-up).
    'renewal_invoice_lead_days' => (int) env('HOSTING_RENEWAL_INVOICE_LEAD_DAYS', 60),

    // Auto-renewal (wallet first, then an enabled saved card) only charges a
    // renewal invoice from this many days before its due date.
    'auto_renewal_charge_days_before_due' => (int) env('HOSTING_AUTO_RENEWAL_CHARGE_DAYS', 7),

    // Consecutive auto-renewal payment failures for the same service before
    // admins get escalated (beyond the per-attempt failure email/log).
    'auto_renewal_failure_escalation_threshold' => (int) env('HOSTING_AUTO_RENEWAL_FAILURE_ESCALATION_THRESHOLD', 3),

    // Days before a domain's expires_at that its renewal invoice is
    // generated and auto-renewal payment attempted.
    'domain_renewal_lead_days' => (int) env('DOMAIN_RENEWAL_LEAD_DAYS', 14),

    // Domain expiry reminders sent before (and on) the expiry date.
    'domain_expiry_reminder_days' => [30, 14, 7, 1, 0],

    // Where a suspended website's visitors are sent (ISPConfig redirect). Must
    // end with "/" — ISPConfig appends the requested path to it.
    // Fetch each site's AWStats report from Apache on this server (127.0.0.1)
    // rather than over the internet. Turn off only if the backend moves to a
    // different machine from the hosted sites.
    'stats_fetch_via_loopback' => (bool) env('HOSTING_STATS_FETCH_VIA_LOOPBACK', true),

    'suspended_page_url' => env('HOSTING_SUSPENDED_PAGE_URL', 'https://www.naitalk.com/account-suspended/'),
];
