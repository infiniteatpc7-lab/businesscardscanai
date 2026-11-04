<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\PlatformAuditLog;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Services\BulkCardSaveService;
use App\Services\ScanQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SubscriptionAndQuotaTest extends TestCase
{
    use RefreshDatabase;

    private function createCustomerWithWorkspace(string $email = 'user@example.com'): array
    {
        $user = User::create([
            'name' => 'Test User',
            'email' => $email,
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Acme Corp',
            'slug' => 'acme-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $tokenResult = ApiToken::createTokenForUser($user);

        $exhibition = Exhibition::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'name' => 'CES 2026',
            'status' => 'active',
        ]);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
            'exhibition' => $exhibition,
        ];
    }

    private function createPlatformAdmin(): array
    {
        $admin = PlatformAdmin::create([
            'name' => 'Platform Super Admin',
            'email' => 'admin_'.uniqid().'@businesscardscan.ai',
            'password' => Hash::make('SecretAdmin123!'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin);

        return [
            'admin' => $admin,
            'token' => $tokenResult['token'],
        ];
    }

    public function test_workspace_creation_automatically_assigns_free_plan(): void
    {
        $user = User::create([
            'name' => 'Auto Free User',
            'email' => 'autofree@example.com',
            'password' => Hash::make('password123'),
        ]);

        $workspace = Workspace::create([
            'name' => 'StartUp Workspace',
            'slug' => 'startup-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $subscription = $workspace->activeSubscription();

        $this->assertNotNull($subscription);
        $this->assertEquals('active', $subscription->status);
        $this->assertEquals('free', $subscription->plan->slug);
        $this->assertEquals(50, $subscription->plan->monthly_scan_allowance);
        $this->assertEquals('system_free', $subscription->assignment_source);
        $this->assertEquals('INR', $subscription->plan->currency);
    }

    public function test_inr_currency_defaults_and_formatting(): void
    {
        $data = $this->createCustomerWithWorkspace();

        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->getJson('/api/subscription/current');

        $response->assertOk()
            ->assertJsonPath('currency', 'INR')
            ->assertJsonPath('currency_symbol', '₹')
            ->assertJsonPath('plan.currency', 'INR')
            ->assertJsonPath('plan.currency_symbol', '₹')
            ->assertJsonPath('plan.formatted_price', '₹0.00');
    }

    public function test_shared_workspace_quota_across_members(): void
    {
        $data = $this->createCustomerWithWorkspace('owner@example.com');
        $workspace = $data['workspace'];

        // Add a second team member
        $member = User::create([
            'name' => 'Team Member',
            'email' => 'member@example.com',
            'password' => Hash::make('password123'),
        ]);
        $workspace->users()->attach($member->id, ['role' => 'member']);
        $member->update(['current_workspace_id' => $workspace->id]);
        $memberToken = ApiToken::createTokenForUser($member)['plain_token'];

        $quotaService = app(ScanQuotaService::class);
        $initialQuota = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(50, $initialQuota['remaining']);

        // Member records a scan
        $quotaService->recordSuccessfulScan(
            $workspace,
            $member,
            'single_scan',
            'member_scan_1'
        );

        // Check quota from owner's perspective
        $ownerQuota = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $ownerQuota['used']);
        $this->assertEquals(49, $ownerQuota['remaining']);

        // Check via customer subscription endpoint as member
        $response = $this->withHeader('Authorization', "Bearer {$memberToken}")
            ->getJson('/api/subscription/current');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('plan.slug', 'free')
            ->assertJsonPath('quota.used', 1)
            ->assertJsonPath('quota.remaining', 49);
    }

    public function test_customer_subscription_current_api_returns_quota_breakdown(): void
    {
        $data = $this->createCustomerWithWorkspace();

        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->getJson('/api/subscription/current');

        $response->assertOk()
            ->assertJsonStructure([
                'success',
                'currency',
                'currency_symbol',
                'subscription' => [
                    'id',
                    'status',
                    'assignment_source',
                    'billing_period_starts_at',
                    'billing_period_ends_at',
                ],
                'plan' => [
                    'id',
                    'name',
                    'slug',
                    'price',
                    'currency',
                    'monthly_scan_allowance',
                    'max_team_members',
                    'max_workspaces',
                    'max_active_exhibitions',
                    'features',
                    'entitlements',
                ],
                'quota' => [
                    'allowance',
                    'used',
                    'reserved',
                    'remaining',
                ],
            ])
            ->assertJsonPath('quota.allowance', 50)
            ->assertJsonPath('quota.used', 0)
            ->assertJsonPath('quota.remaining', 50);
    }

    public function test_successful_card_store_deducts_one_credit(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $scanKey = 'scan_test_'.Str::uuid();

        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/cards', [
                'name' => 'Alice Johnson',
                'company' => 'Starlight Media',
                'phone' => ['+15551234567'],
                'email' => 'alice@starlight.com',
                'exhibition_id' => $data['exhibition']->id,
                'scan_idempotency_key' => $scanKey,
            ]);

        $response->assertCreated();

        $ledger = ScanUsageLedger::where('idempotency_key', $scanKey)->first();
        $this->assertNotNull($ledger);
        $this->assertEquals('confirmed', $ledger->status);
        $this->assertEquals(1, $ledger->quantity);
        $this->assertEquals($data['workspace']->id, $ledger->workspace_id);
        $this->assertNotNull($ledger->card_id);
        $this->assertNotNull($ledger->card_scan_id);

        $quotaService = app(ScanQuotaService::class);
        $quota = $quotaService->getWorkspaceQuota($data['workspace']);
        $this->assertEquals(1, $quota['used']);
        $this->assertEquals(49, $quota['remaining']);
    }

    public function test_retry_idempotency_does_not_double_deduct(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $scanKey = 'idempotent_test_'.Str::uuid();
        $quotaService = app(ScanQuotaService::class);

        // First save
        $ledger1 = $quotaService->recordSuccessfulScan(
            $data['workspace'],
            $data['user'],
            'single_scan',
            $scanKey
        );
        $this->assertEquals('confirmed', $ledger1->status);

        // Retry with same idempotency key
        $ledger2 = $quotaService->recordSuccessfulScan(
            $data['workspace'],
            $data['user'],
            'single_scan',
            $scanKey
        );

        $this->assertEquals($ledger1->id, $ledger2->id);

        // Confirm only 1 credit was consumed
        $quota = $quotaService->getWorkspaceQuota($data['workspace']);
        $this->assertEquals(1, $quota['used']);
        $this->assertEquals(49, $quota['remaining']);
        $this->assertEquals(1, ScanUsageLedger::where('idempotency_key', $scanKey)->count());
    }

    public function test_failed_scan_reservation_is_released(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $quotaService = app(ScanQuotaService::class);
        $scanKey = 'failed_scan_'.Str::uuid();

        // 1. Quota reserved before OCR
        $reservation = $quotaService->reserveQuota(
            $data['workspace'],
            $data['user'],
            'single_scan',
            $scanKey
        );
        $this->assertEquals('reserved', $reservation->status);

        $quotaAfterReserve = $quotaService->getWorkspaceQuota($data['workspace']);
        $this->assertEquals(1, $quotaAfterReserve['reserved']);
        $this->assertEquals(49, $quotaAfterReserve['remaining']);

        // 2. OCR fails -> release reservation
        $released = $quotaService->releaseReservation($scanKey, 'OCR network timeout');
        $this->assertEquals('released', $released->status);

        $quotaAfterRelease = $quotaService->getWorkspaceQuota($data['workspace']);
        $this->assertEquals(0, $quotaAfterRelease['reserved']);
        $this->assertEquals(0, $quotaAfterRelease['used']);
        $this->assertEquals(50, $quotaAfterRelease['remaining']);
    }

    public function test_linking_contact_to_another_exhibition_consumes_one_credit(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Existing card in exhibition 1
        $card = Card::create([
            'workspace_id' => $workspace->id,
            'user_id' => $data['user']->id,
            'name' => 'Original Contact',
            'company' => 'Acme Inc',
        ]);
        $card->exhibitions()->attach($data['exhibition']->id);

        // Exhibition 2
        $exhibition2 = Exhibition::create([
            'workspace_id' => $workspace->id,
            'user_id' => $data['user']->id,
            'name' => 'Gitex 2026',
            'status' => 'active',
        ]);

        $linkKey = 'link_test_'.Str::uuid();

        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/cards', [
                'link_existing_card_id' => $card->id,
                'exhibition_id' => $exhibition2->id,
                'scan_idempotency_key' => $linkKey,
            ]);

        $response->assertOk();

        $ledger = ScanUsageLedger::where('idempotency_key', $linkKey)->first();
        $this->assertNotNull($ledger);
        $this->assertEquals('confirmed', $ledger->status);
        $this->assertEquals('link_existing_contact', $ledger->operation_type);

        $quota = app(ScanQuotaService::class)->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $quota['used']);
    }

    public function test_quota_exhaustion_blocks_further_scanning(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Create a restricted plan with allowance of 1 scan
        $microPlan = Plan::create([
            'name' => 'Micro 1',
            'slug' => 'micro-1-'.uniqid(),
            'price' => 0,
            'currency' => 'INR',
            'monthly_scan_allowance' => 1,
            'max_team_members' => 1,
            'max_workspaces' => 1,
            'max_active_exhibitions' => 1,
            'is_active' => true,
        ]);

        $workspace->activeSubscription()->update([
            'plan_id' => $microPlan->id,
        ]);

        $quotaService = app(ScanQuotaService::class);

        // 1st scan consumes the only credit
        $quotaService->recordSuccessfulScan(
            $workspace,
            $data['user'],
            'single_scan',
            'first_scan'
        );

        $quota = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $quota['used']);
        $this->assertEquals(0, $quota['remaining']);

        // 2nd scan attempt should fail with 403 QUOTA_EXCEEDED
        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/cards', [
                'name' => 'Blocked Card',
                'company' => 'Too Late LLC',
                'exhibition_id' => $data['exhibition']->id,
            ]);

        $response->assertStatus(403)
            ->assertJsonPath('error_code', 'QUOTA_EXCEEDED')
            ->assertJsonPath('quota.allowance', 1)
            ->assertJsonPath('quota.used', 1)
            ->assertJsonPath('quota.remaining', 0);
    }

    public function test_bulk_import_gated_by_plan_entitlement(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Free plan does not have bulk_import
        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/bulk-imports', [
                'exhibition_id' => $data['exhibition']->id,
            ]);

        $response->assertStatus(403)
            ->assertJsonPath('error_code', 'FEATURE_NOT_INCLUDED')
            ->assertJsonPath('feature', 'bulk_import');

        // Upgrade to Pro which includes bulk_import
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();
        $workspace->activeSubscription()->update(['plan_id' => $proPlan->id]);

        $successResponse = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/bulk-imports', [
                'exhibition_id' => $data['exhibition']->id,
                'expected_count' => 5,
            ]);

        $successResponse->assertCreated()
            ->assertJsonPath('success', true);
    }

    public function test_export_csv_gated_by_plan_entitlement(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Create a card
        Card::create([
            'workspace_id' => $workspace->id,
            'user_id' => $data['user']->id,
            'name' => 'Lead to Export',
            'company' => 'Exporter LLC',
        ]);

        // Default Free plan has export_csv enabled
        $response = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->get('/api/cards/export');

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));

        // Switch to a plan without export_csv
        $restrictedPlan = Plan::create([
            'name' => 'No Export Plan',
            'slug' => 'no-export-'.uniqid(),
            'price' => 0,
            'currency' => 'INR',
            'monthly_scan_allowance' => 50,
            'max_team_members' => 1,
            'max_workspaces' => 1,
            'max_active_exhibitions' => 1,
            'features' => ['single_card_scan'],
            'is_active' => true,
        ]);

        $workspace->activeSubscription()->update(['plan_id' => $restrictedPlan->id]);

        $forbiddenResponse = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->getJson('/api/cards/export');

        $forbiddenResponse->assertStatus(403)
            ->assertJsonPath('error_code', 'FEATURE_NOT_INCLUDED')
            ->assertJsonPath('feature', 'export_csv');
    }

    public function test_team_member_limit_enforcement(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Plan with max_team_members = 1 (only the owner)
        $soloPlan = Plan::create([
            'name' => 'Solo',
            'slug' => 'solo-'.uniqid(),
            'price' => 0,
            'currency' => 'INR',
            'monthly_scan_allowance' => 50,
            'max_team_members' => 1,
            'max_workspaces' => 1,
            'max_active_exhibitions' => 1,
            'is_active' => true,
        ]);
        $workspace->activeSubscription()->update(['plan_id' => $soloPlan->id]);

        $inviteRes = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson("/api/workspaces/{$workspace->id}/invitations", [
                'email' => 'colleague@example.com',
                'role' => 'member',
            ]);

        $inviteRes->assertStatus(403)
            ->assertJsonPath('error_code', 'PLAN_LIMIT_EXCEEDED')
            ->assertJsonPath('limit', 'max_team_members');
    }

    public function test_workspace_creation_limit_enforcement(): void
    {
        $data = $this->createCustomerWithWorkspace();

        // Default Free plan has max_workspaces = 1. Owner already owns 1 workspace.
        $createWsRes = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/workspaces', [
                'name' => 'Second Workspace',
            ]);

        $createWsRes->assertStatus(403)
            ->assertJsonPath('error_code', 'PLAN_LIMIT_EXCEEDED')
            ->assertJsonPath('limit', 'max_workspaces');
    }

    public function test_active_exhibitions_limit_enforcement(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Free plan has max_active_exhibitions = 1. Workspace already has 1 active exhibition (CES 2026).
        $createExpoRes = $this->withHeader('Authorization', "Bearer {$data['token']}")
            ->postJson('/api/exhibitions', [
                'name' => 'Second Active Expo',
                'status' => 'active',
            ]);

        $createExpoRes->assertStatus(403)
            ->assertJsonPath('error_code', 'PLAN_LIMIT_EXCEEDED')
            ->assertJsonPath('limit', 'max_active_exhibitions');
    }

    public function test_bulk_import_per_item_accounting_and_skipped_zero_deduction(): void
    {
        Storage::fake('local');
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];
        $user = $data['user'];

        $batchUuid = (string) Str::uuid();
        $batch = BulkImport::create([
            'batch_uuid' => $batchUuid,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'exhibition_id' => $data['exhibition']->id,
            'status' => 'reviewing',
            'total_items' => 2,
        ]);

        $stagingFile1 = "bulk_staging/{$batchUuid}/front1.jpg";
        Storage::disk('local')->put($stagingFile1, 'fake-card-image-bytes-1');

        // Item 1: Valid card details
        $item1 = BulkImportItem::create([
            'client_item_id' => (string) Str::uuid(),
            'bulk_import_id' => $batch->id,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'front_image_path' => $stagingFile1,
            'extracted_data' => [
                'name' => 'Bulk Person 1',
                'company' => 'Big Corp',
                'phone' => ['+1111111111'],
            ],
            'status' => 'extracted',
        ]);

        // Item 2: Blank / No details -> must be skipped with 0 credits consumed
        $item2 = BulkImportItem::create([
            'client_item_id' => (string) Str::uuid(),
            'bulk_import_id' => $batch->id,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'front_image_path' => 'bulk_staging/blank.jpg',
            'extracted_data' => [],
            'status' => 'extracted',
        ]);

        $saveService = app(BulkCardSaveService::class);

        // Commit item 1
        $res1 = $saveService->commitItem($item1, [], $user);
        $this->assertTrue($res1['success']);
        $this->assertFalse($res1['skipped'] ?? false);

        // Commit item 2
        $res2 = $saveService->commitItem($item2, [], $user);
        $this->assertTrue($res2['success']);
        $this->assertTrue($res2['skipped'] ?? false);

        // Verify ledger: exactly 1 confirmed deduction for item 1, 0 for item 2
        $quota = app(ScanQuotaService::class)->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $quota['used']);
        $this->assertEquals(49, $quota['remaining']);

        $this->assertEquals(1, ScanUsageLedger::where('workspace_id', $workspace->id)->where('status', 'confirmed')->count());
        $this->assertEquals(0, ScanUsageLedger::where('bulk_import_item_id', $item2->id)->count());
    }

    public function test_platform_admin_can_manage_plans_in_inr(): void
    {
        $adminData = $this->createPlatformAdmin();

        // 1. List plans
        $listRes = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->getJson('/api/platform-admin/plans');
        $listRes->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('currency', 'INR');

        // 2. Create custom plan
        $createRes = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson('/api/platform-admin/plans', [
                'name' => 'Enterprise Custom',
                'slug' => 'enterprise-custom-'.uniqid(),
                'description' => 'Custom enterprise plan for large exhibitors',
                'price' => 4999.00,
                'currency' => 'INR',
                'invoice_interval' => 'month',
                'monthly_scan_allowance' => 10000,
                'max_team_members' => 50,
                'max_workspaces' => 10,
                'max_active_exhibitions' => 20,
                'features' => ['single_card_scan', 'high_accuracy_ocr', 'priority_support', 'bulk_import'],
                'is_active' => true,
            ]);

        $createRes->assertCreated()->assertJsonPath('success', true);
        $planId = $createRes->json('plan.id');
        $this->assertEquals('INR', $createRes->json('plan.currency'));
        $this->assertEquals(4999.00, $createRes->json('plan.price'));

        // Verify audit log for plan creation
        $this->assertTrue(PlatformAuditLog::where('action', 'plan.create')->exists());

        // 3. Update plan
        $updateRes = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->putJson("/api/platform-admin/plans/{$planId}", [
                'name' => 'Enterprise Updated',
                'price' => 5999.00,
                'monthly_scan_allowance' => 15000,
                'max_team_members' => 100,
                'max_workspaces' => 20,
                'max_active_exhibitions' => 30,
                'features' => ['single_card_scan', 'high_accuracy_ocr', 'priority_support', 'bulk_import', 'export_excel'],
            ]);
        $updateRes->assertOk()
            ->assertJsonPath('plan.name', 'Enterprise Updated');
        $this->assertEquals(5999.00, $updateRes->json('plan.price'));

        // 4. Toggle plan status
        $toggleRes = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/plans/{$planId}/toggle-status");
        $toggleRes->assertOk()->assertJsonPath('plan.is_active', false);
    }

    public function test_platform_admin_can_change_workspace_plan(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $adminData = $this->createPlatformAdmin();
        $workspace = $customerData['workspace'];

        // Get Pro Plan
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        $response = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Customer requested upgrade to Pro',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('plan.slug', 'pro')
            ->assertJsonPath('quota.allowance', 500);

        // Verify database state
        $this->assertEquals($proPlan->id, $workspace->fresh()->activeSubscription()->plan_id);

        // Verify audit log
        $this->assertTrue(PlatformAuditLog::where('action', 'workspace.plan_change')
            ->where('target_id', $workspace->id)
            ->exists());
    }

    public function test_mid_cycle_allowance_change_safety(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $quotaService = app(ScanQuotaService::class);

        // Consume 5 credits under Free plan (50 credits allowance)
        for ($i = 0; $i < 5; $i++) {
            $quotaService->recordSuccessfulScan(
                $workspace,
                $customerData['user'],
                'single_scan',
                "cycle_test_{$i}"
            );
        }

        $quotaBefore = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(5, $quotaBefore['used']);
        $this->assertEquals(45, $quotaBefore['remaining']);

        // Mid-cycle upgrade to Pro (500 credits)
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();
        $workspace->activeSubscription()->update(['plan_id' => $proPlan->id]);

        $quotaAfter = $quotaService->getWorkspaceQuota($workspace->fresh());
        $this->assertEquals(5, $quotaAfter['used']);
        $this->assertEquals(495, $quotaAfter['remaining']);
        $this->assertEquals(500, $quotaAfter['allowance']);

        // Historical records preserved
        $this->assertEquals(5, ScanUsageLedger::where('workspace_id', $workspace->id)->where('status', 'confirmed')->count());
    }

    public function test_customer_cannot_access_platform_admin_plan_routes(): void
    {
        $customerData = $this->createCustomerWithWorkspace();

        $response = $this->withHeader('Authorization', "Bearer {$customerData['token']}")
            ->getJson('/api/platform-admin/plans');

        $response->assertStatus(401);
    }
}
