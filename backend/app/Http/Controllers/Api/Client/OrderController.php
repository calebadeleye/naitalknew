<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\Billing\Money;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $client = $request->user()->client;

        abort_if(! $client, 404, 'Client profile not found.');

        $orders = $client->orders()
            ->with(['items', 'invoice'])
            ->latest()
            ->get()
            ->map(fn (Order $order) => [
                'order_number' => $order->order_number,
                'status' => $order->status,
                'billing_cycle' => $order->billing_cycle,
                'total' => Money::naira($order->total_kobo),
                'created_at' => $order->created_at?->toDateString(),
                'items' => $order->items->map(fn ($item) => [
                    'description' => $item->description,
                    'total' => Money::naira($item->total_kobo),
                ]),
                'invoice' => optional($order->invoice->first(), fn ($invoice) => [
                    'invoice_number' => $invoice->invoice_number,
                    'status' => $invoice->status,
                    'total' => Money::naira($invoice->total_kobo),
                ]),
            ]);

        return response()->json(['data' => $orders]);
    }
}
