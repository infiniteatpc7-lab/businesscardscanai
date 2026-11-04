<?php

namespace Tests\Feature;

use App\Exceptions\QuotaExceededException;
use App\Models\ApiToken;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use App\Services\BulkCardSaveService;
use App\Services\ScanQuotaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class ScanCreditCountingAndQuotaFlowTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUserWithFiveCreditPlan(string $email = 'saunak@example.com'): array
    {
        $user = User::create([
            'name' => 'Saunak Patel',
            'email' => $email,
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Ceramix Workspace',
            'slug' => 'ceramix-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $tokenResult = ApiToken::createTokenForUser($user);

        // Ensure a 5-credit plan exists and is assigned
        $freePlan = Plan::firstOrCreate(
            ['slug' => 'free-five'],
            [
                'name' => 'Free 5 Plan',
                'price' => 0.00,
                'monthly_scan_allowance' => 5,
                'features' => ['single_card_scan'],
                'is_active' => true,
            ]
        );

        $subscription = WorkspaceSubscription::updateOrCreate(
            ['workspace_id' => $workspace->id],
            [
                'plan_id' => $freePlan->id,
                'status' => 'active',
                'started_at' => now(),
                'current_period_starts_at' => now()->startOfMonth(),
                'current_period_ends_at' => now()->endOfMonth(),
            ]
        );

        $exhibition = Exhibition::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'name' => 'Morbi Ceramic Expo 2026',
            'status' => 'active',
        ]);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
            'exhibition' => $exhibition,
            'plan' => $freePlan,
            'subscription' => $subscription,
        ];
    }

    /**
     * Test 1: Five successful saves consume exactly five credits.
     */
    public function test_01_five_successful_saves_consume_exactly_five_credits(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test1@example.com');
        $quotaService = app(ScanQuotaService::class);

        for ($i = 1; $i <= 5; $i++) {
            $scanKey = 'scan_test1_'.$i.'_'.uniqid();

            // Reserve during scan
            $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

            // Save card via API
            $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
                ->postJson('/api/cards', [
                    'company' => "Company {$i}",
                    'name' => "Contact {$i}",
                    'phone' => ["+91987654321{$i}"],
                    'email' => "contact{$i}@example.com",
                    'exhibition_id' => $setup['exhibition']->id,
                    'scan_idempotency_key' => $scanKey,
                ]);

            $response->assertStatus(201)
                ->assertJson(['success' => true]);
        }

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(5, $quota['used_credits']);
        $this->assertEquals(0, $quota['remaining_credits']);
        $this->assertEquals(0, $quota['reserved_credits']);
        $this->assertTrue($quota['is_exhausted']);
    }

    /**
     * Test 2: Five scan attempts with only three successful saves consume three credits.
     */
    public function test_02_five_scan_attempts_with_only_three_successful_saves_consume_three_credits(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test2@example.com');
        $quotaService = app(ScanQuotaService::class);

        // 3 successful scans and saves
        for ($i = 1; $i <= 3; $i++) {
            $scanKey = 'scan_test2_success_'.$i;
            $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

            $this->withHeader('Authorization', 'Bearer '.$setup['token'])
                ->postJson('/api/cards', [
                    'name' => "Person {$i}",
                    'phone' => ["+9191111222{$i}"],
                    'exhibition_id' => $setup['exhibition']->id,
                    'scan_idempotency_key' => $scanKey,
                ])
                ->assertStatus(201);
        }

        // 2 scan attempts that fail/are abandoned
        for ($i = 4; $i <= 5; $i++) {
            $scanKey = 'scan_test2_failed_'.$i;
            $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

            // Released because extraction failed or user abandoned
            $quotaService->releaseReservation($scanKey, 'gemini_extraction_failure');
        }

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(3, $quota['used_credits']);
        $this->assertEquals(2, $quota['remaining_credits']);
        $this->assertEquals(0, $quota['reserved_credits']);
    }

    /**
     * Test 3: Failed extraction does not consume a credit.
     */
    public function test_03_failed_extraction_does_not_consume_a_credit(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test3@example.com');
        $quotaService = app(ScanQuotaService::class);

        $scanKey = 'scan_fail_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        // Simulate extraction failure releasing reservation
        $quotaService->releaseReservation($scanKey, 'gemini_extraction_failure');

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $quota['used_credits']);
        $this->assertEquals(5, $quota['remaining_credits']);
        $this->assertEquals(0, $quota['reserved_credits']);
    }

    /**
     * Test 4: Abandoned review releases its reservation.
     */
    public function test_04_abandoned_review_releases_its_reservation(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test4@example.com');
        $quotaService = app(ScanQuotaService::class);

        $scanKey = 'scan_abandon_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        // Verify credit is in reserved status
        $quotaBefore = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(1, $quotaBefore['reserved_credits']);
        $this->assertEquals(4, $quotaBefore['remaining_credits']);

        // User abandons review via API
        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/scan/release', [
                'scan_idempotency_key' => $scanKey,
                'reason' => 'user_reset',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true, 'released' => true]);

        $quotaAfter = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $quotaAfter['used_credits']);
        $this->assertEquals(0, $quotaAfter['reserved_credits']);
        $this->assertEquals(5, $quotaAfter['remaining_credits']);
    }

    /**
     * Test 5: Duplicate detection without save does not consume a credit.
     */
    public function test_05_duplicate_detection_without_save_does_not_consume_a_credit(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test5@example.com');
        $quotaService = app(ScanQuotaService::class);

        // Create an existing card in the directory
        Card::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'name' => 'Existing Contact',
            'phone' => ['+919999988888'],
            'company' => 'Original Corp',
        ]);

        $scanKey = 'scan_dup_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        // Attempt to save duplicate without force_duplicate
        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/cards', [
                'name' => 'Duplicate Contact',
                'phone' => ['+919999988888'],
                'company' => 'Original Corp',
                'exhibition_id' => $setup['exhibition']->id,
                'scan_idempotency_key' => $scanKey,
            ]);

        // Duplicate warning returned (409)
        $response->assertStatus(409)
            ->assertJson(['duplicate' => true]);

        // User does not proceed, releases reservation
        $quotaService->releaseReservation($scanKey, 'duplicate_cancelled');

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $quota['used_credits']);
        $this->assertEquals(5, $quota['remaining_credits']);
    }

    /**
     * Test 6: Duplicate contact linked to another exhibition consumes one credit.
     */
    public function test_06_duplicate_contact_linked_to_another_exhibition_consumes_one_credit(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test6@example.com');
        $quotaService = app(ScanQuotaService::class);

        $existingCard = Card::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'name' => 'Linkable Contact',
            'phone' => ['+919777766666'],
            'company' => 'Ceramic World',
        ]);

        $scanKey = 'scan_link_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        // Link existing contact to exhibition
        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/cards', [
                'link_existing_card_id' => $existingCard->id,
                'exhibition_id' => $setup['exhibition']->id,
                'scan_idempotency_key' => $scanKey,
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true, 'linked' => true]);

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(1, $quota['used_credits']);
        $this->assertEquals(4, $quota['remaining_credits']);
    }

    /**
     * Test 7: Retrying the same scan does not double-charge.
     */
    public function test_07_retrying_the_same_scan_does_not_double_charge(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test7@example.com');
        $quotaService = app(ScanQuotaService::class);

        $scanKey = 'scan_retry_key_123';

        // Initial attempt reserves
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        // Retry with same key returns existing reservation without double reserving
        $retryReservation = $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);
        $this->assertEquals('reserved', $retryReservation->status);

        // Save card
        $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/cards', [
                'name' => 'Retry Card',
                'phone' => ['+919555544444'],
                'exhibition_id' => $setup['exhibition']->id,
                'scan_idempotency_key' => $scanKey,
            ])
            ->assertStatus(201);

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(1, $quota['used_credits']);
        $this->assertEquals(4, $quota['remaining_credits']);
    }

    /**
     * Test 8: Double-click/repeated save requests do not double-charge.
     */
    public function test_08_double_click_repeated_save_requests_do_not_double_charge(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test8@example.com');
        $quotaService = app(ScanQuotaService::class);

        $scanKey = 'scan_double_click_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        $cardPayload = [
            'name' => 'Rapid Clicker',
            'phone' => ['+919444433333'],
            'exhibition_id' => $setup['exhibition']->id,
            'scan_idempotency_key' => $scanKey,
        ];

        // Click 1
        $res1 = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/cards', $cardPayload);
        $res1->assertStatus(201);

        // Click 2 (rapid duplicate save request with same scan_idempotency_key)
        $res2 = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/cards', $cardPayload);
        $res2->assertSuccessful()
            ->assertJson(['success' => true]);

        // Must still be exactly 1 credit consumed
        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(1, $quota['used_credits']);
        $this->assertEquals(4, $quota['remaining_credits']);
    }

    /**
     * Test 9: Two concurrent reservations cannot exceed available quota.
     */
    public function test_09_two_concurrent_reservations_cannot_exceed_available_quota(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test9@example.com');
        $quotaService = app(ScanQuotaService::class);

        // Use 3 credits first
        for ($i = 1; $i <= 3; $i++) {
            $key = "initial_use_{$i}";
            $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $key);
            $quotaService->confirmDeduction($key);
        }

        // Remaining available = 2
        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(2, $quota['remaining_credits']);

        // Concurrently reserve 2 scans (both are in progress)
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'concurrent_scan_1');
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'concurrent_scan_2');

        // Remaining available is now 0
        $quotaMid = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $quotaMid['remaining_credits']);
        $this->assertEquals(2, $quotaMid['reserved_credits']);

        // Attempting a 3rd reservation exceeds quota and throws QuotaExceededException
        $this->expectException(QuotaExceededException::class);
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'concurrent_scan_3');
    }

    /**
     * Test 10: Failed bulk items do not consume credits.
     */
    public function test_10_failed_bulk_items_do_not_consume_credits(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test10@example.com');
        $quotaService = app(ScanQuotaService::class);

        $bulkImport = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => $setup['exhibition']->id,
            'batch_uuid' => Str::uuid()->toString(),
            'status' => 'processing',
        ]);

        $failedItem = BulkImportItem::create([
            'bulk_import_id' => $bulkImport->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'front_image_path' => 'bulk_imports/failed.jpg',
            'client_item_id' => 'item-fail-1',
            'sequence_order' => 1,
            'status' => 'failed',
            'error_message' => 'Image blur prevents text extraction',
        ]);

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $quota['used_credits']);
        $this->assertEquals(5, $quota['remaining_credits']);
    }

    /**
     * Test 11: Each successfully saved bulk item consumes one credit.
     */
    public function test_11_each_successfully_saved_bulk_item_consumes_one_credit(): void
    {
        Storage::fake('local');
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test11@example.com');
        $quotaService = app(ScanQuotaService::class);
        $bulkSaveService = app(BulkCardSaveService::class);

        $path1 = 'bulk_imports/card1.jpg';
        $path2 = 'bulk_imports/card2.jpg';
        Storage::disk('local')->put($path1, 'fake-image-content-1');
        Storage::disk('local')->put($path2, 'fake-image-content-2');

        $bulkImport = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => $setup['exhibition']->id,
            'batch_uuid' => Str::uuid()->toString(),
            'status' => 'ready_for_review',
        ]);

        $item1 = BulkImportItem::create([
            'bulk_import_id' => $bulkImport->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'front_image_path' => $path1,
            'client_item_id' => 'item-1',
            'sequence_order' => 1,
            'status' => 'ready',
            'name' => 'Bulk Person 1',
            'phone' => ['+919811111111'],
        ]);

        $item2 = BulkImportItem::create([
            'bulk_import_id' => $bulkImport->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'front_image_path' => $path2,
            'client_item_id' => 'item-2',
            'sequence_order' => 2,
            'status' => 'ready',
            'name' => 'Bulk Person 2',
            'phone' => ['+929822222222'],
        ]);

        // Commit item 1
        $res1 = $bulkSaveService->commitItem(
            $item1,
            ['decision' => 'create_new', 'name' => 'Bulk Person 1', 'phone' => ['+919811111111']],
            $setup['user']
        );
        $this->assertTrue($res1['success']);

        // Commit item 2
        $res2 = $bulkSaveService->commitItem(
            $item2,
            ['decision' => 'create_new', 'name' => 'Bulk Person 2', 'phone' => ['+929822222222']],
            $setup['user']
        );
        $this->assertTrue($res2['success']);

        $quota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(2, $quota['used_credits']);
        $this->assertEquals(3, $quota['remaining_credits']);
    }

    /**
     * Test 12: Quota popup appears before Gemini processing when no credit is available.
     */
    public function test_12_quota_popup_appears_before_gemini_processing_when_no_credit_is_available(): void
    {
        Storage::fake('local');
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test12@example.com');
        $quotaService = app(ScanQuotaService::class);

        // Exhaust all 5 credits
        for ($i = 1; $i <= 5; $i++) {
            $key = "exhaust_{$i}";
            $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $key);
            $quotaService->confirmDeduction($key);
        }

        // Quota check via subscription API
        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/current');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'quota' => [
                    'monthly_allowance' => 5,
                    'used_credits' => 5,
                    'remaining_credits' => 0,
                    'is_exhausted' => true,
                ],
            ]);

        // Scan attempt directly hits QuotaExceededException before AI processing
        $file = UploadedFile::fake()->image('card.jpg', 600, 400);
        $scanResponse = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->post('/api/scan', [
                'image' => $file,
            ]);

        $scanResponse->assertStatus(403)
            ->assertJson([
                'error_code' => 'QUOTA_EXCEEDED',
            ]);
    }

    /**
     * Test 13: Profile quota displays ledger-based values, not cardsCount.
     */
    public function test_13_profile_quota_displays_ledger_based_values_not_cards_count(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test13@example.com');
        $quotaService = app(ScanQuotaService::class);

        // Create 15 directory cards (e.g. from previous billing periods or imports)
        for ($i = 1; $i <= 15; $i++) {
            Card::create([
                'workspace_id' => $setup['workspace']->id,
                'user_id' => $setup['user']->id,
                'name' => "Archived Contact {$i}",
                'phone' => ["+9190000000{$i}"],
            ]);
        }

        $this->assertEquals(15, Card::where('workspace_id', $setup['workspace']->id)->count());

        // In current billing period, only 2 credits have been used, and 1 is currently processing/reserved
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'used_1');
        $quotaService->confirmDeduction('used_1');

        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'used_2');
        $quotaService->confirmDeduction('used_2');

        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', 'in_flight_reservation');

        // Check quota endpoint returned for profile view
        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/current');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'quota' => [
                    'monthly_allowance' => 5,
                    'used_credits' => 2,      // NOT 15 cardsCount!
                    'reserved_credits' => 1,
                    'remaining_credits' => 2,  // 5 - 2 - 1 = 2
                    'is_exhausted' => false,
                ],
            ]);
    }

    /**
     * Test 14: Released reservations restore available credits.
     */
    public function test_14_released_reservations_restore_available_credits(): void
    {
        $setup = $this->createWorkspaceUserWithFiveCreditPlan('test14@example.com');
        $quotaService = app(ScanQuotaService::class);

        $quotaInit = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(5, $quotaInit['remaining_credits']);

        // Start scan -> reservation held
        $scanKey = 'scan_release_restore_'.uniqid();
        $quotaService->reserveQuota($setup['workspace'], $setup['user'], 'single_scan', $scanKey);

        $quotaReserved = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(4, $quotaReserved['remaining_credits']);
        $this->assertEquals(1, $quotaReserved['reserved_credits']);

        // Scan fails or is discarded -> released
        $quotaService->releaseReservation($scanKey, 'discarded');

        $quotaRestored = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(5, $quotaRestored['remaining_credits']);
        $this->assertEquals(0, $quotaRestored['reserved_credits']);
    }
}
