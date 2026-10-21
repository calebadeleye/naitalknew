<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The email plans' feature lists said "Green Mail webmail"; Green Mail is
 * the product name on its own.
 */
return new class extends Migration
{
    private const OLD = 'Green Mail webmail: calendar, tasks, notes, templates and an AI assistant';

    private const NEW = 'Green Mail: AI assistant, calendar, tasks, notes and templates';

    public function up(): void
    {
        $this->swap(self::OLD, self::NEW);
    }

    public function down(): void
    {
        $this->swap(self::NEW, self::OLD);
    }

    private function swap(string $from, string $to): void
    {
        foreach (DB::table('hosting_plans')->where('plan_type', 'email')->get(['id', 'public_features']) as $plan) {
            $features = json_decode((string) $plan->public_features, true) ?: [];
            $updated = array_map(fn ($feature) => $feature === $from ? $to : $feature, $features);

            if ($updated !== $features) {
                DB::table('hosting_plans')->where('id', $plan->id)->update(['public_features' => json_encode($updated), 'updated_at' => now()]);
            }
        }
    }
};
