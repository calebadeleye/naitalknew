<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\HostingService;
use App\Models\ProvisioningLog;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\WebsiteSettingsService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Client self-service for the site-level settings ISPConfig controls:
 * PHP, SSL and an optional reverse proxy for a client-run app (e.g. Node).
 * Clients never see ISPConfig or the term "Let's Encrypt" — "Free SSL" is
 * the only name used for it here and in every response.
 */
class WebsiteSettingsController extends Controller
{
    public function show(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        return response()->json($this->attempt($service, fn () => $settings->read($service), 'read_website_settings'));
    }

    public function updatePhp(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['enabled' => ['required', 'boolean']]);

        $result = $this->attempt($service, fn () => $settings->setPhpEnabled($service, $payload['enabled']), 'update_website_php', $request);

        return response()->json($result);
    }

    public function enableFreeSsl(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        $result = $this->attempt($service, fn () => $settings->enableFreeSsl($service), 'enable_free_ssl', $request);

        return response()->json($result);
    }

    public function installCustomSsl(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate([
            'certificate' => ['required_without:certificate_file', 'nullable', 'string'],
            'certificate_file' => ['required_without:certificate', 'nullable', 'file', 'max:100'],
            'private_key' => ['required_without:private_key_file', 'nullable', 'string'],
            'private_key_file' => ['required_without:private_key', 'nullable', 'file', 'max:100'],
            'ca_bundle' => ['nullable', 'string'],
            'ca_bundle_file' => ['nullable', 'file', 'max:100'],
        ]);

        $certificate = $request->file('certificate_file')?->get() ?? $payload['certificate'] ?? '';
        $privateKey = $request->file('private_key_file')?->get() ?? $payload['private_key'] ?? '';
        $bundle = $request->file('ca_bundle_file')?->get() ?? $payload['ca_bundle'] ?? null;

        $result = $this->attempt(
            $service,
            fn () => $settings->installCustomSsl($service, $certificate, $privateKey, $bundle),
            'install_custom_ssl',
            $request,
        );

        return response()->json($result);
    }

    public function disableSsl(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        $result = $this->attempt($service, fn () => $settings->disableSsl($service), 'disable_ssl', $request);

        return response()->json($result);
    }

    public function updateProxy(Request $request, HostingService $service, WebsiteSettingsService $settings)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate(['port' => ['nullable', 'integer', 'min:1024', 'max:65535']]);
        $port = $payload['port'] ?? null;

        $result = $this->attempt($service, fn () => $settings->setProxy($service, $port), 'update_website_proxy', $request);

        return response()->json($result);
    }

    /**
     * Runs a settings mutation/read, translating ISPConfig failures into a
     * plain 422 and logging every write (never the read) to the audit trail
     * and provisioning log, the same way every other client-facing hosting
     * action on this service already is.
     */
    private function attempt(HostingService $service, \Closure $action, string $logAction, ?Request $request = null): array
    {
        try {
            $result = $action();
        } catch (IspConfigApiException $exception) {
            ProvisioningLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'provider' => 'ispconfig',
                'action' => $logAction,
                'status' => 'failed',
                'message' => $exception->safeMessage(),
                'finished_at' => now(),
            ]);

            abort(422, "We couldn't update that just now. Please try again in a few minutes, or contact support if it keeps happening.");
        } catch (ValidationException $exception) {
            throw $exception;
        }

        if ($request) {
            ProvisioningLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'provider' => 'ispconfig',
                'action' => $logAction,
                'status' => 'completed',
                'message' => 'Applied from the client dashboard.',
                'finished_at' => now(),
            ]);

            AuditLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'action' => $logAction,
                'source' => 'client',
                'notify_client' => false,
                'after_state' => $result,
            ]);
        }

        return $result;
    }
}
