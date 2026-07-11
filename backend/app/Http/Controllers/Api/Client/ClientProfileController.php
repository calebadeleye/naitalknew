<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ClientActivityLog;
use App\Services\Clients\ClientActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class ClientProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user();
        $client = $user->client;

        abort_if(! $client, 404, 'Client profile not found.');

        return response()->json($this->serialize($user, $client));
    }

    /**
     * Email is deliberately not editable here — changing it would need a
     * re-verification flow this endpoint doesn't implement, so it stays
     * read-only in the client portal for now.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        $client = $user->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'country' => ['sometimes', 'nullable', 'string', 'max:120'],
            'state' => ['sometimes', 'nullable', 'string', 'max:120'],
            'city' => ['sometimes', 'nullable', 'string', 'max:120'],
            'address' => ['sometimes', 'nullable', 'string', 'max:500'],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'industry' => ['sometimes', 'nullable', 'string', 'max:120'],
            'support_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'company_size' => ['sometimes', 'nullable', 'string', 'max:60'],
            'tax_id' => ['sometimes', 'nullable', 'string', 'max:60'],
        ]);

        $user->forceFill(collect($payload)->only(['name', 'phone'])->all())->save();

        $client->forceFill(
            collect($payload)
                ->only(['country', 'state', 'city', 'address', 'company_name', 'website', 'industry', 'support_email', 'company_size', 'tax_id'])
                ->all()
        )->save();

        return response()->json($this->serialize($user->fresh(), $client->fresh()));
    }

    public function updateCommunicationPreferences(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'invoice_alerts' => ['required', 'boolean'],
            'renewal_reminders' => ['required', 'boolean'],
            'product_updates' => ['required', 'boolean'],
        ]);

        $client->forceFill(['communication_preferences' => $payload])->save();

        return response()->json(['communication_preferences' => $client->fresh()->communicationPreferences()]);
    }

    /**
     * Both toggles are stored preferences only — two_factor_enabled does not
     * yet enforce a second factor at login (see migration comment), and
     * login_alerts_enabled doesn't yet trigger a notification email. Both
     * are honest, real, persisted settings; the enforcement/notification
     * behavior behind them is a separate follow-up.
     */
    public function updateSecurity(Request $request, ClientActivityLogger $activityLogger)
    {
        $user = $request->user();
        $client = $user->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $payload = $request->validate([
            'two_factor_enabled' => ['sometimes', 'boolean'],
            'login_alerts_enabled' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('two_factor_enabled', $payload) && $payload['two_factor_enabled'] !== $user->two_factor_enabled) {
            $activityLogger->log(
                $client,
                $payload['two_factor_enabled'] ? 'two_factor_enabled' : 'two_factor_disabled',
                $payload['two_factor_enabled'] ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
                $request,
            );
        }

        $user->forceFill($payload)->save();

        return response()->json([
            'two_factor_enabled' => $user->fresh()->two_factor_enabled,
            'login_alerts_enabled' => $user->fresh()->login_alerts_enabled,
        ]);
    }

    public function changePassword(Request $request, ClientActivityLogger $activityLogger)
    {
        $user = $request->user();
        $client = $user->client;

        $payload = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:10', 'max:255', 'confirmed'],
        ]);

        if (! Hash::check($payload['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Your current password is incorrect.'],
            ]);
        }

        $user->forceFill(['password' => $payload['password']])->save();

        if ($client) {
            $activityLogger->log($client, 'password_changed', 'Password changed', $request);
        }

        return response()->json(['message' => 'Password updated successfully.']);
    }

    /**
     * Merges the real security-event feed with recent payments so the
     * activity list reads like a single timeline, same as the design —
     * without duplicating payment data into a second log table.
     */
    public function activity(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $events = ClientActivityLog::query()
            ->where('client_id', $client->id)
            ->latest('created_at')
            ->limit(20)
            ->get()
            ->map(fn (ClientActivityLog $log) => [
                'type' => $log->type,
                'description' => $log->description,
                'location' => $log->ip_address,
                'occurred_at' => $log->created_at?->toIso8601String(),
            ]);

        $payments = $client->payments()
            ->whereNotNull('paid_at')
            ->latest('paid_at')
            ->limit(20)
            ->get()
            ->map(fn ($payment) => [
                'type' => 'payment',
                'description' => 'Payment received',
                'reference' => $payment->reference,
                'amount_kobo' => $payment->amount_kobo,
                'occurred_at' => $payment->paid_at?->toIso8601String(),
            ]);

        $timeline = $events->concat($payments)
            ->sortByDesc('occurred_at')
            ->values()
            ->take(20);

        return response()->json(['data' => $timeline]);
    }

    private function serialize($user, $client): array
    {
        return [
            'customer_id' => $client->client_code,
            'member_since' => $client->created_at?->toDateString(),
            'account_status' => $client->client_status,
            'personal' => [
                'full_name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'country' => $client->country,
                'state' => $client->state,
                'city' => $client->city,
                'address' => $client->address,
            ],
            'company' => [
                'business_name' => $client->company_name,
                'website' => $client->website,
                'industry' => $client->industry,
                'support_email' => $client->support_email,
                'company_size' => $client->company_size,
                'tax_id' => $client->tax_id,
            ],
            'security' => [
                'two_factor_enabled' => $user->two_factor_enabled,
                'login_alerts_enabled' => $user->login_alerts_enabled,
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'last_login_ip' => $user->last_login_ip,
            ],
            'communication_preferences' => $client->communicationPreferences(),
        ];
    }
}
