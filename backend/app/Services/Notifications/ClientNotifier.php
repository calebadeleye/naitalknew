<?php

namespace App\Services\Notifications;

use App\Models\Client;
use App\Models\HostingService;
use App\Models\NotificationLog;
use App\Models\User;
use App\Notifications\ClientNotificationFailed;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as NotificationFacade;
use Throwable;

/**
 * Single place that sends a client-facing email AND writes the matching
 * NotificationLog row, so every lifecycle notification (suspension,
 * deactivation, expiry, final warning, deletion...) is logged the same way.
 * On failure, also alerts admins so someone can decide whether to retry or
 * proceed manually — never fails silently.
 */
class ClientNotifier
{
    /**
     * @param  string  $template  short machine-readable identifier, e.g. "client_suspended"
     */
    public function notify(
        Client $client,
        Notification $notification,
        string $template,
        string $subject,
        ?HostingService $service = null,
        ?string $domain = null,
        array $payload = []
    ): NotificationLog {
        $recipient = $client->user?->email ?: $client->billing_email;
        $status = 'sent';
        $failureReason = null;

        try {
            if (! $recipient) {
                throw new \RuntimeException('Client has no email address to notify.');
            }

            if ($client->user) {
                $client->user->notify($notification);
            } else {
                NotificationFacade::route('mail', $recipient)->notify($notification);
            }
        } catch (Throwable $exception) {
            $status = 'failed';
            $failureReason = $exception->getMessage();
        }

        $log = NotificationLog::query()->create([
            'client_id' => $client->id,
            'hosting_service_id' => $service?->id,
            'domain' => $domain ?? $service?->primary_domain,
            'channel' => 'mail',
            'template' => $template,
            'subject' => $subject,
            'recipient' => $recipient ?? 'unknown',
            'status' => $status,
            'failure_reason' => $failureReason,
            'payload' => $payload,
            'sent_at' => now(),
        ]);

        if ($status === 'failed') {
            $this->alertAdminsOfFailure($client, $template, $subject, $failureReason);
        }

        return $log;
    }

    private function alertAdminsOfFailure(Client $client, string $template, string $subject, ?string $failureReason): void
    {
        $admins = User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get();

        if ($admins->isEmpty()) {
            return;
        }

        NotificationFacade::send($admins, new ClientNotificationFailed($client, $template, $subject, $failureReason));

        foreach ($admins as $admin) {
            NotificationLog::query()->create([
                'client_id' => $client->id,
                'channel' => 'mail',
                'template' => 'client_notification_failed',
                'subject' => "Client email failed to send: {$subject}",
                'recipient' => $admin->email,
                'status' => 'sent',
                'payload' => ['original_template' => $template, 'client_id' => $client->id, 'failure_reason' => $failureReason],
                'sent_at' => now(),
            ]);
        }
    }
}
