<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role')->default('client')->after('password');
            $table->string('phone')->nullable()->after('email');
            $table->string('account_status')->default('pending_verification')->after('role');
            $table->timestamp('last_login_at')->nullable()->after('remember_token');
        });

        Schema::create('clients', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('client_code')->unique();
            $table->string('company_name')->nullable();
            $table->string('account_type')->default('registered_user')->index();
            $table->string('client_status')->default('active')->index();
            $table->string('status')->default('active');
            $table->string('billing_email')->nullable();
            $table->string('billing_phone')->nullable();
            $table->text('billing_address')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->default('Nigeria');
            $table->text('internal_notes')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('hosting_plans', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('short_description');
            $table->unsignedInteger('monthly_price_kobo');
            $table->unsignedInteger('annual_price_kobo');
            $table->unsignedInteger('setup_fee_kobo')->default(0);
            $table->string('storage_allocation');
            $table->string('bandwidth_policy');
            $table->unsignedInteger('websites');
            $table->unsignedInteger('databases');
            $table->unsignedInteger('email_accounts');
            $table->string('backup_frequency')->nullable();
            $table->string('support_tier')->default('standard');
            $table->boolean('migration_included')->default(false);
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->text('internal_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('hosting_add_ons', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->unsignedInteger('monthly_price_kobo')->default(0);
            $table->unsignedInteger('annual_price_kobo')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('order_number')->unique();
            $table->string('status')->default('pending_payment');
            $table->string('billing_cycle')->default('annual');
            $table->unsignedInteger('subtotal_kobo');
            $table->unsignedInteger('discount_kobo')->default(0);
            $table->unsignedInteger('tax_kobo')->default(0);
            $table->unsignedInteger('total_kobo');
            $table->timestamp('accepted_terms_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->nullableMorphs('orderable');
            $table->string('description');
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('unit_price_kobo');
            $table->unsignedInteger('total_kobo');
            $table->timestamps();
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('invoice_number')->unique();
            $table->string('status')->default('unpaid');
            $table->unsignedInteger('subtotal_kobo');
            $table->unsignedInteger('discount_kobo')->default(0);
            $table->unsignedInteger('tax_kobo')->default(0);
            $table->unsignedInteger('total_kobo');
            $table->unsignedInteger('amount_paid_kobo')->default(0);
            $table->date('issued_at');
            $table->date('due_at');
            $table->date('paid_at')->nullable();
            $table->json('line_items')->nullable();
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('gateway');
            $table->string('reference')->unique();
            $table->string('status')->default('pending');
            $table->unsignedInteger('amount_kobo');
            $table->string('currency')->default('NGN');
            $table->timestamp('paid_at')->nullable();
            $table->json('gateway_payload')->nullable();
            $table->timestamps();
        });

        Schema::create('hosting_services', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hosting_plan_id')->constrained()->restrictOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('service_number')->unique();
            $table->string('display_name')->nullable();
            $table->string('primary_domain')->nullable();
            $table->string('status')->default('pending_provisioning');
            $table->string('billing_cycle')->default('annual');
            $table->unsignedInteger('amount_kobo')->default(0);
            $table->date('starts_at')->nullable();
            $table->date('next_due_date')->nullable();
            $table->date('renews_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->date('suspended_at')->nullable();
            $table->boolean('auto_renew_enabled')->default(true);
            $table->string('provisioning_status')->default('not_provisioned')->index();
            $table->unsignedBigInteger('ispconfig_server_id')->nullable();
            $table->string('ispconfig_site_id')->nullable();
            $table->timestamp('provisioning_override_approved_at')->nullable();
            $table->foreignId('provisioning_override_approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('provisioning_payload')->nullable();
            $table->timestamps();
        });

        Schema::create('ispconfig_client_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('ispconfig_server_id')->default(1);
            $table->string('ispconfig_client_id')->nullable();
            $table->timestamp('provisioned_at')->nullable();
            $table->string('sync_status')->default('not_provisioned')->index();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['client_id', 'ispconfig_server_id']);
        });

        Schema::create('ispconfig_service_mappings', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('hosting_service_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('ispconfig_server_id')->default(1);
            $table->foreignId('ispconfig_client_mapping_id')->constrained()->cascadeOnDelete();
            $table->string('ispconfig_website_id')->nullable();
            $table->string('ispconfig_mail_domain_id')->nullable();
            $table->string('ispconfig_database_id')->nullable();
            $table->string('ispconfig_ftp_user_id')->nullable();
            $table->string('technical_status')->default('awaiting_provisioning')->index();
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata_json')->nullable();
            $table->timestamps();
            $table->unique(['hosting_service_id', 'ispconfig_server_id'], 'ispconfig_service_server_unique');
        });

        Schema::create('support_tickets', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hosting_service_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ticket_number')->unique();
            $table->string('subject');
            $table->string('status')->default('open');
            $table->string('priority')->default('normal');
            $table->text('latest_message')->nullable();
            $table->timestamps();
        });

        Schema::create('provisioning_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('staff_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('hosting_service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider')->default('ispconfig');
            $table->string('action');
            $table->string('status')->default('queued');
            $table->text('message')->nullable();
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('staff_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('hosting_service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action');
            $table->text('reason')->nullable();
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('client_id')->nullable()->constrained()->nullOnDelete();
            $table->string('channel');
            $table->string('template');
            $table->string('recipient');
            $table->string('status')->default('queued');
            $table->json('payload')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification_logs');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('provisioning_logs');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('ispconfig_service_mappings');
        Schema::dropIfExists('ispconfig_client_mappings');
        Schema::dropIfExists('hosting_services');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('hosting_add_ons');
        Schema::dropIfExists('hosting_plans');
        Schema::dropIfExists('clients');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['role', 'phone', 'account_status', 'last_login_at']);
        });
    }
};
