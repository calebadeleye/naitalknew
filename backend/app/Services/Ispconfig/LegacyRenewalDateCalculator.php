<?php

namespace App\Services\Ispconfig;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Throwable;

/**
 * Turns an ISPConfig creation date into a yearly renewal date for legacy
 * (imported) clients. Pure/stateless — no ISPConfig calls, no persistence.
 */
class LegacyRenewalDateCalculator
{
    /**
     * Known field names ISPConfig (or its various forks/versions) may use
     * for a record's creation timestamp. Checked in order.
     */
    private const CREATION_DATE_FIELDS = [
        'created_at',
        'created',
        'added_date',
        'date_added',
        'sys_created_at',
    ];

    /**
     * Best-effort extraction of a creation datetime from a raw ISPConfig
     * remote-API record. Returns null when no usable value is found —
     * callers must then require a manual renewal date instead of guessing.
     *
     * @param  array<string, mixed>  $remoteRecord
     */
    public static function extractCreationDate(array $remoteRecord): ?Carbon
    {
        foreach (self::CREATION_DATE_FIELDS as $field) {
            if ($date = self::parseField($remoteRecord[$field] ?? null)) {
                return $date;
            }
        }

        // Fallback: some ISPConfig forks/versions use a field we didn't
        // anticipate. Any other key that looks like a creation timestamp is
        // better than forcing every legacy client into manual_required.
        foreach ($remoteRecord as $key => $value) {
            if (in_array($key, self::CREATION_DATE_FIELDS, true)) {
                continue;
            }

            if (! str_contains(strtolower((string) $key), 'created')) {
                continue;
            }

            if ($date = self::parseField($value)) {
                return $date;
            }
        }

        return null;
    }

    private static function parseField(mixed $value): ?Carbon
    {
        if ($value === null || $value === '' || $value === 0) {
            return null;
        }

        if (in_array($value, ['0000-00-00', '0000-00-00 00:00:00'], true)) {
            return null;
        }

        try {
            if (is_numeric($value)) {
                return Carbon::createFromTimestamp((int) $value);
            }

            return Carbon::parse((string) $value);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Advances $createdAt by one year at a time until the result is strictly
     * after $reference (today) — i.e. the next upcoming yearly anniversary,
     * not simply "created date + 1 year".
     *
     * Example: created 2024-03-15, reference (today) 2026-07-08 → the
     * 2024-03-15 and 2026-03-15 anniversaries have already passed, so the
     * result is 2027-03-15.
     */
    public static function nextAnniversary(CarbonInterface $createdAt, CarbonInterface $reference): Carbon
    {
        $anniversary = Carbon::instance($createdAt)->startOfDay();
        $reference = Carbon::instance($reference)->startOfDay();

        while ($anniversary->lessThanOrEqualTo($reference)) {
            $anniversary = $anniversary->addYear();
        }

        return $anniversary;
    }
}
