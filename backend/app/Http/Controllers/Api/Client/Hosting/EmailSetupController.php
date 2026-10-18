<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Models\HostingService;
use App\Services\Email\BusinessEmail;
use App\Services\Email\EmailSetup;
use Illuminate\Http\Request;

/**
 * The "Email setup" tab of an email-only service: the DNS records the domain
 * needs, whether each one is in place yet, and the mail-app settings.
 */
class EmailSetupController extends Controller
{
    public function show(Request $request, HostingService $service, BusinessEmail $email)
    {
        $this->authorize('manage', $service);

        $ready = $service->provisioning_status === 'provisioned';
        $records = $ready ? $email->dnsRecords($service) : [];
        $checks = $ready && $request->boolean('check', true) ? $email->checkDns($service) : [];

        return response()->json([
            'domain' => $service->primary_domain,
            'ready' => $ready,
            'domain_with_us' => $email->domainIsWithUs($service),
            'setup_ticket' => $service->provisioning_payload['email_setup_ticket'] ?? null,
            'records' => array_map(fn (array $record) => $record + ['status' => $checks[$record['key']] ?? null], $records),
            'settings' => $email->mailSettings($service),
            'checked_at' => $checks ? now()->toIso8601String() : null,
        ]);
    }

    /** Emails the setup instructions again (to forward to whoever manages the domain). */
    public function send(Request $request, HostingService $service, EmailSetup $setup)
    {
        $this->authorize('manage', $service);
        abort_unless($service->isEmailOnly(), 404);
        abort_unless($service->provisioning_status === 'provisioned', 422, 'Your email is still being set up. Try again in a few minutes.');

        $setup->sendInstructions($service);

        return response()->json(['message' => 'We\'ve emailed the setup instructions to '.$request->user()->email.'.']);
    }
}
