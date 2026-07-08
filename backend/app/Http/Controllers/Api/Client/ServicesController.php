<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\ServiceOffering;
use App\Services\Billing\Money;
use Illuminate\Http\Request;

class ServicesController extends Controller
{
    /**
     * Unified "Active Services" list — hosting services and any other
     * purchased NAI TALK service offering. Non-hosting entries never get a
     * manage_url; only hosting services can open the mini control panel.
     */
    public function index(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $hostingServices = $client->hostingServices()->with('hostingPlan')->get()->map(fn ($service) => [
            'type' => 'hosting',
            'id' => $service->id,
            'name' => $service->display_name ?: $service->hostingPlan?->name,
            'status' => $service->status,
            'billing_cycle' => $service->billing_cycle,
            'renews_at' => $service->renews_at?->toDateString(),
            'manage_url' => "/client/services/{$service->id}/manage",
        ]);

        $serviceOfferingItems = OrderItem::query()
            ->where('orderable_type', ServiceOffering::class)
            ->whereHas('order', fn ($query) => $query->where('client_id', $client->id)->where('status', 'completed'))
            ->with(['orderable', 'order'])
            ->get()
            ->map(fn (OrderItem $item) => [
                'type' => 'service_offering',
                'id' => $item->id,
                'name' => $item->orderable?->name ?? $item->description,
                'status' => 'active',
                'billing_cycle' => $item->orderable?->billing_type,
                'renews_at' => null,
                'total' => Money::naira($item->total_kobo),
                'manage_url' => null,
            ]);

        return response()->json([
            'services' => $hostingServices->concat($serviceOfferingItems)->values(),
        ]);
    }
}
