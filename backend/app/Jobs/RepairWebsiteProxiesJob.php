<?php

namespace App\Jobs;

use App\Models\HostingService;
use App\Models\NotificationLog;
use App\Models\ProvisioningLog;
use App\Notifications\WebsiteConnectionAlert;
use App\Services\Ispconfig\Exceptions\IspConfigApiException;
use App\Services\Ispconfig\WebsiteSettingsService;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Keeps client-run apps reachable. For every active site whose client has set
 * up a reverse proxy, checks the proxy rule is still in ISPConfig and the app
 * is answering:
 *  - rule gone  -> put it back at once and tell the client (it showed visitors
 *    the site's raw files until then);
 *  - app down   -> nothing we can fix, but tell the client — at most once a day
 *    while it stays down.
 */
class RepairWebsiteProxiesJob implements ShouldQueue
{
    use Queueable;

    public function handle(WebsiteSettingsService $settings, ClientNotifier $notifier): void
    {
        HostingService::query()
            ->where('status', 'active')
            ->whereNotNull('website_proxy_desired_port')
            ->chunkById(50, function ($services) use ($settings, $notifier): void {
                foreach ($services as $service) {
                    $this->checkOne($service, $settings, $notifier);
                }
            });
    }

    private function checkOne(HostingService $service, WebsiteSettingsService $settings, ClientNotifier $notifier): void
    {
        try {
            $result = $settings->proxyStatus($service, repair: true);
        } catch (IspConfigApiException $exception) {
            ProvisioningLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'provider' => 'ispconfig',
                'action' => 'proxy_health_check',
                'status' => 'failed',
                'message' => $exception->safeMessage(),
                'finished_at' => now(),
            ]);

            return;
        }

        if ($result['repaired']) {
            ProvisioningLog::query()->create([
                'client_id' => $service->client_id,
                'hosting_service_id' => $service->id,
                'provider' => 'ispconfig',
                'action' => 'proxy_auto_repaired',
                'status' => 'completed',
                'message' => "The reverse proxy rule for port {$result['port']} was missing from ISPConfig and has been re-applied.",
                'finished_at' => now(),
            ]);

            $this->alert($service, 'repaired', (int) $result['port'], $notifier);
        }

        if ($result['status'] === 'app_down') {
            $this->alert($service, 'app_down', (int) $result['port'], $notifier);
        }
    }

    private function alert(HostingService $service, string $kind, int $port, ClientNotifier $notifier): void
    {
        $template = "website_connection_{$kind}";

        // One email per kind per day — a flapping app must not flood the client.
        $alreadySentToday = NotificationLog::query()
            ->where('hosting_service_id', $service->id)
            ->where('template', $template)
            ->where('status', 'sent')
            ->where('sent_at', '>=', now()->subDay())
            ->exists();

        if ($alreadySentToday || ! $service->client) {
            return;
        }

        $notifier->notify(
            client: $service->client,
            notification: new WebsiteConnectionAlert($service, $kind, $port),
            template: $template,
            subject: WebsiteConnectionAlert::subjectFor($service, $kind),
            service: $service,
        );
    }
}
