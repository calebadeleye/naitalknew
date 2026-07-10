<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->decimal('vat_rate', 6, 4)->default(0.0750)->after('tax_kobo');
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->decimal('vat_rate', 6, 4)->default(0.0750)->after('tax_kobo');
            $table->unsignedBigInteger('wallet_amount_applied_kobo')->default(0)->after('amount_paid_kobo');
            $table->unsignedBigInteger('overpayment_amount_kobo')->default(0)->after('wallet_amount_applied_kobo');
            $table->unsignedBigInteger('underpayment_amount_kobo')->default(0)->after('overpayment_amount_kobo');
            $table->unsignedBigInteger('outstanding_amount_kobo')->default(0)->after('underpayment_amount_kobo');
            $table->string('reconciliation_status')->default('pending')->after('status');
        });

        $vatRate = (float) config('billing.vat_rate');

        DB::table('orders')->update(['vat_rate' => $vatRate]);

        DB::table('invoices')->update([
            'vat_rate' => $vatRate,
        ]);

        DB::table('invoices')->update([
            'outstanding_amount_kobo' => DB::raw('CASE WHEN total_kobo > amount_paid_kobo THEN total_kobo - amount_paid_kobo ELSE 0 END'),
        ]);

        DB::table('invoices')->where('status', 'paid')->update(['reconciliation_status' => 'reconciled']);
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['vat_rate']);
        });

        Schema::table('invoices', function (Blueprint $table): void {
            $table->dropColumn([
                'vat_rate',
                'wallet_amount_applied_kobo',
                'overpayment_amount_kobo',
                'underpayment_amount_kobo',
                'outstanding_amount_kobo',
                'reconciliation_status',
            ]);
        });
    }
};
