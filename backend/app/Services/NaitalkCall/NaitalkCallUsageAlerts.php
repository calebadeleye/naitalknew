<?php

namespace App\Services\NaitalkCall;

use App\Models\NaitalkCallTenant;
use App\Notifications\NaitalkCallUsageWarning;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Emails businesses on plans with usage alerts (Growth, Business) when they
 * reach 80% and 100% of the month's participant-minutes, once per level per
 * month. A business linked to a client account is emailed through it (and
 * logged with its notifications); otherwise its contact email gets it.
 */
class NaitalkCallUsageAlerts
{
    public const LEVELS = [100, 80];

    public function __construct(private readonly NaitalkCallUsage $usage, private readonly ClientNotifier $notifier) {}

    /** Returns how many alerts went out. */
    public function check(): int
    {
        $plans = collect(config('naitalk_call.plans'))->filter(fn (array $plan) => ! empty($plan['usage_alerts']))->keys()->all();
        $tenants = NaitalkCallTenant::query()->with('client.user')->where('status', 'active')->whereIn('plan', $plans)->get();
        $minutes = $this->usage->minutesThisMonth($tenants->pluck('id')->all());
        $period = now()->format('Y-m');
        $sent = 0;

        foreach ($tenants as $tenant) {
            $included = (int) config("naitalk_call.plans.{$tenant->plan}.included_minutes", 0);
            $used = (int) ($minutes[$tenant->id] ?? 0);
            $percent = NaitalkCallUsage::percent($used, $included);
            $level = collect(self::LEVELS)->first(fn (int $l) => $percent >= $l);
            if ($level === null) {
                continue;
            }
            // Past 100% straight away: one alert, not an 80% one as well.
            $already = DB::table('naitalk_call_usage_alerts')->where('tenant_id', $tenant->id)->where('period', $period)->where('level', '>=', $level)->exists();
            if ($already || ! ($recipient = $tenant->client?->user?->email ?: $tenant->client?->billing_email ?: $tenant->contact_email)) {
                continue;
            }

            $notification = new NaitalkCallUsageWarning($tenant, (string) config("naitalk_call.plans.{$tenant->plan}.name"), $level, $used, $included);
            if ($tenant->client) {
                $this->notifier->notify(
                    client: $tenant->client,
                    notification: $notification,
                    template: "naitalk_call_usage_{$tenant->id}_{$level}_{$period}",
                    subject: "Naitalk Call: {$tenant->business_name} has used {$level}% of this month's minutes",
                    payload: ['tenant_id' => $tenant->id, 'level' => $level, 'used_minutes' => $used, 'included_minutes' => $included],
                );
            } else {
                Notification::route('mail', $recipient)->notify($notification);
            }

            DB::table('naitalk_call_usage_alerts')->insert([
                'tenant_id' => $tenant->id, 'period' => $period, 'level' => $level, 'recipient' => $recipient,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            $sent++;
        }

        return $sent;
    }
}
