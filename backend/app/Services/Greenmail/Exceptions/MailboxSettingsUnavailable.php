<?php

namespace App\Services\Greenmail\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** The mailbox's server-side settings (vacation reply, rules) can't be read or saved. */
class MailboxSettingsUnavailable extends RuntimeException
{
    public function __construct(string $message = 'Rules and vacation replies are not available for this mailbox yet. Please contact NAI TALK support.')
    {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(['message' => $this->getMessage()], 503);
    }
}
