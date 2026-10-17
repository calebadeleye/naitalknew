<?php

namespace App\Console\Commands;

use App\Services\Greenmail\PushNotifications;
use Illuminate\Console\Command;

/** Every minute: look for new mail in mailboxes that asked for notifications, and push them. */
class GreenmailPushCheck extends Command
{
    protected $signature = 'greenmail:push-check';

    protected $description = 'Send phone/desktop notifications for new Green Mail mail';

    public function handle(PushNotifications $push): int
    {
        $result = $push->checkAll();
        $this->info("Checked {$result['mailboxes']} mailbox(es), sent {$result['sent']} notification(s).");

        return self::SUCCESS;
    }
}
