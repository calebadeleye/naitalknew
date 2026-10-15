<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Services\Support\SupportTicketService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SupportTicketController extends Controller
{
    public function __construct(private readonly SupportTicketService $tickets)
    {
    }

    /** The inbox: tickets waiting for staff first, then the rest by latest activity. */
    public function index(Request $request)
    {
        $status = $request->string('status')->toString();

        $tickets = SupportTicket::query()
            ->with(['client.user:id,name,email', 'hostingService:id,primary_domain'])
            ->when($status === 'active', fn ($query) => $query->where('status', '!=', 'closed'))
            ->when(in_array($status, SupportTicket::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->when($request->filled('search'), function ($query) use ($request) {
                $term = '%'.$request->string('search').'%';
                $query->where(fn ($inner) => $inner->where('ticket_number', 'like', $term)
                    ->orWhere('subject', 'like', $term)
                    ->orWhereHas('client.user', fn ($user) => $user->where('email', 'like', $term)->orWhere('name', 'like', $term))
                    ->orWhereHas('client', fn ($client) => $client->where('company_name', 'like', $term)));
            })
            ->orderByRaw("case status when 'open' then 0 when 'answered' then 1 else 2 end")
            ->orderByRaw("case priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end")
            ->latest('updated_at')
            ->paginate(25)
            ->withQueryString();

        return response()->json($tickets->through(fn (SupportTicket $ticket) => $this->summary($ticket))->toArray() + [
            'counts' => [
                'open' => SupportTicket::query()->where('status', 'open')->count(),
                'answered' => SupportTicket::query()->where('status', 'answered')->count(),
                'closed' => SupportTicket::query()->where('status', 'closed')->count(),
            ],
        ]);
    }

    /** For the admin notification bell, polled every minute — kept to one count query. */
    public function needsReply()
    {
        return response()->json(['needs_reply' => SupportTicket::query()->where('status', 'open')->count()]);
    }

    public function show(SupportTicket $ticket)
    {
        return response()->json($this->detail($ticket));
    }

    public function reply(Request $request, SupportTicket $ticket)
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:'.SupportTicketService::MAX_ATTACHMENTS],
            'attachments.*' => SupportTicketService::ATTACHMENT_RULES,
            'close' => ['nullable', 'boolean'],
        ]);

        $this->tickets->reply($ticket, $request->user(), 'staff', $data['message'], $request->file('attachments', []));

        if ($request->boolean('close')) {
            $this->tickets->close($ticket->fresh());
        }

        return response()->json($this->detail($ticket->fresh()));
    }

    public function update(Request $request, SupportTicket $ticket)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(SupportTicket::STATUSES)],
            'priority' => ['nullable', Rule::in(SupportTicket::PRIORITIES)],
        ]);

        if (($data['status'] ?? null) === 'closed') {
            $this->tickets->close($ticket);
        } elseif (isset($data['status'])) {
            $ticket->forceFill(['status' => $data['status'], 'closed_at' => null])->save();
        }

        if (isset($data['priority'])) {
            $ticket->forceFill(['priority' => $data['priority']])->save();
        }

        return response()->json($this->detail($ticket->fresh()));
    }

    public function attachment(SupportTicket $ticket, SupportTicketMessage $message, int $index)
    {
        abort_unless($message->support_ticket_id === $ticket->id, 404);

        $file = $this->tickets->attachment($message, $index);
        abort_unless($file, 404, 'That attachment is no longer available.');

        return Storage::disk('local')->download($file['path'], $file['name']);
    }

    private function summary(SupportTicket $ticket): array
    {
        return $ticket->only(['id', 'ticket_number', 'subject', 'category', 'status', 'priority', 'last_reply_by', 'last_reply_at', 'created_at', 'updated_at']) + [
            'client' => [
                'id' => $ticket->client_id,
                'name' => $ticket->client?->company_name ?: $ticket->client?->user?->name,
                'email' => $ticket->client?->user?->email,
            ],
            'website' => $ticket->hostingService?->primary_domain,
            'hosting_service_id' => $ticket->hosting_service_id,
        ];
    }

    private function detail(SupportTicket $ticket): array
    {
        $ticket->load(['client.user:id,name,email', 'hostingService:id,primary_domain', 'messages.author:id,name,role']);

        return [
            'ticket' => $this->summary($ticket) + ['closed_at' => $ticket->closed_at],
            'messages' => $ticket->messages->map(fn (SupportTicketMessage $message) => [
                'id' => $message->id,
                'author_type' => $message->author_type,
                'author_name' => $message->author?->name ?? ($message->author_type === 'staff' ? 'Staff' : 'Client'),
                'body' => $message->body,
                'files' => $message->files,
                'created_at' => $message->created_at,
            ]),
        ];
    }
}
