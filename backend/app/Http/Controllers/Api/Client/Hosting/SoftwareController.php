<?php

namespace App\Http\Controllers\Api\Client\Hosting;

use App\Http\Controllers\Controller;
use App\Jobs\SoftwareInstallJob;
use App\Models\HostingService;
use App\Models\SoftwareInstallation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Client self-service "Software" catalog — one-click installs of ready-made
 * applications (naipay first) onto the service's own hosting space. Every
 * mutating action here dispatches SoftwareInstallJob asynchronously and
 * returns 202, matching every other resource-creation endpoint on this
 * controller group (databases, mailboxes, FTP accounts) — the client polls
 * `show()` for progress rather than waiting on the request.
 */
class SoftwareController extends Controller
{
    public function index(Request $request, HostingService $service)
    {
        $this->authorize('manage', $service);

        $catalog = collect(config('software_catalog'))->map(function (array $entry, string $slug) {
            return [
                'slug' => $slug,
                'name' => $entry['name'],
                'tagline' => $entry['tagline'],
                'description' => $entry['description'],
                'prerequisites' => $entry['prerequisites'],
            ];
        })->values();

        return response()->json([
            'catalog' => $catalog,
            'installations' => $service->softwareInstallations()->orderByDesc('id')->get()->map(fn ($installation) => $this->present($installation)),
        ]);
    }

    public function store(Request $request, HostingService $service)
    {
        $this->authorize('manage', $service);

        $payload = $request->validate([
            'catalog_slug' => ['required', 'string', Rule::in(array_keys(config('software_catalog')))],
            'subdomain' => ['required', 'string', 'max:63', 'regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/'],
            'admin_email' => ['required', 'email', 'max:255'],
        ]);

        abort_if(
            SoftwareInstallation::query()
                ->where('hosting_service_id', $service->id)
                ->where('catalog_slug', $payload['catalog_slug'])
                ->whereNotIn('status', ['failed'])
                ->exists(),
            422,
            'This application is already installed (or installing) for this service.',
        );

        // Validated against the *full* computed subdomain, not the bare
        // prefix the client typed — a `unique` rule on 'subdomain' above
        // would have checked the prefix against the column's full stored
        // values (e.g. "banking" against "banking.otherclient.com") and
        // never actually caught a real collision.
        $fullSubdomain = $payload['subdomain'].'.'.$service->primary_domain;

        abort_if(
            SoftwareInstallation::query()->where('subdomain', $fullSubdomain)->exists(),
            422,
            'That subdomain is already in use. Please choose a different one.',
        );

        $installation = SoftwareInstallation::query()->create([
            'hosting_service_id' => $service->id,
            'catalog_slug' => $payload['catalog_slug'],
            'status' => 'queued',
            'progress_step' => 'queued',
            'subdomain' => $fullSubdomain,
            'admin_email' => $payload['admin_email'],
        ]);

        SoftwareInstallJob::dispatch($installation->id);

        return response()->json($this->present($installation), 202);
    }

    public function show(Request $request, HostingService $service, SoftwareInstallation $installation)
    {
        $this->authorize('manage', $service);
        abort_if($installation->hosting_service_id !== $service->id, 404);

        return response()->json($this->present($installation));
    }

    /**
     * The one-time admin password is included exactly once — the first time
     * a client fetches the record after it reaches `active` — then cleared,
     * mirroring the admin FTP-account endpoint's one-time password response.
     */
    private function present(SoftwareInstallation $installation): array
    {
        return [
            'id' => $installation->id,
            'catalog_slug' => $installation->catalog_slug,
            'status' => $installation->status,
            'progress_step' => $installation->progress_step,
            'subdomain' => $installation->subdomain,
            'console_url' => $installation->status === 'active' ? 'https://'.$installation->subdomain : null,
            'admin_email' => $installation->admin_email,
            'admin_password' => $installation->status === 'active' ? $installation->consumeOneTimePassword() : null,
            'error_message' => $installation->error_message,
            'installed_at' => $installation->installed_at?->toIso8601String(),
        ];
    }
}
