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
            $table->string('cost_calculation_status', 32)->default('pending')->after('cost_inr')->index();
            $table->timestamp('cost_calculated_at')->nullable()->after('cost_calculation_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ai_api_requests', function (Blueprint $table) {
            $table->dropIndex(['cost_calculation_status']);
            $table->dropColumn(['cost_calculation_status', 'cost_calculated_at']);
        });
    }
};
