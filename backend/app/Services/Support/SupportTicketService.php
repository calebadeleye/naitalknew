<?php

namespace App\Services\Support;

use App\Models\Client;
use App\Models\NotificationLog;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\User;
use App\Notifications\SupportTicketActivity;
use App\Notifications\SupportTicketReplied;
use App\Services\Notifications\ClientNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * The rules of a support conversation, shared by the client and admin APIs:
 *  - a client opens a ticket or replies  -> status "open", staff are emailed;
 *  - staff reply                         -> status "answered", client is emailed;
 *  - either side can close it; a reply on a closed ticket reopens it.
 */
class SupportTicketService
{
    public const MAX_ATTACHMENTS = 3;

    public const ATTACHMENT_RULES = ['file', 'max:5120', 'mimes:jpg,jpeg,png,webp,gif,pdf,txt,log,zip'];

    public function __construct(private readonly ClientNotifier $notifier)
    {
    }

    /**
     * @param  array{subject: string, category: string, priority?: string, hosting_service_id?: int|null, message: string}  $data
     * @param  array<int, UploadedFile>  $files
     */
    public function open(Client $client, User $user, array $data, array $files = []): SupportTicket
    {
        $ticket = DB::transaction(function () use ($client, $user, $data, $files) {
            $ticket = SupportTicket::query()->create([
                'client_id' => $client->id,
                'user_id' => $user->id,
                'hosting_service_id' => $data['hosting_service_id'] ?? null,
                'ticket_number' => $this->newTicketNumber(),
                'subject' => $data['subject'],
                'category' => $data['category'],
                'priority' => $data['priority'] ?? 'normal',
                'status' => 'open',
            ]);

            $this->addMessage($ticket, $user, 'client', $data['message'], $files);

            return $ticket;
        });

        $this->tellStaff($ticket, 'opened');

        return $ticket->fresh();
    }

    /** @param  array<int, UploadedFile>  $files */
    public function reply(SupportTicket $ticket, User $author, string $authorType, string $body, array $files = []): SupportTicketMessage
    {
        $message = DB::transaction(fn () => $this->addMessage($ticket, $author, $authorType, $body, $files));

        if ($authorType === 'staff') {
            if ($ticket->client) {
                $this->notifier->notify(
                    client: $ticket->client,
                    notification: new SupportTicketReplied($ticket->fresh(), $message),
                    template: 'support_ticket_reply',
                    subject: "Re: [{$ticket->ticket_number}] {$ticket->subject}",
                    service: $ticket->hostingService,
                    payload: ['ticket_number' => $ticket->ticket_number],
                );
            }
        } else {
            $this->tellStaff($ticket, 'replied');
        }

        return $message;
    }

    public function close(SupportTicket $ticket): SupportTicket
    {
        $ticket->forceFill(['status' => 'closed', 'closed_at' => now()])->save();

        return $ticket;
    }

    /** @param  array<int, UploadedFile>  $files */
    private function addMessage(SupportTicket $ticket, User $author, string $authorType, string $body, array $files): SupportTicketMessage
    {
        $message = $ticket->messages()->create([
            'user_id' => $author->id,
            'author_type' => $authorType,
            'body' => $body,
            'attachments' => $this->store($ticket, $files) ?: null,
        ]);

        $ticket->forceFill([
            'latest_message' => Str::limit($body, 500),
            'last_reply_by' => $authorType,
            'last_reply_at' => now(),
            // A client writing (again) needs staff attention; a staff reply hands it back.
            'status' => $authorType === 'staff' ? 'answered' : 'open',
            'closed_at' => null,
        ])->save();

        return $message;
    }

    /**
     * @param  array<int, UploadedFile>  $files
     * @return array<int, array{name: string, path: string, size: int, mime: string|null}>
     */
    private function store(SupportTicket $ticket, array $files): array
    {
        return collect($files)
            ->take(self::MAX_ATTACHMENTS)
            ->map(fn (UploadedFile $file) => [
                'name' => Str::limit($file->getClientOriginalName(), 120, ''),
                'path' => $file->storeAs("support-tickets/{$ticket->id}", Str::uuid().'.'.$file->extension(), 'local'),
                'size' => (int) $file->getSize(),
                'mime' => $file->getMimeType(),
            ])
            ->values()
            ->all();
    }

    /** @return array{path: string, name: string}|null */
    public function attachment(SupportTicketMessage $message, int $index): ?array
    {
        $file = ($message->attachments ?? [])[$index] ?? null;

        return $file && Storage::disk('local')->exists($file['path']) ? ['path' => $file['path'], 'name' => $file['name']] : null;
    }

    /**
     * Emails every admin now (not via the queue) and records each attempt in
     * notification_logs, so a missing "new ticket" email can be traced.
     */
    private function tellStaff(SupportTicket $ticket, string $event): void
    {
        $ticket = $ticket->fresh(['client.user', 'hostingService']);
        $notification = new SupportTicketActivity($ticket, $event);

        foreach (User::query()->whereIn('role', ['super_admin', 'admin_staff'])->get() as $admin) {
            $failure = null;

            try {
                Notification::sendNow($admin, $notification);
            } catch (Throwable $exception) {
                $failure = $exception->getMessage();
                report($exception);
            }

            NotificationLog::query()->create([
                'client_id' => $ticket->client_id,
                'hosting_service_id' => $ticket->hosting_service_id,
                'channel' => 'mail',
                'template' => 'support_ticket_staff_'.$event,
                'subject' => "[{$ticket->ticket_number}] {$ticket->subject}",
                'recipient' => $admin->email,
                'status' => $failure ? 'failed' : 'sent',
                'failure_reason' => $failure,
                'payload' => ['ticket_number' => $ticket->ticket_number],
                'sent_at' => now(),
            ]);
        }
    }

    private function newTicketNumber(): string
    {
        do {
            $number = 'TKT-'.now()->format('ymd').'-'.Str::upper(Str::random(5));
        } while (SupportTicket::query()->where('ticket_number', $number)->exists());

        return $number;
    }
}
