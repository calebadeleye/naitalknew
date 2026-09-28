<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\Billing\VatCalculator;
use Illuminate\Http\Request;
use App\Models\AppSetting;

/**
 * Admin switch for VAT. When off, every new order, renewal, domain and
 * invoice is created with 0% VAT; invoices already issued keep the VAT
 * they were created with (and can still be edited while unpaid).
 */
class BillingSettingsController extends Controller
{
    public function show()
    {
        return response()->json($this->payload());
    }

    public function update(Request $request)
    {
        $payload = $request->validate(['vat_enabled' => ['required', 'boolean']]);
        $before = VatCalculator::isEnabled();

        AppSetting::put(VatCalculator::SETTING_KEY, (bool) $payload['vat_enabled']);

        if ($before !== (bool) $payload['vat_enabled']) {
            AuditLog::query()->create([
                'staff_user_id' => $request->user()->id,
                'action' => 'vat_setting_changed',
                'reason' => 'VAT '.($payload['vat_enabled'] ? 'enabled' : 'disabled').' for new orders and invoices.',
                'before_state' => ['vat_enabled' => $before],
                'after_state' => ['vat_enabled' => (bool) $payload['vat_enabled']],
                'source' => 'admin',
                'notify_client' => false,
            ]);
        }

        return response()->json($this->payload());
    }

    /**
     * @return array{vat_enabled: bool, configured_vat_rate: float, current_vat_rate: float}
     */
    private function payload(): array
    {
        return [
            'vat_enabled' => VatCalculator::isEnabled(),
            'configured_vat_rate' => (float) config('billing.vat_rate'),
            'current_vat_rate' => VatCalculator::currentRate(),
        ];
    }
}
