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
];
