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
        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->string('company')->nullable();
            $table->string('company_english')->nullable();
            $table->string('name')->nullable();
            $table->string('name_english')->nullable();
            $table->string('designation')->nullable();
            $table->string('department')->nullable();
            $table->json('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('website')->nullable();
            $table->text('address')->nullable();
            $table->text('address_english')->nullable();
            $table->text('tagline_services')->nullable();
            $table->string('tax_id')->nullable();
            $table->json('social_profiles')->nullable();
            $table->integer('accuracy_score')->default(90);
            $table->text('accuracy_reason')->nullable();
            $table->string('detected_language')->default('Gujarati');
            $table->string('image_path')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cards');
    }
};
