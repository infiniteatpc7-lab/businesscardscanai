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
        Schema::create('bulk_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('committed_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('exhibition_id')->constrained('exhibitions')->restrictOnDelete();
            $table->string('batch_uuid', 64)->unique();
            $table->string('status', 32)->default('draft')->index();
            $table->unsignedSmallInteger('total_items')->default(0);
            $table->unsignedSmallInteger('uploaded_items')->default(0);
            $table->unsignedSmallInteger('processed_items')->default(0);
            $table->unsignedSmallInteger('failed_items')->default(0);
            $table->unsignedSmallInteger('saved_items')->default(0);
            $table->unsignedSmallInteger('skipped_items')->default(0);
            $table->unsignedSmallInteger('max_batch_size')->default(100);
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();

            $table->index(['workspace_id', 'status']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('bulk_import_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bulk_import_id')->constrained('bulk_imports')->cascadeOnDelete();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('client_item_id', 64);
            $table->unsignedSmallInteger('sequence_order')->default(0);
            $table->string('status', 32)->default('pending')->index();
            $table->string('front_image_path', 500);
            $table->string('back_image_path', 500)->nullable();
            $table->json('extracted_data')->nullable();
            $table->unsignedTinyInteger('accuracy_score')->nullable();
            $table->text('error_message')->nullable();
            $table->foreignId('matched_card_id')->nullable()->constrained('cards')->nullOnDelete();
            $table->string('match_reason', 64)->nullable();
            $table->string('decision', 32)->nullable(); // create_new | link_existing | skip
            $table->foreignId('saved_card_id')->nullable()->constrained('cards')->nullOnDelete();
            $table->unsignedBigInteger('saved_scan_id')->nullable()->index();
            $table->timestamp('saved_at')->nullable();
            $table->timestamps();

            $table->unique(['bulk_import_id', 'client_item_id']);
            $table->index(['bulk_import_id', 'status']);
            $table->index(['workspace_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bulk_import_items');
        Schema::dropIfExists('bulk_imports');
    }
};

