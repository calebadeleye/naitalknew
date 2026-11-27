<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Contact groups (e.g. "Customers", "Church members") so a campaign can go to one group. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('greenmail_contact_groups', function (Blueprint $table): void {
            $table->id();
            $table->string('owner_email');
            $table->string('name', 80);
            $table->timestamps();

            $table->unique(['owner_email', 'name']);
        });

        Schema::create('greenmail_contact_group_members', function (Blueprint $table): void {
            $table->foreignId('group_id')->constrained('greenmail_contact_groups')->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained('greenmail_contacts')->cascadeOnDelete();

            $table->primary(['group_id', 'contact_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('greenmail_contact_group_members');
        Schema::dropIfExists('greenmail_contact_groups');
    }
};
