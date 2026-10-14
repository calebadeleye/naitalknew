<?php

namespace App\Http\Controllers\Api\Client;

use App\Http\Controllers\Controller;
use App\Models\Client;
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

    public function index(Request $request)
    {
        $client = $this->client($request);

        return response()->json([
            'tickets' => SupportTicket::query()
                ->where('client_id', $client->id)
                ->with('hostingService:id,primary_domain')
                ->orderByRaw("case when status = 'closed' then 1 else 0 end")
                ->latest('updated_at')
                ->get(['id', 'ticket_number', 'subject', 'category', 'status', 'priority', 'hosting_service_id', 'last_reply_by', 'last_reply_at', 'created_at', 'updated_at']),
            'services' => $client->hostingServices()->get(['id', 'primary_domain', 'service_number']),
        ]);
    }

    public function store(Request $request)
    {
        $client = $this->client($request);

        $data = $request->validate([
            'subject' => ['required', 'string', 'max:160'],
            'category' => ['required', Rule::in(SupportTicket::CATEGORIES)],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high'])],
            'hosting_service_id' => ['nullable', 'integer', Rule::exists('hosting_services', 'id')->where('client_id', $client->id)],
            'message' => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:'.SupportTicketService::MAX_ATTACHMENTS],
            'attachments.*' => SupportTicketService::ATTACHMENT_RULES,
        ]);

        $ticket = $this->tickets->open($client, $request->user(), $data, $request->file('attachments', []));

        return response()->json($this->detail($ticket), 201);
    }

    public function show(Request $request, SupportTicket $ticket)
    {
        $this->authorizeTicket($request, $ticket);

        return response()->json($this->detail($ticket));
    }

    public function reply(Request $request, SupportTicket $ticket)
    {
        $this->authorizeTicket($request, $ticket);

        $data = $request->validate([
            'message' => ['required', 'string', 'max:10000'],
            'attachments' => ['nullable', 'array', 'max:'.SupportTicketService::MAX_ATTACHMENTS],
            'attachments.*' => SupportTicketService::ATTACHMENT_RULES,
        ]);

        $this->tickets->reply($ticket, $request->user(), 'client', $data['message'], $request->file('attachments', []));

        return response()->json($this->detail($ticket->fresh()));
    }

    public function close(Request $request, SupportTicket $ticket)
    {
        $this->authorizeTicket($request, $ticket);

        return response()->json($this->detail($this->tickets->close($ticket)));
    }

    public function attachment(Request $request, SupportTicket $ticket, SupportTicketMessage $message, int $index)
    {
        $this->authorizeTicket($request, $ticket);
        abort_unless($message->support_ticket_id === $ticket->id, 404);

        $file = $this->tickets->attachment($message, $index);
        abort_unless($file, 404, 'That attachment is no longer available.');

        return Storage::disk('local')->download($file['path'], $file['name']);
    }

    private function client(Request $request): Client
    {
        $client = $request->user()->client;
        abort_if(! $client, 404, 'Client profile not found.');

        return $client;
    }

    private function authorizeTicket(Request $request, SupportTicket $ticket): void
    {
        // 404, not 403: don't confirm another client's ticket number exists.
        abort_unless($ticket->client_id === $this->client($request)->id, 404);
    }

    private function detail(SupportTicket $ticket): array
    {
        $ticket->load(['hostingService:id,primary_domain', 'messages.author:id,name,role']);

        return [
            'ticket' => $ticket->only(['id', 'ticket_number', 'subject', 'category', 'status', 'priority', 'hosting_service_id', 'last_reply_by', 'last_reply_at', 'closed_at', 'created_at']) + [
                'website' => $ticket->hostingService?->primary_domain,
            ],
            'messages' => $ticket->messages->map(fn (SupportTicketMessage $message) => [
                'id' => $message->id,
                'author_type' => $message->author_type,
                // Clients see "NAI TALK Support" plus the staff member's first name only.
                'author_name' => $message->author_type === 'staff'
                    ? 'NAI TALK Support'.($message->author?->name ? ' · '.strtok($message->author->name, ' ') : '')
                    : ($message->author?->name ?? 'You'),
                'body' => $message->body,
                'files' => $message->files,
                'created_at' => $message->created_at,
            ]),
        ];
    }
}
