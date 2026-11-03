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
        Schema::table('users', function (Blueprint $table) {
            $table->string('status')->default('active')->index()->after('remember_token');
            $table->timestamp('suspended_at')->nullable()->after('status');
            $table->text('suspension_reason')->nullable()->after('suspended_at');
            $table->foreignId('suspended_by_admin_id')->nullable()->after('suspension_reason')
                ->constrained('platform_admins')->nullOnDelete();
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('status')->default('active')->index()->after('slug');
            $table->timestamp('suspended_at')->nullable()->after('status');
            $table->text('suspension_reason')->nullable()->after('suspended_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn(['status', 'suspended_at', 'suspension_reason']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['suspended_by_admin_id']);
            $table->dropColumn(['status', 'suspended_at', 'suspension_reason', 'suspended_by_admin_id']);
        });
    }
};
