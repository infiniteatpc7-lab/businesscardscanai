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
        Schema::create('ai_cost_exchange_rates', function (Blueprint $table) {
            $table->id();
            $table->string('base_currency', 3)->default('USD');
            $table->string('target_currency', 3)->default('INR');
            $table->decimal('exchange_rate', 10, 4); // e.g. 86.5000
            $table->date('effective_date');
            $table->string('source', 64)->default('system'); // e.g. rbi, system, fixer, open_exchange_rates
            $table->boolean('is_active')->default(true);
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            // Indexes and constraints
            $table->unique(['base_currency', 'target_currency', 'effective_date', 'source'], 'ai_exchange_rates_unique');
            $table->index(['base_currency', 'target_currency', 'is_active', 'effective_date'], 'ai_exchange_rates_lookup_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_cost_exchange_rates');
    }
};
