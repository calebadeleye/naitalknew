<?php

namespace App\Services\Greenmail;

use App\Models\Greenmail\GreenmailCampaignCredit;
use App\Models\Greenmail\GreenmailCampaignRecipient;
use App\Models\HostingService;
use App\Models\MailboxRecord;
use App\Models\Payment;
use App\Notifications\GreenmailCampaignEmailsLow;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * How many campaign emails a domain may send. Each billing month the hosting
 * plan gives a free number (hosting_plans.campaign_emails_monthly; 500 when
 * the plan sets none, e.g. legacy hosting); after that, prepaid credits are
 * used, oldest-expiring first. Shared by every mailbox of the domain. Only
 * delivered emails count: not failures, unsubscribed people or test sends.
 */
class CampaignQuota
{
    public static function domainOf(string $email): string
    {
        return strtolower(trim(Str::afterLast($email, '@')));
    }

    public function unlimited(string $domain): bool
    {
        return in_array($domain, array_map('strtolower', (array) config('greenmail.campaign_unlimited_domains')), true);
    }

    /** The hosting service the domain belongs to (its website, or the one its mailboxes are on). */
    public function service(string $domain): ?HostingService
    {
        $services = HostingService::query()->with('hostingPlan')
            ->whereIn('primary_domain', [$domain, "www.{$domain}"])
            ->orderByRaw("case when status = 'active' then 0 else 1 end")->latest('id')->get();

        if ($services->isEmpty()) {
            $ids = MailboxRecord::query()->where('email_address', 'like', '%@'.$domain)->whereNotNull('hosting_service_id')->pluck('hosting_service_id')->unique();
            $services = HostingService::query()->with('hostingPlan')->whereIn('id', $ids)->get();
        }

        // Several (e.g. a website plan and an email plan): the biggest allowance wins.
        return $services->sortByDesc(fn (HostingService $s) => (int) ($s->hostingPlan?->campaign_emails_monthly ?? 0))->first();
    }

    public function allowance(?HostingService $service): int
    {
        return (int) ($service?->hostingPlan?->campaign_emails_monthly ?? config('greenmail.campaign_free_monthly'));
    }

    /** The current month of the allowance, starting on the plan's billing day. */
    public function period(?HostingService $service): array
    {
        $anchor = $service?->next_due_date ?? $service?->starts_at;
        $day = $anchor ? Carbon::parse($anchor)->day : 1;
        $at = fn (Carbon $month) => $month->copy()->startOfMonth()->setDay(min($day, $month->daysInMonth))->startOfDay();

        $start = $at(now());
        if ($start->isFuture()) {
            $start = $at(now()->subMonthNoOverflow());
        }

        return [$start, $at($start->copy()->addMonthNoOverflow())];
    }

    public function usedFree(string $domain, Carbon $since): int
    {
        return GreenmailCampaignRecipient::query()
            ->whereHas('campaign', fn ($q) => $q->where('owner_email', 'like', '%@'.$domain))
            ->where('status', 'sent')->where('charged_to', 'plan')->where('sent_at', '>=', $since)->count();
    }

    public function credits(string $domain): int
    {
        return (int) GreenmailCampaignCredit::query()->where('domain', $domain)->where('expires_at', '>', now())->sum('remaining');
    }

    /** Everything the Campaigns page shows about the allowance. */
    public function status(string $domain): array
    {
        $service = $this->service($domain);
        [$start, $end] = $this->period($service);

        if ($this->unlimited($domain)) {
            // No cap, but still show how many went out this month.
            $sent = GreenmailCampaignRecipient::query()
                ->whereHas('campaign', fn ($q) => $q->where('owner_email', 'like', '%@'.$domain))
                ->where('status', 'sent')->where('sent_at', '>=', $start)->count();

            return ['unlimited' => true, 'available' => null, 'sent' => $sent, 'resets_at' => $end->toIso8601String(), 'packs' => $this->packs()];
        }
        $allowance = $this->allowance($service);
        $used = $this->usedFree($domain, $start);
        $credits = $this->credits($domain);
        $left = max(0, $allowance - $used);

        return [
            'unlimited' => false,
            'plan' => $service?->hostingPlan?->name,
            'allowance' => $allowance,
            'used' => $used,
            'left' => $left,
            'credits' => $credits,
            'credits_expire_at' => GreenmailCampaignCredit::query()->where('domain', $domain)->where('expires_at', '>', now())->where('remaining', '>', 0)->min('expires_at'),
            'available' => $left + $credits,
            'period_started_at' => $start->toIso8601String(),
            'resets_at' => $end->toIso8601String(),
            'can_buy' => (bool) $service?->client_id,
            'packs' => $this->packs(),
        ];
    }

    /** Emails that can still go out now (null: no limit). */
    public function available(string $domain): ?int
    {
        return $this->status($domain)['available'];
    }

    /**
     * Records what paid for one delivered email: the month's free emails, else
     * a credit. Returns plan | credit | free (no cap) | over (nothing left).
     */
    public function charge(string $domain): string
    {
        if ($this->unlimited($domain)) {
            return 'free';
        }

        $service = $this->service($domain);
        [$start] = $this->period($service);
        $allowance = $this->allowance($service);
        $used = $this->usedFree($domain, $start);

        if ($used < $allowance) {
            if ($allowance > 0 && $used + 1 >= (int) ceil($allowance * 0.8) && $this->credits($domain) === 0) {
                $this->warnLow($domain, $service, $used + 1, $allowance, $start);
            }

            return 'plan';
        }

        return DB::transaction(function () use ($domain) {
            $credit = GreenmailCampaignCredit::query()->where('domain', $domain)->where('expires_at', '>', now())->where('remaining', '>', 0)
                ->orderBy('expires_at')->lockForUpdate()->first();
            if (! $credit) {
                return 'over';
            }
            $credit->decrement('remaining');

            return 'credit';
        });
    }

    public function addCredits(string $domain, int $emails, string $source, ?Payment $payment = null, ?string $note = null): GreenmailCampaignCredit
    {
        return GreenmailCampaignCredit::query()->create([
            'domain' => $domain,
            'client_id' => $payment?->client_id ?? $this->service($domain)?->client_id,
            'amount' => $emails,
            'remaining' => $emails,
            'source' => $source,
            'payment_id' => $payment?->id,
            'note' => $note,
            'expires_at' => now()->addMonths((int) config('greenmail.campaign_credit_valid_months')),
        ]);
    }

    /** @return array<int, array{emails: int, price_kobo: int}> */
    public function packs(): array
    {
        return collect((array) config('greenmail.campaign_credit_packs'))
            ->map(fn ($price, $emails) => ['emails' => (int) $emails, 'price_kobo' => (int) $price])->values()->all();
    }

    /** One email to the account owner per allowance month when 80% is used and no credits are left. */
    private function warnLow(string $domain, ?HostingService $service, int $used, int $allowance, Carbon $periodStart): void
    {
        $client = $service?->client;
        if (! $client || ! Cache::add("greenmail-campaign-low:{$domain}:{$periodStart->toDateString()}", true, now()->addDays(40))) {
            return;
        }

        rescue(fn () => app(ClientNotifier::class)->notify(
            $client,
            new GreenmailCampaignEmailsLow($domain, $used, $allowance),
            'greenmail_campaign_emails_low',
            "{$domain} has used {$used} of its {$allowance} campaign emails this month",
            $service,
        ), report: true);
    }
}
