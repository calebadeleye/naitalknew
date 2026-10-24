<?php

namespace App\Console\Commands;

use App\Services\Greenmail\ExpoPushNotifications;
use Illuminate\Console\Command;

/** Every minute: new-mail notifications for phones with the Green Mail app. */
class GreenmailExpoPushCheck extends Command
{
    protected $signature = 'greenmail:expo-push-check';

    protected $description = 'Send Green Mail app (Expo) notifications for new mail';

    public function handle(ExpoPushNotifications $push): int
    {
        $result = $push->checkAll();
        $this->info("Checked {$result['mailboxes']} mailbox(es), sent {$result['sent']} notification(s).");

        return self::SUCCESS;
    }
}
