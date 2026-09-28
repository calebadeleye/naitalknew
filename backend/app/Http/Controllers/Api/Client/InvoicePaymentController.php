<?php

namespace App\Http\Controllers\Api\Client;

use App\Exceptions\PaymentGatewayException;
use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\NotificationLog;
use App\Models\Payment;
use App\Models\User;
use App\Notifications\NaiTalkPaymentProofUploaded;
use App\Services\Billing\Money;
use App\Services\Payments\FlutterwaveGateway;
use App\Services\Payments\PaystackGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Illuminate\Support\Str;

class InvoicePaymentController extends Controller
{
    public function paystack(Request $request, Invoice $invoice, PaystackGateway $gateway)
    {
        $this->authorizeInvoice($request, $invoice);

        $reference = $this->generateReference();
        $callbackUrl = rtrim(config('app.url'), '/').'/api/v1/payments/paystack/callback';

        try {
            $result = $gateway->initialize($request->user()->email, $invoice->payableKobo(), $reference, $callbackUrl);
        } catch (PaymentGatewayException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        Payment::query()->create([
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'gateway' => 'paystack',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $invoice->payableKobo(),
            'currency' => 'NGN',
        ]);

        return response()->json([
            'authorization_url' => $result['authorization_url'],
            'reference' => $reference,
        ]);
    }

    public function flutterwave(Request $request, Invoice $invoice, FlutterwaveGateway $gateway)
    {
        $this->authorizeInvoice($request, $invoice);

        $reference = $this->generateReference();
        $redirectUrl = rtrim(config('app.url'), '/').'/api/v1/payments/flutterwave/callback';

        try {
            $result = $gateway->initialize($request->user()->email, $request->user()->name, $invoice->payableKobo(), $reference, $redirectUrl);
        } catch (PaymentGatewayException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        Payment::query()->create([
            'client_id' => $invoice->client_id,
            'invoice_id' => $invoice->id,
            'gateway' => 'flutterwave',
            'reference' => $reference,
            'status' => 'pending',
            'amount_kobo' => $invoice->payableKobo(),
            'currency' => 'NGN',
        ]);

        return response()->json([
            'link' => $result['link'],
            'reference' => $reference,
        ]);
    }

    public function bankTransfer(Request $request, Invoice $invoice)
    {
        $this->authorizeInvoice($request, $invoice);

        $invoice->openBankTransferPayment('awaiting_bank_transfer', $invoice->payableKobo());

        return response()->json([
            'bank_name' => config('services.bank_transfer.bank_name'),
            'account_name' => config('services.bank_transfer.account_name'),
            'account_number' => config('services.bank_transfer.account_number'),
            'amount' => Money::naira($invoice->payableKobo()),
            'reference' => $invoice->invoice_number,
            'message' => 'Please use your invoice number as the transfer narration. Your service will be activated once we confirm receipt.',
        ]);
    }

    public function uploadBankTransferProof(Request $request, Invoice $invoice)
    {
        $this->authorizeInvoice($request, $invoice);

        $outstandingKobo = $invoice->payableKobo();

        $payload = $request->validate([
            'receipt' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            // Optional: lets a client declare they only sent a partial amount.
            // Defaults to the full outstanding balance below when omitted, same
            // as before this field existed.
            'amount_kobo' => ['nullable', 'integer', 'min:1', 'max:'.$outstandingKobo],
        ]);

        // Uploading proof is itself the client saying "I paid by bank transfer",
        // so open the payment here if none is waiting — e.g. when they come back
        // to send the balance after an earlier instalment was already approved.
        $payment = $invoice->payments()->where('gateway', 'bank_transfer')->whereNull('reconciled_at')->latest('id')->first()
            ?? $invoice->openBankTransferPayment('awaiting_bank_transfer', $outstandingKobo);

        $path = $payload['receipt']->store('receipts', 'local');

        $payment->forceFill([
            'status' => 'pending_review',
            'receipt_path' => $path,
            'amount_kobo' => $payload['amount_kobo'] ?? $outstandingKobo,
        ])->save();

        $this->notifyAdminsOfPaymentProof($payment);

        return response()->json(['message' => 'Proof of payment submitted. We will confirm receipt shortly.']);
    }

    private function authorizeInvoice(Request $request, Invoice $invoice): void
    {
        $client = $request->user()->client;

        abort_if(! $client || $invoice->client_id !== $client->id, 403, 'This invoice does not belong to your account.');
        abort_if($invoice->status === 'paid', 422, 'This invoice has already been paid.');
    }

    private function generateReference(): string
    {
        return 'PAY-'.Str::upper(Str::random(12));
    }

    private function notifyAdminsOfPaymentProof(Payment $payment): void
    {
        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        NotificationFacade::send($admins, new NaiTalkPaymentProofUploaded($payment));

        foreach ($admins as $admin) {
            NotificationLog::query()->create([
                'client_id' => $payment->client_id,
                'channel' => 'mail',
                'template' => 'payment_proof_uploaded',
                'recipient' => $admin->email,
                'status' => 'sent',
                'payload' => ['payment_id' => $payment->id, 'invoice_id' => $payment->invoice_id],
                'sent_at' => now(),
            ]);
        }
    }
}
