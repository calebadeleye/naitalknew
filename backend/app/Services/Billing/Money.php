<?php

namespace App\Services\Billing;

class Money
{
    public static function naira(int $kobo): string
    {
        return '₦'.number_format($kobo / 100);
    }
}
