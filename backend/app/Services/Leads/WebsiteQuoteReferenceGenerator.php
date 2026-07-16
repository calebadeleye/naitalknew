<?php

namespace App\Services\Leads;

use App\Models\WebsiteQuoteReferenceSequence;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Generates race-safe, human-readable, per-day sequential references
 * (NWT-20260716-0001) for website quote requests via a locked counter row,
 * rather than counting existing rows (fragile under concurrent inserts).
 */
class WebsiteQuoteReferenceGenerator
{
    public function generate(): string
    {
        $today = now()->toDateString();

        $nextNumber = DB::transaction(function () use ($today) {
            $sequence = WebsiteQuoteReferenceSequence::query()
                ->where('date', $today)
                ->lockForUpdate()
                ->first();

            if (! $sequence) {
                $sequence = $this->createSequenceRow($today);
            }

            $next = $sequence->last_number + 1;
            $sequence->update(['last_number' => $next]);

            return $next;
        });

        return 'NWT-'.now()->format('Ymd').'-'.str_pad((string) $nextNumber, 4, '0', STR_PAD_LEFT);
    }

    private function createSequenceRow(string $date): WebsiteQuoteReferenceSequence
    {
        try {
            return WebsiteQuoteReferenceSequence::query()->create(['date' => $date, 'last_number' => 0]);
        } catch (QueryException $exception) {
            // Another concurrent request created today's row first — lock and use it.
            return WebsiteQuoteReferenceSequence::query()->where('date', $date)->lockForUpdate()->firstOrFail();
        }
    }
}
