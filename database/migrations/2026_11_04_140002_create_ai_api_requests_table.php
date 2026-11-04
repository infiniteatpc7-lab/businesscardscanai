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
        Schema::create('ai_api_requests', function (Blueprint $table) {
            $table->id();

            // Customer & Workspace Attribution
            $table->foreignId('workspace_id')->nullable()->constrained('workspaces')->nullOnDelete();
            $table->string('workspace_name', 255)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('user_name', 255)->nullable();
            $table->string('user_email', 255)->nullable();

            // Scan Type & Request Identity
            $table->string('scan_type', 32)->index(); // single_scan, bulk_scan
            $table->string('request_uuid', 64)->unique();
            $table->string('idempotency_key', 64)->nullable()->index();

            // Related Entities (Nullable & deletion-preserving)
            $table->foreignId('card_scan_id')->nullable()->constrained('card_scans')->nullOnDelete();
            $table->foreignId('card_id')->nullable()->constrained('cards')->nullOnDelete();
            $table->foreignId('bulk_import_id')->nullable()->constrained('bulk_imports')->nullOnDelete();
            $table->foreignId('bulk_import_item_id')->nullable()->constrained('bulk_import_items')->nullOnDelete();

            // Models, Attempts & Fallback Chain
            $table->string('requested_model', 64);
            $table->string('actual_model', 64)->nullable();
            $table->unsignedInteger('attempt_number')->default(1);
            $table->boolean('is_fallback')->default(false);
            $table->string('fallback_reason', 255)->nullable();
            $table->foreignId('parent_request_id')->nullable()->constrained('ai_api_requests')->nullOnDelete();

            // Input Specifications
            $table->unsignedInteger('image_count')->default(1);

            // Status & Safe Diagnostics (No sensitive API keys, prompts, or personal card data)
            $table->string('status', 32)->default('pending')->index(); // pending, success, failed
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('error_code', 64)->nullable();
            $table->string('error_message', 500)->nullable();

            // Timings
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();

            // Token Usage Accounting
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('candidates_tokens')->default(0);
            $table->unsignedInteger('thoughts_tokens')->default(0);
            $table->unsignedInteger('cached_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);

            // Costs & Currency Conversions
            $table->decimal('cost_usd', 12, 6)->default(0.000000);
            $table->decimal('cost_inr', 12, 6)->default(0.000000);

            // Pricing & Rate Traceability
            $table->string('pricing_version', 32)->nullable();
            $table->decimal('exchange_rate', 10, 4)->nullable();
            $table->foreignId('model_pricing_id')->nullable()->constrained('ai_model_pricing')->nullOnDelete();
            $table->foreignId('exchange_rate_id')->nullable()->constrained('ai_cost_exchange_rates')->nullOnDelete();

            $table->timestamps();

            // Composite indexes for audit, reporting and lookup
            $table->index(['workspace_id', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index(['actual_model', 'status']);
            $table->index(['status', 'created_at']);
            $table->index(['idempotency_key', 'attempt_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_api_requests');
    }
};
