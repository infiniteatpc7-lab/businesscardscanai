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
        Schema::create('ai_api_usage_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_api_request_id')->constrained('ai_api_requests')->cascadeOnDelete();

            // Normalized Gemini token breakdown
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('candidates_tokens')->default(0);
            $table->unsignedInteger('thoughts_tokens')->default(0);
            $table->unsignedInteger('cached_content_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);

            // Exact sanitized usage metadata returned by Gemini (usageMetadata)
            $table->json('raw_usage_metadata')->nullable();

            $table->timestamp('created_at')->useCurrent();

            // Unique 1:1 relationship with ai_api_requests
            $table->unique('ai_api_request_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_api_usage_details');
    }
};
