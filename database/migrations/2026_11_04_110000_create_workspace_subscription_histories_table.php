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
        Schema::create('workspace_subscription_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->constrained('workspace_subscriptions')->cascadeOnDelete();
            $table->foreignId('previous_plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->string('previous_status', 32)->nullable();
            $table->string('status', 32)->default('active');
            $table->string('assignment_source', 32)->default('system_free'); // system_free, admin_assigned, checkout, renewal
            $table->timestamp('period_starts_at');
            $table->timestamp('period_ends_at')->nullable();
            $table->foreignId('assigned_by_admin_id')->nullable()->constrained('platform_admins')->nullOnDelete();
            $table->string('reason', 500)->nullable();
            $table->string('idempotency_key', 64)->nullable()->unique();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Composite indexes for audit and history queries
            $table->index(['workspace_id', 'created_at']);
            $table->index(['subscription_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workspace_subscription_histories');
    }
};
