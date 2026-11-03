<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('scan_usage_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained('workspace_subscriptions')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('card_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('card_scan_id')->nullable()->constrained('card_scans')->nullOnDelete();
            $table->foreignId('bulk_import_item_id')->nullable()->constrained('bulk_import_items')->nullOnDelete();
            $table->string('idempotency_key', 128)->unique();
            $table->string('operation_type', 64); // single_scan, bulk_import_item, link_existing_contact
            $table->integer('quantity')->default(1);
            $table->string('status', 32)->default('reserved'); // reserved, confirmed, released
            $table->timestamp('reserved_at');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->timestamp('billing_period_starts_at');
            $table->timestamp('billing_period_ends_at');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'status', 'billing_period_starts_at'], 'idx_ledger_ws_period_status');
            $table->index(['subscription_id', 'status'], 'idx_ledger_sub_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scan_usage_ledger');
    }
};
