<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\SavedPaymentMethod;
use App\Services\Payments\SavedPaymentMethodService;
use Illuminate\Http\Request;

class SavedPaymentMethodController extends Controller
{
    public function index(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $methods = SavedPaymentMethod::query()
            ->where('client_id', $client->id)
            ->orderByDesc('is_default')
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $methods]);
    }

    public function update(Request $request, SavedPaymentMethod $paymentMethod, SavedPaymentMethodService $service)
    {
        $client = $request->user()->client;

        abort_if(! $client || $paymentMethod->client_id !== $client->id, 403, 'This payment method does not belong to your account.');

        $payload = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'use_for_auto_renewal' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('is_active', $payload)) {
            $paymentMethod->forceFill(['is_active' => $payload['is_active']])->save();
        }

        if (array_key_exists('use_for_auto_renewal', $payload)) {
            $paymentMethod->forceFill(['use_for_auto_renewal' => $payload['use_for_auto_renewal']])->save();
        }

        if (($payload['is_default'] ?? false) === true) {
            $service->setDefault($paymentMethod);
        }

        return response()->json(['data' => $paymentMethod->fresh()]);
    }

    public function destroy(Request $request, SavedPaymentMethod $paymentMethod)
    {
        $client = $request->user()->client;

        abort_if(! $client || $paymentMethod->client_id !== $client->id, 403, 'This payment method does not belong to your account.');

        $paymentMethod->delete();

        return response()->json(['message' => 'Payment method removed.']);
    }
}
