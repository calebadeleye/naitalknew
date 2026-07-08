<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('hosting_services')
            ->whereNull('primary_domain')
            ->orWhere('primary_domain', '')
            ->orderBy('id')
            ->each(function (object $service): void {
                DB::table('hosting_services')
                    ->where('id', $service->id)
                    ->update(['primary_domain' => strtolower($service->service_number).'.pending.naitalk.com']);
            });

        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->string('primary_domain')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('hosting_services', function (Blueprint $table): void {
            $table->string('primary_domain')->nullable()->change();
        });
    }
};
