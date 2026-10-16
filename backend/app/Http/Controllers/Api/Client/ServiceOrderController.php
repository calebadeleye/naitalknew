<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\ServiceOffering;
use App\Models\TermsAcceptance;
use App\Services\Billing\ServiceOrderService;
use App\Services\Domains\DomainNameValidator;
use Illuminate\Http\Request;

/** Order a stand-alone service (e.g. an SSL certificate); returns the invoice to pay. */
class ServiceOrderController extends Controller
{
    public function store(Request $request, ServiceOrderService $orders)
    {
        $client = $request->user()->client;
        abort_if(! $client, 404, 'Client profile not found.');

        $offering = ServiceOffering::query()->where('slug', (string) $request->input('offering'))->where('is_active', true)->where('is_orderable', true)->first();
        abort_unless($offering, 404, 'That service is not available to order online.');

        // People paste "https://www.shop.com/" — keep just the address.
        if (is_string($request->input('domain'))) {
            $request->merge(['domain' => strtolower(trim((string) preg_replace('#^https?://|/.*$#i', '', trim($request->input('domain')))))]);
        }

        $data = $request->validate([
            'offering' => ['required', 'string'],
            'domain' => [$offering->requires_domain ? 'required' : 'nullable', 'string', 'max:255', DomainNameValidator::rule()],
            'notes' => ['nullable', 'string', 'max:2000'],
            'terms_accepted' => ['accepted'],
        ], ['domain.required' => 'Enter the website address this is for (for example yourbusiness.com).']);

        $result = $orders->create($client, $offering, $data['domain'] ?? null, $data['notes'] ?? null);
        TermsAcceptance::record($request, $request->user(), $client, 'service_order', $result['order']->order_number);

        return response()->json($result, 201);
    }
}
