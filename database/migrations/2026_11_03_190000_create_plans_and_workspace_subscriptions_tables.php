<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('slug', 64)->unique();
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2)->default(0);
            $table->string('currency', 3)->default('USD');
            $table->integer('monthly_scan_allowance')->default(50);
            $table->string('invoice_interval', 32)->default('month');
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('is_default')->default(false)->index();
            $table->json('features')->nullable();
            $table->timestamps();
        });

        // Seed initial Free, Pro and Business plans
        $now = now();
        DB::table('plans')->insert([
            [
                'name' => 'Free',
                'slug' => 'free',
                'description' => 'Essential business card scanning for individuals and small booth setups.',
                'price' => 0.00,
                'currency' => 'USD',
                'monthly_scan_allowance' => 50,
                'invoice_interval' => 'month',
                'is_active' => true,
                'is_default' => true,
                'features' => json_encode([
                    '50 successful card scans / month',
                    'Shared team workspace',
                    'Exhibition tagging & organization',
                    'CSV export',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Pro',
                'slug' => 'pro',
                'description' => 'High-capacity scanning for active sales reps and growing exhibitors.',
                'price' => 19.00,
                'currency' => 'USD',
                'monthly_scan_allowance' => 500,
                'invoice_interval' => 'month',
                'is_active' => true,
                'is_default' => false,
                'features' => json_encode([
                    '500 successful card scans / month',
                    'Unlimited team members',
                    'Bulk multiple photo import',
                    'Multi-language regional OCR',
                    'Shared workspace quota pool',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Business',
                'slug' => 'business',
                'description' => 'Full-scale enterprise booth capture and multi-exhibition operations.',
                'price' => 49.00,
                'currency' => 'USD',
                'monthly_scan_allowance' => 2500,
                'invoice_interval' => 'month',
                'is_active' => true,
                'is_default' => false,
                'features' => json_encode([
                    '2,500 successful card scans / month',
                    'Priority async processing',
                    'Multi-exhibition workflows',
                    'Audit logs & compliance',
                    'Custom team role permissions',
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        Schema::create('workspace_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('plans')->restrictOnDelete();
            $table->string('status', 32)->default('active'); // active, canceled, expired, past_due
            $table->timestamp('started_at');
            $table->timestamp('current_period_starts_at');
            $table->timestamp('current_period_ends_at');
            $table->timestamp('cancelled_at')->nullable();
            $table->string('assignment_source', 64)->default('system_free'); // system_free, admin_override, checkout
            // Gateway preparation columns
            $table->string('gateway_name', 64)->nullable();
            $table->string('gateway_subscription_id', 128)->nullable();
            $table->string('gateway_customer_id', 128)->nullable();
            $table->timestamps();

            $table->index(['workspace_id', 'status']);
        });

        // Safely backfill existing workspaces with the Free Plan
        $freePlanId = DB::table('plans')->where('slug', 'free')->value('id');
        if ($freePlanId) {
            $workspaces = DB::table('workspaces')->pluck('id');
            foreach ($workspaces as $wsId) {
                DB::table('workspace_subscriptions')->insertOrIgnore([
                    'workspace_id' => $wsId,
                    'plan_id' => $freePlanId,
                    'status' => 'active',
                    'started_at' => $now,
                    'current_period_starts_at' => $now,
                    'current_period_ends_at' => $now->copy()->addMonth(),
                    'assignment_source' => 'system_free',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workspace_subscriptions');
        Schema::dropIfExists('plans');
    }
};
