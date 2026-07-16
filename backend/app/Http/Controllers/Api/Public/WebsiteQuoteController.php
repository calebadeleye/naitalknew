<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\StoreWebsiteQuoteRequest;
use App\Models\User;
use App\Models\WebsiteQuoteRequest;
use App\Notifications\NaiTalkWebsiteQuoteSubmitted;
use App\Notifications\WebsiteQuoteReceived;
use App\Services\Leads\WebsiteQuoteReferenceGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

class WebsiteQuoteController extends Controller
{
    public function store(StoreWebsiteQuoteRequest $request, WebsiteQuoteReferenceGenerator $referenceGenerator): JsonResponse
    {
        $quote = WebsiteQuoteRequest::query()->create([
            'reference' => $referenceGenerator->generate(),
            'name' => $request->string('name')->toString(),
            'phone' => $request->string('phone')->toString(),
            'email' => $request->string('email')->toString(),
            'website_type' => $request->string('website_type')->toString(),
            'estimated_budget' => $request->string('estimated_budget')->toString(),
            'project_description' => $request->string('project_description')->toString(),
            'status' => 'new',
            'source' => 'google_ads',
            'landing_page' => $request->input('landing_page'),
            'utm_source' => $request->input('utm_source'),
            'utm_medium' => $request->input('utm_medium'),
            'utm_campaign' => $request->input('utm_campaign'),
            'utm_term' => $request->input('utm_term'),
            'utm_content' => $request->input('utm_content'),
            'gclid' => $request->input('gclid'),
            'referrer' => $request->input('referrer'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        $this->sendNotifications($quote);

        return response()->json([
            'status' => 'success',
            'message' => 'Your website request has been received.',
            'data' => [
                'reference' => $quote->reference,
            ],
        ], 201);
    }

    private function sendNotifications(WebsiteQuoteRequest $quote): void
    {
        try {
            NotificationFacade::route('mail', $quote->email)->notify(new WebsiteQuoteReceived($quote));
        } catch (Throwable $exception) {
            Log::error('Failed to send website quote acknowledgement email', [
                'reference' => $quote->reference,
                'error' => $exception->getMessage(),
            ]);
        }

        try {
            $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

            if ($admins->isNotEmpty()) {
                NotificationFacade::send($admins, new NaiTalkWebsiteQuoteSubmitted($quote));
            }

            $companyEmail = config('company.email');

            if ($companyEmail && ! $admins->contains('email', $companyEmail)) {
                NotificationFacade::route('mail', $companyEmail)->notify(new NaiTalkWebsiteQuoteSubmitted($quote));
            }
        } catch (Throwable $exception) {
            Log::error('Failed to send website quote staff notification', [
                'reference' => $quote->reference,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
