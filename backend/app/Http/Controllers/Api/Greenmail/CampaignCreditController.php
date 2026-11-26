<?php

namespace App\Http\Controllers\Api\Greenmail;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Greenmail\GreenmailSetting;
use App\Models\Payment;
use App\Services\Greenmail\CampaignQuota;
use App\Services\Payments\FlutterwaveGateway;
use App\Services\Payments\PaymentMethodSettings;
use App\Services\Payments\PaystackGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Campaign emails left this month, and buying more: a pack is paid by card
 * (Paystack or Flutterwave) like a wallet top-up; PaymentGatewayController
 * adds the credits to the domain once the payment is confirmed.
 */
class CampaignCreditController extends Controller
{
    public function show(Request $request, CampaignQuota $quota)
    {
        return response()->json(['quota' => $quota->status(CampaignQuota::domainOf($this->owner($request)))] + ['gateways' => $this->gateways()]);
    }

    public function checkout(Request $request, CampaignQuota $quota)
    {
        $packs = collect($quota->packs())->keyBy('emails');
        $data = $request->validate([
            'emails' => ['required', 'integer', 'in:'.$packs->keys()->implode(',')],
            'gateway' => ['nullable', 'in:paystack,flutterwave'],
        ]);

        $owner = $this->owner($request);
        $domain = CampaignQuota::domainOf($owner);
        abort_if($quota->unlimited($domain), 422, 'Campaigns from this domain have no limit.');
        $service = $quota->service($domain);
        abort_unless($service?->client_id, 422, 'This domain is not linked to a NAI TALK account yet. Please contact support to buy campaign emails.');

        $gateway = $data['gateway'] ?? ($this->gateways()[0] ?? null);
        abort_unless($gateway && in_array($gateway, $this->gateways(), true), 422, 'Card payment is not available at the moment. Please try again later.');

        $pack = $packs[$data['emails']];
        $reference = 'GMCREDITS-'.Str::upper(Str::random(12));
        $name = GreenmailSetting::query()->where('owner_email', $owner)->value('display_name') ?: $owner;

        try {
            $url = $gateway === 'paystack'
                ? app(PaystackGateway::class)->initialize($owner, $pack['price_kobo'], $reference, rtrim((string) config('app.url'), '/').'/api/v1/payments/paystack/callback')['authorization_url']
                : app(FlutterwaveGateway::class)->initialize($owner, $name, $pack['price_kobo'], $reference, rtrim((string) config('app.url'), '/').'/api/v1/payments/flutterwave/callback')['link'];
        } catch (PaymentGatewayException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        Payment::query()->create([
            'client_id' => $service->client_id,
            'invoice_id' => null,
            'gateway' => $gateway,
            'purpose' => 'greenmail_credits',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $pack['price_kobo'],
            'currency' => 'NGN',
            'gateway_payload' => ['greenmail_credits' => ['domain' => $domain, 'emails' => $pack['emails'], 'mailbox' => $owner]],
        ]);

        return response()->json(['url' => $url, 'reference' => $reference]);
    }

    /** @return array<int, string> */
    private function gateways(): array
    {
        $settings = app(PaymentMethodSettings::class);

        return array_values(array_filter(['paystack', 'flutterwave'], fn ($g) => $settings->isAvailable($g)));
    }

    private function owner(Request $request): string
    {
        return $request->attributes->get('greenmail_session')->email;
    }
}
