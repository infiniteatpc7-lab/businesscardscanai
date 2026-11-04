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
        Schema::create('payment_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained('workspace_subscriptions')->nullOnDelete();
            $table->foreignId('plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('INR');
            $table->string('gateway', 64); // razorpay, stripe, manual, etc.
            $table->string('gateway_order_id', 100)->nullable()->index();
            $table->string('gateway_payment_id', 100)->nullable()->unique();
            $table->string('gateway_signature', 255)->nullable();
            $table->string('status', 32)->default('pending')->index(); // pending, successful, failed, refunded
            $table->timestamp('paid_at')->nullable();
            $table->json('gateway_response')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            // Composite indexes for fast query resolution
            $table->index(['workspace_id', 'status']);
            $table->index(['gateway', 'gateway_order_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_transactions');
    }
};
