<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\NaitalkCallTenant;
use App\Models\NaitalkCallUsageEvent;
use App\Services\Billing\Money;
use App\Services\NaitalkCall\NaitalkCallPricing;
use App\Services\NaitalkCall\NaitalkCallUsage;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The client's Naitalk Call usage dashboard: their plan, minutes this month
 * against its allowance, daily and monthly usage, connection details (never
 * the secret), and a CSV usage report per month.
 */
class NaitalkCallController extends Controller
{
    public function __construct(private readonly NaitalkCallPricing $pricing, private readonly NaitalkCallUsage $usage) {}

    public function index(Request $request)
    {
        $client = $request->user()->client;
        abort_if(! $client, 404, 'Client profile not found.');

        $tenants = NaitalkCallTenant::query()->where('client_id', $client->id)->orderBy('business_name')->get();
        $minutes = $this->usage->minutesThisMonth($tenants->pluck('id')->all());

        return response()->json([
            'data' => $tenants->map(function (NaitalkCallTenant $tenant) use ($minutes) {
                $plan = $this->pricing->plan($tenant->plan, $tenant->monthly_price_usd_cents);
                $used = (int) ($minutes[$tenant->id] ?? 0);

                return [
                    'id' => $tenant->id,
                    'business_name' => $tenant->business_name,
                    'status' => $tenant->status,
                    'plan' => [...$plan, 'monthly_ngn' => $plan['monthly_ngn_kobo'] === null ? null : Money::naira($plan['monthly_ngn_kobo'])],
                    'usage' => [
                        'month' => now()->format('Y-m'),
                        'minutes' => $used,
                        'included_minutes' => $plan['included_minutes'],
                        'percent' => NaitalkCallUsage::percent($used, $plan['included_minutes']),
                        'alerts' => (bool) config("naitalk_call.plans.{$tenant->plan}.usage_alerts", false),
                    ],
                    'daily' => $this->usage->daily($tenant, now()),
                    'monthly' => $this->usage->monthly($tenant),
                    'connection' => [
                        'url' => config('naitalk_call.public_url'),
                        'api_key' => $tenant->key_source === 'managed' ? $tenant->api_key : null,
                        'room_prefix' => $tenant->room_prefix,
                        'webhook_url' => $tenant->webhook_url,
                    ],
                ];
            }),
            'exchange_rate' => $this->pricing->exchangeRate(),
        ]);
    }

    /** Every metered participant in a month, for billing and their own records. */
    public function report(Request $request, NaitalkCallTenant $tenant): StreamedResponse
    {
        $client = $request->user()->client;
        abort_if(! $client || $tenant->client_id !== $client->id, 404);
        $payload = $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $month = Carbon::createFromFormat('Y-m', $payload['month'] ?? now()->format('Y-m'))->startOfMonth();

        $events = NaitalkCallUsageEvent::query()
            ->where('tenant_id', $tenant->id)
            ->whereBetween('left_at', [$month, $month->copy()->endOfMonth()])
            ->orderBy('left_at');
        $name = 'naitalk-call-usage-'.$tenant->room_prefix.'-'.$month->format('Y-m').'.csv';

        return response()->streamDownload(function () use ($events) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['left_at_utc', 'room', 'participant', 'seconds', 'participant_minutes']);
            $total = 0;
            foreach ($events->lazy() as $event) {
                $total += $event->seconds;
                fputcsv($out, [$event->left_at->utc()->toIso8601String(), $event->room_name, $event->participant_identity, $event->seconds, NaitalkCallUsage::minutes($event->seconds)]);
            }
            fputcsv($out, ['total', '', '', $total, NaitalkCallUsage::minutes($total)]);
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv']);
    }
}
