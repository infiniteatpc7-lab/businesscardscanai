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
        Schema::table('card_scans', function (Blueprint $table) {
            $table->foreignId('bulk_import_item_id')
                ->nullable()
                ->unique('uq_card_scans_bulk_item')
                ->constrained('bulk_import_items')
                ->nullOnDelete();

            $table->string('scan_idempotency_key', 64)
                ->nullable()
                ->unique('uq_card_scans_idempotency_key');

            $table->foreignId('saved_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('card_scans', function (Blueprint $table) {
            $table->dropForeign(['bulk_import_item_id']);
            $table->dropForeign(['saved_by_user_id']);
            $table->dropUnique('uq_card_scans_bulk_item');
            $table->dropUnique('uq_card_scans_idempotency_key');
            $table->dropColumn(['bulk_import_item_id', 'scan_idempotency_key', 'saved_by_user_id']);
        });
    }
};

