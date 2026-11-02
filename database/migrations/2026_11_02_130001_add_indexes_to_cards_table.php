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
        Schema::table('cards', function (Blueprint $table) {
            $table->index(['workspace_id', 'created_at']);
            $table->index(['workspace_id', 'company']);
            $table->index(['workspace_id', 'name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropIndex(['workspace_id', 'created_at']);
            $table->dropIndex(['workspace_id', 'company']);
            $table->dropIndex(['workspace_id', 'name']);
        });
    }
};
