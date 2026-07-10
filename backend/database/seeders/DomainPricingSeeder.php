<?php

namespace Database\Seeders;

use App\Models\DomainPricing;
use Illuminate\Database\Seeder;

/**
 * Seeds placeholder TLD pricing so the admin has rows to review/activate
 * before domain sales go live — these are starting points, not live prices.
 * Spaceship's real cost isn't queried here (no live credentials at seed
 * time); admin should sync/confirm real costs before flipping status to
 * 'active'.
 */
class DomainPricingSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            ['tld' => '.com', 'registration' => 1_500_000, 'renewal' => 1_500_000, 'transfer' => 1_200_000, 'markup' => 800_000],
            ['tld' => '.org', 'registration' => 1_600_000, 'renewal' => 1_600_000, 'transfer' => 1_300_000, 'markup' => 800_000],
            ['tld' => '.net', 'registration' => 1_700_000, 'renewal' => 1_700_000, 'transfer' => 1_400_000, 'markup' => 800_000],
            ['tld' => '.com.ng', 'registration' => 800_000, 'renewal' => 800_000, 'transfer' => 600_000, 'markup' => 400_000],
            ['tld' => '.ng', 'registration' => 5_000_000, 'renewal' => 5_000_000, 'transfer' => 4_000_000, 'markup' => 1_000_000],
            ['tld' => '.org.ng', 'registration' => 800_000, 'renewal' => 800_000, 'transfer' => 600_000, 'markup' => 400_000],
        ] as $row) {
            DomainPricing::query()->updateOrCreate(
                ['tld' => $row['tld']],
                [
                    'provider' => 'spaceship',
                    'currency' => 'NGN',
                    'registration_price_kobo' => $row['registration'],
                    'renewal_price_kobo' => $row['renewal'],
                    'transfer_price_kobo' => $row['transfer'],
                    'markup_type' => 'cost_plus_markup',
                    'markup_value_kobo' => $row['markup'],
                    'fixed_customer_price_kobo' => null,
                    'status' => 'needs_review',
                ]
            );
        }
    }
}
