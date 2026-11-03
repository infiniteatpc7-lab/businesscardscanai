<?php

namespace Database\Seeders;

use App\Models\PlatformAdmin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class PlatformAdminSeeder extends Seeder
{
    /**
     * Seed initial Platform Administrator account.
     */
    public function run(): void
    {
        PlatformAdmin::firstOrCreate(
            ['email' => 'admin@businesscardscan.ai'],
            [
                'name' => 'Platform Administrator',
                'password' => Hash::make('Admin@123456'),
                'role' => 'super_admin',
                'status' => 'active',
            ]
        );
    }
}
