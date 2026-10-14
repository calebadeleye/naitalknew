<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\Payments\PaymentMethodSettings;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Admin: switch payment methods on/off and set each gateway's keys. */
class PaymentMethodsController extends Controller
{
    public function show(PaymentMethodSettings $settings)
    {
        return response()->json($this->payload($settings));
    }

    public function update(Request $request, string $method, PaymentMethodSettings $settings)
    {
        abort_unless(isset(PaymentMethodSettings::METHODS[$method]), 404);

        $fields = PaymentMethodSettings::METHODS[$method]['fields'];
        $rules = ['enabled' => ['required', 'boolean'], 'values' => ['nullable', 'array']];

        foreach ($fields as $name => $definition) {
            $rules["values.{$name}"] = isset($definition['options'])
                ? ['nullable', Rule::in($definition['options'])]
                : ($name === 'ngn_rate' ? ['nullable', 'numeric', 'min:0.0001', 'max:100000'] : ['nullable', 'string', 'max:500']);
        }

        $data = $request->validate($rules);
        $wasEnabled = $settings->isEnabled($method);

        $settings->update($method, (bool) $data['enabled'], array_intersect_key($data['values'] ?? [], $fields));

        if ((bool) $data['enabled'] && ! $settings->isConfigured($method)) {
            // Saved, but tell the admin clients won't see it yet.
            $warning = PaymentMethodSettings::METHODS[$method]['label'].' is switched on but some required details are missing, so clients will not see it until they are filled in.';
        }

        AuditLog::query()->create([
            'staff_user_id' => $request->user()->id,
            'action' => 'payment_method_updated',
            'reason' => PaymentMethodSettings::METHODS[$method]['label'].' settings updated.',
            // Field names only — never the keys themselves.
            'before_state' => ['enabled' => $wasEnabled],
            'after_state' => ['enabled' => (bool) $data['enabled'], 'fields_changed' => array_keys(array_filter($data['values'] ?? [], fn ($value) => filled($value)))],
            'source' => 'admin',
            'notify_client' => false,
        ]);

        return response()->json($this->payload($settings) + ['warning' => $warning ?? null]);
    }

    private function payload(PaymentMethodSettings $settings): array
    {
        $base = rtrim(config('app.url'), '/');

        return [
            'methods' => $settings->adminView(),
            'webhooks' => [
                'paystack' => $base.'/api/v1/payments/paystack/webhook',
                'flutterwave' => $base.'/api/v1/payments/flutterwave/webhook',
                'stripe' => $base.'/api/v1/payments/stripe/webhook',
            ],
        ];
    }
}
