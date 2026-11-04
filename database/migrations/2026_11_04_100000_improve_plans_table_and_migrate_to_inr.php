<?php

use App\Models\Plan;
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
        Schema::table('plans', function (Blueprint $table) {
            $table->integer('max_team_members')->default(1)->after('monthly_scan_allowance');
            $table->integer('max_workspaces')->default(1)->after('max_team_members');
            $table->integer('max_active_exhibitions')->default(1)->after('max_workspaces');
        });

        // Explicit, safe currency & limits configuration strategy
        // Free: ₹0, Pro: ₹999/mo, Business: ₹2,999/mo
        $now = now();

        // 1. Update Free plan
        DB::table('plans')->where('slug', 'free')->update([
            'currency' => 'INR',
            'price' => 0.00,
            'monthly_scan_allowance' => 50,
            'max_team_members' => 2,
            'max_workspaces' => 1,
            'max_active_exhibitions' => 1,
            'is_default' => true,
            'features' => json_encode([
                'single_card_scan',
                'auto_crop_enhancement',
                'contact_notes_history',
                'shared_workspace',
                'export_csv',
                'community_support',
            ]),
            'updated_at' => $now,
        ]);

        // 2. Update Pro plan
        DB::table('plans')->where('slug', 'pro')->update([
            'currency' => 'INR',
            'price' => 999.00,
            'monthly_scan_allowance' => 500,
            'max_team_members' => 10,
            'max_workspaces' => 3,
            'max_active_exhibitions' => 5,
            'is_default' => false,
            'features' => json_encode([
                'single_card_scan',
                'high_accuracy_ocr',
                'auto_crop_enhancement',
                'reverse_card_scan',
                'contact_enrichment',
                'duplicate_detection',
                'contact_notes_history',
                'custom_tags',
                'exhibition_tracking',
                'multi_exhibition_link',
                'shared_workspace',
                'member_privacy',
                'role_permissions',
                'bulk_import',
                'export_csv',
                'export_excel',
                'priority_support',
            ]),
            'updated_at' => $now,
        ]);

        // 3. Update Business plan
        DB::table('plans')->where('slug', 'business')->update([
            'currency' => 'INR',
            'price' => 2999.00,
            'monthly_scan_allowance' => 2500,
            'max_team_members' => -1, // Unlimited
            'max_workspaces' => -1,    // Unlimited
            'max_active_exhibitions' => -1, // Unlimited
            'is_default' => false,
            'features' => json_encode([
                'single_card_scan',
                'high_accuracy_ocr',
                'auto_crop_enhancement',
                'reverse_card_scan',
                'contact_enrichment',
                'duplicate_detection',
                'contact_notes_history',
                'custom_tags',
                'exhibition_tracking',
                'multi_exhibition_link',
                'exhibition_analytics',
                'shared_workspace',
                'member_privacy',
                'role_permissions',
                'audit_logging',
                'bulk_import',
                'export_csv',
                'export_excel',
                'api_access',
                'community_support',
                'priority_support',
                'dedicated_account_manager',
            ]),
            'updated_at' => $now,
        ]);

        // 4. Any remaining plans with USD set to INR
        DB::table('plans')->where('currency', 'USD')->update([
            'currency' => 'INR',
            'updated_at' => $now,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['max_team_members', 'max_workspaces', 'max_active_exhibitions']);
        });
    }
};
