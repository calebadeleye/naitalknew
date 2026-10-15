<?php

namespace App\Services\Hosting;

use Illuminate\Support\Carbon;

/**
 * Reads the "Days of month" table out of an AWStats static report
 * (web/stats/awsindex.html, built nightly by ISPConfig). Each row is:
 *   <tr><td>30 Jun 2026</td><td>visits</td><td>pages</td><td>hits</td><td>bandwidth</td></tr>
 */
class AwstatsReportParser
{
    /**
     * @return array<int, array{date: string, visits: int, pages: int, hits: int, bandwidth_bytes: int}>
     */
    public static function days(string $html): array
    {
        preg_match_all(
            '#<tr><td>(\d{2} [A-Z][a-z]{2} \d{4})</td><td>([\d,]+)</td><td>([\d,]+)</td><td>([\d,]+)</td><td>([^<]*)</td></tr>#',
            $html,
            $matches,
            PREG_SET_ORDER,
        );

        $days = [];

        foreach ($matches as [, $date, $visits, $pages, $hits, $bandwidth]) {
            $parsed = Carbon::createFromFormat('d M Y', $date);

            if ($parsed === false) {
                continue;
            }

            $days[$parsed->toDateString()] = [
                'date' => $parsed->toDateString(),
                'visits' => self::number($visits),
                'pages' => self::number($pages),
                'hits' => self::number($hits),
                'bandwidth_bytes' => self::bytes($bandwidth),
            ];
        }

        return array_values($days);
    }

    /** "159.43 MB" / "30.32 KB" / "1.2 GB" / "512 Bytes" / "0" → bytes. */
    public static function bytes(string $value): int
    {
        if (! preg_match('/([\d.,]+)\s*(Bytes|KB|MB|GB|TB)?/i', trim($value), $match)) {
            return 0;
        }

        $number = (float) str_replace(',', '', $match[1]);
        $power = ['' => 0, 'BYTES' => 0, 'KB' => 1, 'MB' => 2, 'GB' => 3, 'TB' => 4][strtoupper($match[2] ?? '')] ?? 0;

        return (int) round($number * (1024 ** $power));
    }

    private static function number(string $value): int
    {
        return (int) str_replace(',', '', $value);
    }
}
