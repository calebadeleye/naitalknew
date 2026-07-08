<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ServiceOffering;
use App\Services\Billing\Money;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ServiceOfferingController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => ServiceOffering::query()
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get()
                ->map(fn (ServiceOffering $offering) => $this->serialize($offering)),
        ]);
    }

    public function store(Request $request)
    {
        $payload = $this->validatePayload($request);
        $payload['slug'] = $payload['slug'] ?: Str::slug($payload['name']);

        $offering = ServiceOffering::query()->create($payload);

        return response()->json($this->serialize($offering), 201);
    }

    public function update(Request $request, ServiceOffering $serviceOffering)
    {
        $payload = $this->validatePayload($request, $serviceOffering);
        $payload['slug'] = $payload['slug'] ?: Str::slug($payload['name']);
        $serviceOffering->update($payload);

        return response()->json($this->serialize($serviceOffering->refresh()));
    }

    public function destroy(ServiceOffering $serviceOffering)
    {
        $serviceOffering->forceFill(['is_active' => false])->save();

        return response()->json($this->serialize($serviceOffering->refresh()));
    }

    private function validatePayload(Request $request, ?ServiceOffering $serviceOffering = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', Rule::unique('service_offerings', 'slug')->ignore($serviceOffering)],
            'category' => ['required', 'in:hosting,web_development,maintenance,ai,email_addon,backup_addon,other'],
            'short_description' => ['required', 'string', 'max:255'],
            'benefits' => ['nullable', 'array'],
            'benefits.*' => ['string', 'max:200'],
            'price_kobo' => ['nullable', 'integer', 'min:0'],
            'billing_type' => ['required', 'in:one_time,monthly,yearly,custom_quote'],
            'is_quote_only' => ['boolean'],
            'is_active' => ['boolean'],
            'sort_order' => ['required', 'integer', 'min:0'],
        ]);
    }

    private function serialize(ServiceOffering $offering): array
    {
        return [
            'id' => $offering->id,
            'name' => $offering->name,
            'slug' => $offering->slug,
            'category' => $offering->category,
            'short_description' => $offering->short_description,
            'benefits' => $offering->benefits ?? [],
            'price_kobo' => $offering->price_kobo,
            'price' => $offering->price_kobo ? Money::naira($offering->price_kobo) : null,
            'billing_type' => $offering->billing_type,
            'is_quote_only' => $offering->is_quote_only,
            'is_active' => $offering->is_active,
            'sort_order' => $offering->sort_order,
        ];
    }
}
