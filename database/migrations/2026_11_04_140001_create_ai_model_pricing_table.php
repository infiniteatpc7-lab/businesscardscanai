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
        Schema::create('ai_model_pricing', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 64)->default('google');
            $table->string('model_identifier', 64); // e.g. gemini-2.5-flash, gemini-1.5-flash, gemini-1.5-pro
            $table->string('pricing_version', 32); // e.g. 2026-v1, 2026-Q1
            $table->decimal('input_token_price_per_million', 12, 6); // USD per 1M prompt tokens
            $table->decimal('output_token_price_per_million', 12, 6); // USD per 1M candidate tokens
            $table->decimal('cached_input_token_price_per_million', 12, 6)->default(0.000000);
            $table->decimal('thoughts_token_price_per_million', 12, 6)->default(0.000000);
            $table->decimal('input_token_unit_price', 16, 10); // price per single token
            $table->decimal('output_token_unit_price', 16, 10);
            $table->decimal('cached_input_token_unit_price', 16, 10)->default(0.0000000000);
            $table->decimal('thoughts_token_unit_price', 16, 10)->default(0.0000000000);
            $table->string('currency', 3)->default('USD');
            $table->timestamp('effective_from');
            $table->timestamp('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('notes', 255)->nullable();
            $table->timestamps();

            // Unique version constraint per provider + model
            $table->unique(['provider', 'model_identifier', 'pricing_version'], 'ai_model_pricing_unique');
            $table->index(['model_identifier', 'is_active', 'effective_from'], 'ai_model_pricing_lookup_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_model_pricing');
    }
};
