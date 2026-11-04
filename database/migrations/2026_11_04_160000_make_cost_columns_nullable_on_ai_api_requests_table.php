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
        Schema::table('ai_api_requests', function (Blueprint $table) {
            $table->decimal('cost_usd', 12, 6)->nullable()->default(null)->change();
            $table->decimal('cost_inr', 12, 6)->nullable()->default(null)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_api_requests', function (Blueprint $table) {
            $table->decimal('cost_usd', 12, 6)->default(0.000000)->change();
            $table->decimal('cost_inr', 12, 6)->default(0.000000)->change();
        });
    }
};
