<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/** Creates the key pair browsers use to trust Green Mail's notifications. --write adds them to .env if missing (never overwrites). */
class GreenmailVapidKeys extends Command
{
    protected $signature = 'greenmail:vapid-keys {--write : Add them to .env (only if not set already)}';

    protected $description = 'Generate the Web Push (VAPID) keys for Green Mail notifications';

    public function handle(): int
    {
        if (filled(config('greenmail.vapid.public_key'))) {
            $this->info('Keys are already set. Changing them would turn off notifications on every device.');

            return self::SUCCESS;
        }

        $keys = VAPID::createVapidKeys();

        if (! $this->option('write')) {
            $this->line('GREENMAIL_VAPID_PUBLIC_KEY='.$keys['publicKey']);
            $this->line('GREENMAIL_VAPID_PRIVATE_KEY=(hidden — run with --write to save)');

            return self::SUCCESS;
        }

        $path = base_path('.env');
        file_put_contents($path, rtrim((string) file_get_contents($path))."\n\nGREENMAIL_VAPID_PUBLIC_KEY={$keys['publicKey']}\nGREENMAIL_VAPID_PRIVATE_KEY={$keys['privateKey']}\n");
        $this->info('Keys added to .env. Run "php artisan config:cache" if the config is cached.');

        return self::SUCCESS;
    }
}
