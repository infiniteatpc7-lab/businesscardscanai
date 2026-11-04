<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'status' => 'active',
            ]
        );

        // Ensure default workspace exists
        if ($user->workspaces()->count() === 0) {
            $workspace = Workspace::firstOrCreate(
                ['slug' => 'demo-workspace'],
                ['name' => 'Demo Workspace', 'owner_id' => $user->id, 'status' => 'active']
            );
            $workspace->users()->syncWithoutDetaching([$user->id => ['role' => 'owner']]);
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        }

        $this->call(PlatformAdminSeeder::class);
        $this->call(AiPricingSeeder::class);
    }
}
