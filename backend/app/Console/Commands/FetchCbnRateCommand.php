<?php

namespace App\Console\Commands;

use App\Services\NaitalkCall\CbnExchangeRate;
use Illuminate\Console\Command;
use Throwable;

/** Keeps the official USD→NGN rate for Naitalk Call's Naira prices up to date. */
class FetchCbnRateCommand extends Command
{
    protected $signature = 'naitalk-call:fetch-cbn-rate';

    protected $description = 'Fetch the Central Bank of Nigeria official USD→NGN rate for Naitalk Call prices';

    public function handle(CbnExchangeRate $cbn): int
    {
        try {
            $rate = $cbn->refresh();
        } catch (Throwable $e) {
            // Prices keep using the last rate fetched.
            $this->error($e->getMessage());

            return self::FAILURE;
        }
        $this->info("CBN official rate {$rate['date']}: ₦{$rate['rate']} per \$1");

        return self::SUCCESS;
    }
}
