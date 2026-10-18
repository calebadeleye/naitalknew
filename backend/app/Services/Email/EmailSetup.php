<?php

namespace App\Services\Email;

use App\Models\HostingService;
use App\Notifications\EmailOnlySetupInstructions;
use App\Services\Support\SupportTicketService;
use Throwable;

/**
 * Tells an email-only client how to point their domain's mail at us, and —
 * when the domain is registered with us — asks our team to add the records.
 */
class EmailSetup
{
    public function __construct(private readonly BusinessEmail $email)
    {
    }

    /** @return ?string the setup ticket number, when one was opened (or already existed) */
    public function sendInstructions(HostingService $service, bool $openTeamTicket = false): ?string
    {
        $records = $this->email->dnsRecords($service);
        $withUs = $this->email->domainIsWithUs($service);
        $ticket = $openTeamTicket && $withUs ? $this->openTeamTicket($service, $records) : ($service->provisioning_payload['email_setup_ticket'] ?? null);

        $service->client?->user?->notify(new EmailOnlySetupInstructions(
            $service,
            $records,
            $this->email->mailSettings($service),
            domainWithUs: $withUs,
            ticketNumber: $ticket,
        ));

        return $ticket;
    }

    /** One ticket per service: our team adds the records at the registrar. */
    private function openTeamTicket(HostingService $service, array $records): ?string
    {
        $payload = $service->provisioning_payload ?? [];

        if (! empty($payload['email_setup_ticket'])) {
            return $payload['email_setup_ticket'];
        }

        $client = $service->client;
        $user = $client?->user;

        if (! $user) {
            return null;
        }

        $lines = collect($records)->map(fn (array $r) => "- {$r['type']}  {$r['host']}  ".($r['priority'] ? "{$r['priority']}  " : '')."{$r['value']}".($r['required'] ? '' : '  (recommended)'))->implode("\n");

        try {
            $ticket = app(SupportTicketService::class)->open($client, $user, [
                'hosting_service_id' => $service->id,
                'subject' => "Business email DNS setup — {$service->primary_domain}",
                'category' => 'technical',
                'priority' => 'high',
                'message' => "Business email ({$service->hostingPlan?->name}) for {$service->primary_domain} is active. The domain is registered with NAI TALK, so our team will add these DNS records for you:\n\n{$lines}\n\nThis ticket was opened automatically. We'll reply here once the records are in place.",
            ]);
        } catch (Throwable $exception) {
            // The email still goes out; the team can see the paid service.
            report($exception);

            return null;
        }

        $service->forceFill(['provisioning_payload' => array_merge($payload, ['email_setup_ticket' => $ticket->ticket_number])])->save();

        return $ticket->ticket_number;
    }
}
