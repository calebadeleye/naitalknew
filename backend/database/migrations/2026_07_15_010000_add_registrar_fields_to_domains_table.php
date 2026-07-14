<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds provider-independent registrar-management fields so Cloudflare
 * Registrar (and future providers) can be imported/managed alongside
 * Spaceship. No existing column is renamed or repurposed in a breaking way:
 *
 * - `provider` already IS the "registrar_provider" concept (free-text,
 *   default 'spaceship') — a new 'cloudflare' value just works.
 * - `status` already IS the "local_status" concept — untouched.
 * - `registration_status` stays exactly as-is (Spaceship's manual-registration
 *   payment/order workflow state machine) — `provider_status` below is a
 *   distinct, new concept: the raw registrar-reported state.
 * - `source` stays exactly as-is for backward compatibility with existing
 *   filters/tests — `registration_source` below is the new, provider-agnostic
 *   equivalent, backfilled from `source`.
 *
 * `client_id` becomes nullable because an imported-but-unassigned Cloudflare
 * domain (or a domain explicitly marked "NAITALK-owned internal") must be
 * able to exist without a client. The FK is changed from cascadeOnDelete to
 * nullOnDelete — deleting a client should orphan its domains back to
 * unassigned rather than deleting them, which is strictly safer than today's
 * cascade-delete behavior.
 */
return new class extends Migration
{
    public function up(): void
    {
        // The nullability change and the FK's onDelete behavior can't both be
        // altered via a single ->change() call, so this is split into three
        // explicit steps: drop the existing cascade-delete FK, relax the
        // column to nullable, then re-add the FK as nullOnDelete.
        Schema::table('domains', function (Blueprint $table): void {
            $table->dropForeign(['client_id']);
        });

        Schema::table('domains', function (Blueprint $table): void {
            $table->foreignId('client_id')->nullable()->change();
        });

        Schema::table('domains', function (Blueprint $table): void {
            $table->foreign('client_id')->references('id')->on('clients')->nullOnDelete();
        });

        Schema::table('domains', function (Blueprint $table): void {
            // purchased | transferred | imported | manual | internal
            $table->string('registration_source')->nullable()->after('source');
            // Raw/normalized registrar-reported state (active, expired,
            // pendingTransfer, redemption, unknown, ...) — distinct from
            // registration_status, which is NAITALK's own workflow state.
            $table->string('provider_status')->nullable()->after('registration_status');
            $table->string('provider_order_id')->nullable()->after('provider_domain_id');
            $table->unsignedBigInteger('provider_cost_minor')->nullable()->after('provider_order_id');
            $table->string('provider_currency', 3)->nullable()->after('provider_cost_minor');
            $table->unsignedBigInteger('customer_renewal_price_kobo')->nullable()->after('provider_currency');
            $table->date('next_invoice_date')->nullable()->after('expires_at');
            $table->timestamp('last_synced_at')->nullable()->after('next_invoice_date');
            // Sanitized (secrets stripped) raw registrar fields not otherwise
            // modeled as columns — carries nameservers, DNS status, lock
            // state, etc. for the client dashboard.
            $table->json('provider_metadata')->nullable()->after('last_synced_at');
            // unassigned | assigned | internal | needs_review
            $table->string('ownership_assignment_status')->default('assigned')->after('provider_metadata');
            // unpaid | pending | paid | failed | refunded — display/filter
            // convenience only; Invoice.status remains authoritative.
            $table->string('payment_status')->default('unpaid')->after('ownership_assignment_status');
            // not_started | pending | processing | completed | failed | requires_attention
            $table->string('registrar_operation_status')->default('not_started')->after('payment_status');
            // Separate axis from `provider`: a Cloudflare *zone* that isn't
            // Cloudflare *Registrar*-registered sets dns_provider=cloudflare
            // while provider stays whatever it already was (e.g. 'external').
            $table->string('dns_provider')->nullable()->after('registrar_operation_status');
            $table->foreignId('assigned_by')->nullable()->after('dns_provider')->constrained('users')->nullOnDelete();
            $table->timestamp('assigned_at')->nullable()->after('assigned_by');
            $table->text('assignment_note')->nullable()->after('assigned_at');

            $table->index('registrar_operation_status');
            $table->index('ownership_assignment_status');
            $table->index('dns_provider');
            $table->index(['provider', 'provider_domain_id']);
        });

        // Backfill new columns from existing data so every pre-existing
        // domain row remains fully consistent under the new fields.
        DB::table('domains')->update([
            'ownership_assignment_status' => 'assigned',
        ]);

        foreach ([
            'spaceship_registered' => 'purchased',
            'spaceship_transferred' => 'transferred',
            'external' => 'imported',
            'manual' => 'manual',
        ] as $legacySource => $registrationSource) {
            DB::table('domains')
                ->where('source', $legacySource)
                ->update(['registration_source' => $registrationSource]);
        }
    }

    public function down(): void
    {
        Schema::table('domains', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('assigned_by');
            $table->dropColumn([
                'registration_source',
                'provider_status',
                'provider_order_id',
                'provider_cost_minor',
                'provider_currency',
                'customer_renewal_price_kobo',
                'next_invoice_date',
                'last_synced_at',
                'provider_metadata',
                'ownership_assignment_status',
                'payment_status',
                'registrar_operation_status',
                'dns_provider',
                'assigned_at',
                'assignment_note',
            ]);
        });

        // Reverting client_id to NOT NULL will fail loudly here if any row
        // has been left unassigned — that's the correct, expected behavior
        // for this destructive rollback direction, not a bug to work around.
        Schema::table('domains', function (Blueprint $table): void {
            $table->dropForeign(['client_id']);
        });

        Schema::table('domains', function (Blueprint $table): void {
            $table->foreignId('client_id')->nullable(false)->change();
        });

        Schema::table('domains', function (Blueprint $table): void {
            $table->foreign('client_id')->references('id')->on('clients')->cascadeOnDelete();
        });
    }
};
