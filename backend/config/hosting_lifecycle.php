<?php

return [
    // Days after a hosting service's renews_at date before it moves from
    // 'expired' to 'suspended' (ISPConfig website deactivated).
    'grace_period_days' => (int) env('HOSTING_GRACE_PERIOD_DAYS', 30),

    // Days after suspension before the website is actually deleted from
    // ISPConfig — gives time for the final-warning emails below to land.
    'deletion_notice_days_after_suspension' => (int) env('HOSTING_DELETION_NOTICE_DAYS', 14),

    // Renewal reminders sent before a service's renews_at date.
    'reminder_days_before_expiry' => [30, 14, 7, 1],

    // Final warnings sent before a suspended service is deleted from ISPConfig.
    'final_warning_days_before_deletion' => [7, 3, 1],

    // Days before renews_at that a standard (non-legacy) auto-renewing
    // service gets its renewal invoice generated and auto-renewal payment
    // attempted (wallet-first, then enabled saved card).
    'renewal_invoice_lead_days' => (int) env('HOSTING_RENEWAL_INVOICE_LEAD_DAYS', 7),

    // Consecutive auto-renewal payment failures for the same service before
    // admins get escalated (beyond the per-attempt failure email/log).
    'auto_renewal_failure_escalation_threshold' => (int) env('HOSTING_AUTO_RENEWAL_FAILURE_ESCALATION_THRESHOLD', 3),
];
