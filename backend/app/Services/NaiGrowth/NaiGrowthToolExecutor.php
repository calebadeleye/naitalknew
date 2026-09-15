<?php

namespace App\Services\NaiGrowth;

use App\Models\Client;
use App\Models\NaiGrowthEmailDraft;
use App\Models\WebsiteQuoteRequest;
use InvalidArgumentException;

/**
 * The only place NaiGrowth actually mutates Naitalk's data.
 *
 * updateLeadStatus and addClientNote are internal record-keeping — not
 * external sends, spend, or contractual commitments — so they run
 * automatically. draftEmail is different: it only ever writes a
 * pending_review row. Nothing is sent until an admin explicitly approves it
 * from the Approval Queue (NaiGrowthEmailDraftController::approve) — sending
 * external email is a Category C action per the system prompt's own rules.
 */
class NaiGrowthToolExecutor
{
    // Mirrors WebsiteQuoteController::STATUSES so NaiGrowth can't set a lead
    // to a status the rest of the admin UI doesn't understand.
    private const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'converted', 'closed', 'spam'];

    /**
     * @return array{summary: string, lead: array}
     */
    public function updateLeadStatus(int $leadId, string $status): array
    {
        if (! in_array($status, self::LEAD_STATUSES, true)) {
            throw new InvalidArgumentException(
                "\"{$status}\" is not a valid lead status. Use one of: ".implode(', ', self::LEAD_STATUSES).'.'
            );
        }

        $lead = WebsiteQuoteRequest::query()->find($leadId);

        if (! $lead) {
            throw new InvalidArgumentException("No lead found with id {$leadId}.");
        }

        $lead->status = $status;

        if ($status === 'contacted' && ! $lead->contacted_at) {
            $lead->contacted_at = now();
        }

        if ($status === 'converted' && ! $lead->converted_at) {
            $lead->converted_at = now();
        }

        $lead->save();

        return [
            'summary' => "Marked lead #{$lead->id} ({$lead->name}) as {$status}.",
            'lead' => ['id' => $lead->id, 'name' => $lead->name, 'status' => $lead->status],
        ];
    }

    /**
     * @return array{summary: string, client: array}
     */
    public function addClientNote(int $clientId, string $note): array
    {
        $note = trim($note);

        if ($note === '') {
            throw new InvalidArgumentException('Note text cannot be empty.');
        }

        $client = Client::query()->find($clientId);

        if (! $client) {
            throw new InvalidArgumentException("No client found with id {$clientId}.");
        }

        $stamped = '['.now()->toDateTimeString().' — NaiGrowth] '.$note;
        $client->internal_notes = trim(($client->internal_notes ? $client->internal_notes."\n" : '').$stamped);
        $client->save();

        $clientName = $client->user?->name ?? $client->company_name ?? "Client #{$client->id}";

        return [
            'summary' => "Added a note to {$clientName}'s internal record.",
            'client' => ['id' => $client->id, 'name' => $clientName],
        ];
    }

    /**
     * @return array{summary: string, draft_id: int}
     */
    public function draftEmail(
        int $creatorUserId,
        string $recipientEmail,
        ?string $recipientName,
        string $subject,
        string $body,
    ): array {
        $recipientEmail = trim($recipientEmail);

        if (! filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("\"{$recipientEmail}\" is not a valid email address.");
        }

        if (trim($subject) === '' || trim($body) === '') {
            throw new InvalidArgumentException('Both subject and body are required to draft an email.');
        }

        $draft = NaiGrowthEmailDraft::query()->create([
            'created_by_user_id' => $creatorUserId,
            'recipient_email' => $recipientEmail,
            'recipient_name' => $recipientName,
            'subject' => $subject,
            'body' => $body,
            'status' => 'pending_review',
        ]);

        $displayName = $recipientName ? "{$recipientName} <{$recipientEmail}>" : $recipientEmail;

        return [
            'summary' => "Drafted an email to {$displayName} — waiting for your approval in the Approval Queue.",
            'draft_id' => $draft->id,
        ];
    }
}
