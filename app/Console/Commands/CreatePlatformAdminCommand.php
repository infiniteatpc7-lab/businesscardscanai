<?php

namespace App\Console\Commands;

use App\Models\PlatformAdmin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreatePlatformAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'admin:create
                            {email? : The email address of the platform admin}
                            {--name= : The full name of the platform admin}
                            {--password= : The plaintext password for the admin}
                            {--role=super_admin : The admin role (super_admin, admin)}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Create or update a Platform Administrator account';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $email = $this->argument('email') ?? $this->ask('Administrator Email');
        $name = $this->option('name') ?? $this->ask('Administrator Name', 'Platform Admin');
        $password = $this->option('password') ?? $this->secret('Administrator Password');
        $role = $this->option('role') ?? 'super_admin';

        $validator = Validator::make([
            'email' => $email,
            'name' => $name,
            'password' => $password,
            'role' => $role,
        ], [
            'email' => 'required|email',
            'name' => 'required|string|max:100',
            'password' => 'required|string|min:8',
            'role' => 'required|in:super_admin,admin',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $admin = PlatformAdmin::updateOrCreate(
            ['email' => strtolower(trim($email))],
            [
                'name' => $name,
                'password' => Hash::make($password),
                'role' => $role,
                'status' => 'active',
            ]
        );

        $this->info("Platform Administrator [{$admin->email}] created/updated successfully.");

        return self::SUCCESS;
    }
}
