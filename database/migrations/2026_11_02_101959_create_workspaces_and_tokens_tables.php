<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Workspaces table
        Schema::create('workspaces', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedBigInteger('owner_id')->nullable();
            $table->timestamps();
        });

        // 2. Workspace User pivot table for multi-tenancy and roles (owner, admin, member)
        Schema::create('workspace_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role')->default('member'); // 'owner', 'admin', 'member'
            $table->timestamps();

            $table->unique(['workspace_id', 'user_id']);
        });

        // 3. API Tokens table for secure stateless Bearer authentication
        Schema::create('api_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name')->default('default');
            $table->string('token', 64)->unique(); // SHA-256 hash of token
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 4. Update Cards table with workspace_id and optional user_id
        Schema::table('cards', function (Blueprint $table) {
            $table->foreignId('workspace_id')->nullable()->after('id')->constrained('workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->after('workspace_id')->constrained('users')->nullOnDelete();
        });

        // 5. Data Migration & Preservation: Ensure default workspace and assign all existing cards
        $now = now();
        $defaultWorkspaceId = DB::table('workspaces')->insertGetId([
            'name' => 'Default Workspace',
            'slug' => 'default-workspace',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        // Link existing user if one exists (never create hardcoded default user)
        $existingUser = DB::table('users')->first();
        if ($existingUser) {
            DB::table('workspaces')->where('id', $defaultWorkspaceId)->update([
                'owner_id' => $existingUser->id,
            ]);

            DB::table('workspace_user')->insert([
                'workspace_id' => $defaultWorkspaceId,
                'user_id' => $existingUser->id,
                'role' => 'owner',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // Safely migrate all existing cards into default workspace so 0 cards are lost
        DB::table('cards')->whereNull('workspace_id')->update([
            'workspace_id' => $defaultWorkspaceId,
            'user_id' => $existingUser?->id,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->dropForeign(['workspace_id']);
            $table->dropForeign(['user_id']);
            $table->dropColumn(['workspace_id', 'user_id']);
        });

        Schema::dropIfExists('api_tokens');
        Schema::dropIfExists('workspace_user');
        Schema::dropIfExists('workspaces');
    }
};
