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

        // This service's own failed attempt at this app has already been
        // rolled back (and is still recorded in ProvisioningLog), so it must
        // neither block its own retry on the same subdomain nor trip the
        // (hosting_service_id, catalog_slug) unique index on the new row.
        $ownFailedAttempts = SoftwareInstallation::query()
            ->where('hosting_service_id', $service->id)
            ->where('catalog_slug', $payload['catalog_slug'])
            ->where('status', 'failed');

        abort_if(
            SoftwareInstallation::withTrashed()
                ->where('subdomain', $fullSubdomain)
                ->whereNotIn('id', (clone $ownFailedAttempts)->select('id'))
                ->exists(),
            422,
            'That subdomain is already in use. Please choose a different one.',
        );

        // Hard delete: the model soft-deletes, which would leave the row in the
        // unique indexes and still block the new one.
        $ownFailedAttempts->forceDelete();

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
            'progress_percent' => $this->progressPercent($installation),
            'progress_step_number' => $this->progressStepNumber($installation),
            'progress_step_total' => count(config('software_install.progress_steps')) - 1,
            'started_at' => $installation->created_at?->toIso8601String(),
            'subdomain' => $installation->subdomain,
            'console_url' => $installation->status === 'active' ? 'https://'.$installation->subdomain : null,
            'admin_email' => $installation->admin_email,
            'admin_password' => $installation->status === 'active' ? $installation->consumeOneTimePassword() : null,
            'error_message' => $installation->error_message,
            'installed_at' => $installation->installed_at?->toIso8601String(),
        ];
    }

    /**
     * Estimated 0–100 completion, from the weighted step list in
     * config/software_install.php. Inside the current step it creeps forward
     * with the time spent there (progress() bumps updated_at each time a
     * step starts), holding at 95% of the step's slice if it overruns, so a
     * long npm build keeps visibly moving without ever claiming to be done.
     * Never 100 until the record is actually active.
     */
    private function progressPercent(SoftwareInstallation $installation): ?int
    {
        if ($installation->status === 'active') {
            return 100;
        }

        if ($installation->status === 'failed') {
            return null;
        }

        $steps = config('software_install.progress_steps');
        $total = array_sum($steps);
        $current = $installation->progress_step;

        if (! $total || ! $current || ! array_key_exists($current, $steps)) {
            return 0;
        }

        $done = 0;

        foreach ($steps as $step => $seconds) {
            if ($step === $current) {
                $inStep = max(0, $installation->updated_at?->diffInSeconds(now(), true) ?? 0);
                $fraction = $seconds > 0 ? min($inStep / $seconds, 0.95) : 0;
                $done += $seconds * $fraction;

                break;
            }

            $done += $seconds;
        }

        return min(99, (int) floor($done / $total * 100));
    }

    /** 1-based position of the current step among the real steps (queued is 0). */
    private function progressStepNumber(SoftwareInstallation $installation): int
    {
        $position = array_search($installation->progress_step, array_keys(config('software_install.progress_steps')), true);

        return $position === false ? 0 : (int) $position;
    }
}
