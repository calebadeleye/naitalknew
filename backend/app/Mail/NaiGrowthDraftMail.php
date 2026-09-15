<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * An ad-hoc email approved by an admin from the NaiGrowth Approval Queue.
 * Deliberately not ShouldQueue -- it's sent synchronously on the admin's
 * explicit Approve click so success/failure is known immediately, rather
 * than depending on a queue worker running.
 */
class NaiGrowthDraftMail extends Mailable
{
    use SerializesModels;

    public function __construct(
        public readonly string $subjectLine,
        public readonly string $bodyText,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->subjectLine);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.naigrowth-draft', with: ['bodyText' => $this->bodyText]);
    }
}
