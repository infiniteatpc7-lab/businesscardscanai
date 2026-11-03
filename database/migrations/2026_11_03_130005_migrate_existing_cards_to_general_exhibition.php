<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();
        $workspaces = DB::table('workspaces')->get();

        foreach ($workspaces as $workspace) {
            $ownerExists = $workspace->owner_id
                ? DB::table('users')->where('id', $workspace->owner_id)->exists()
                : false;

            // Find or create a canonical General Exhibition for this workspace
            $generalExhibition = DB::table('exhibitions')
                ->where('workspace_id', $workspace->id)
                ->where('name', 'General Exhibition')
                ->first();

            if (! $generalExhibition) {
                $exhibitionId = DB::table('exhibitions')->insertGetId([
                    'workspace_id' => $workspace->id,
                    'created_by_user_id' => $ownerExists ? $workspace->owner_id : null,
                    'name' => 'General Exhibition',
                    'organizer' => null,
                    'venue' => null,
                    'city' => null,
                    'start_date' => null,
                    'end_date' => null,
                    'description' => 'Default workspace collection for general cards and scans.',
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            } else {
                $exhibitionId = $generalExhibition->id;
            }

            // Associate all existing workspace cards to this General Exhibition
            $cardIds = DB::table('cards')
                ->where('workspace_id', $workspace->id)
                ->pluck('id');

            foreach ($cardIds as $cardId) {
                $exists = DB::table('card_exhibitions')
                    ->where('card_id', $cardId)
                    ->where('exhibition_id', $exhibitionId)
                    ->exists();

                if (! $exists) {
                    DB::table('card_exhibitions')->insert([
                        'card_id' => $cardId,
                        'exhibition_id' => $exhibitionId,
                        'created_at' => $now,
                    ]);
                }
            }

            // Set default selected exhibition for existing workspace members
            $userIds = DB::table('workspace_user')
                ->where('workspace_id', $workspace->id)
                ->pluck('user_id');

            foreach ($userIds as $userId) {
                $selectedExists = DB::table('user_selected_exhibitions')
                    ->where('user_id', $userId)
                    ->where('workspace_id', $workspace->id)
                    ->exists();

                if (! $selectedExists) {
                    DB::table('user_selected_exhibitions')->insert([
                        'user_id' => $userId,
                        'workspace_id' => $workspace->id,
                        'exhibition_id' => $exhibitionId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Safe reversal: detach card_exhibitions and remove General Exhibitions created
        DB::table('exhibitions')
            ->where('name', 'General Exhibition')
            ->where('description', 'Default workspace collection for general cards and scans.')
            ->delete();
    }
};
