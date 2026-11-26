<?php

namespace App\Console\Commands;

use App\Services\Greenmail\CampaignQuota;
use Illuminate\Console\Command;

/** Show a domain's campaign emails, or give it free credits (goodwill, promotions). */
class GreenmailCampaignCredits extends Command
{
    protected $signature = 'greenmail:campaign-credits {domain} {--add= : give this many free campaign emails (valid 12 months)} {--note= : why}';

    protected $description = 'Show or give Green Mail campaign email credits for a domain';

    public function handle(CampaignQuota $quota): int
    {
        $domain = strtolower(trim((string) $this->argument('domain')));

        if ($add = (int) $this->option('add')) {
            $quota->addCredits($domain, $add, 'grant', null, $this->option('note') ?: 'Given by NAI TALK');
            $this->info("Gave {$domain} {$add} campaign emails.");
        }

        $s = $quota->status($domain);
        if ($s['unlimited']) {
            $this->line("{$domain}: no limit.");

            return self::SUCCESS;
        }
        $this->table(['Plan', 'This month', 'Used', 'Left', 'Credits', 'Resets'], [[
            $s['plan'] ?? '(none: '.config('greenmail.campaign_free_monthly').' free)', $s['allowance'], $s['used'], $s['left'], $s['credits'], substr($s['resets_at'], 0, 10),
        ]]);

        return self::SUCCESS;
    }
}
