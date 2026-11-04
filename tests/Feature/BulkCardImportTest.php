<?php

namespace Tests\Feature;

use App\Exceptions\PermanentExtractionException;
use App\Jobs\ProcessBulkImportItemJob;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\User;
use App\Models\Workspace;
use App\Services\BulkCardSaveService;
use App\Services\CardDuplicateDetector;
use App\Services\GeminiCardVisionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class BulkCardImportTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUser(string $name, string $email, string $role = 'owner', ?Workspace $existingWorkspace = null): array
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
        ]);

        if (! $existingWorkspace) {
            $workspace = Workspace::create([
                'name' => "{$name}'s Workspace",
                'slug' => "ws-{$user->id}-".uniqid(),
                'owner_id' => $role === 'owner' ? $user->id : null,
            ]);
        } else {
            $workspace = $existingWorkspace;
        }

        $workspace->users()->attach($user->id, ['role' => $role]);
        $user->forceFill(['current_workspace_id' => $workspace->id])->save();

        $proPlan = Plan::where('slug', 'pro')->first();
        if ($proPlan) {
            $workspace->activeSubscription()->update(['plan_id' => $proPlan->id]);
        }

        $tokenData = $user->createToken('test_token');

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenData['plain_token'],
            'token_model' => $tokenData['token_model'],
        ];
    }

    /**
     * 1. Verified Model Config: Uses verified project model configuration.
     */
    public function test_gemini_service_uses_verified_project_model_configuration(): void
    {
        $service = app(GeminiCardVisionService::class);
        $this->assertEquals(config('services.gemini.model', 'gemini-3.5-flash'), $service->getModel());
    }

    /**
     * 2. Upload Concurrency & Idempotency: Re-uploading same client_item_id is idempotent.
     */
    public function test_item_upload_is_idempotent_by_client_item_id(): void
    {
        Storage::fake('local');
        $member = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member');

        $exhibition = Exhibition::create([
            'workspace_id' => $member['workspace']->id,
            'created_by_user_id' => $member['user']->id,
            'name' => 'Auto Expo 2026',
            'status' => 'active',
        ]);

        $batchRes = $this->withHeaders(['Authorization' => 'Bearer '.$member['token']])
            ->postJson('/api/bulk-imports', [
                'exhibition_id' => $exhibition->id,
                'expected_count' => 10,
            ]);
        $batchRes->assertStatus(201);
        $uuid = $batchRes->json('batch.batch_uuid');

        $file = UploadedFile::fake()->image('card1.jpg', 600, 400);

        // Upload first time
        $res1 = $this->withHeaders(['Authorization' => 'Bearer '.$member['token']])
            ->postJson("/api/bulk-imports/{$uuid}/items", [
                'client_item_id' => 'item_uuid_101',
                'sequence_order' => 1,
                'image' => $file,
            ]);
        $res1->assertStatus(201);
        $this->assertEquals('item_uuid_101', $res1->json('item.client_item_id'));

        // Upload second time with identical client_item_id
        $res2 = $this->withHeaders(['Authorization' => 'Bearer '.$member['token']])
            ->postJson("/api/bulk-imports/{$uuid}/items", [
                'client_item_id' => 'item_uuid_101',
                'sequence_order' => 1,
                'image' => $file,
            ]);
        $res2->assertStatus(200);
        $this->assertTrue($res2->json('already_staged'));

        // Exactly 1 item in database
        $this->assertEquals(1, BulkImportItem::where('client_item_id', 'item_uuid_101')->count());
    }

    /**
     * 3. Cancellation Guard: Jobs exit cleanly without calling Gemini when batch is cancelled.
     */
    public function test_queued_job_aborts_immediately_if_batch_is_cancelled(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Tech Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'cancel-batch-123',
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-to-cancel',
            'status' => 'pending',
            'front_image_path' => 'bulk_staging/cancel-batch-123/dummy.jpg',
        ]);

        $mockVision = Mockery::mock(GeminiCardVisionService::class);
        $mockVision->shouldNotReceive('extractCardData');

        $job = new ProcessBulkImportItemJob($item->id);
        $job->handle($mockVision, app(CardDuplicateDetector::class));

        $item->refresh();
        $this->assertEquals('skipped', $item->status);
    }

    /**
     * 4. Failure Classification: Permanent errors fail immediately; transient errors retry.
     */
    public function test_permanent_ocr_failures_do_not_retry_while_transient_failures_do(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Pharma Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'fail-batch-123',
            'status' => 'processing',
        ]);

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-fail-test',
            'status' => 'pending',
            'front_image_path' => 'bulk_staging/fail-batch-123/unreadable.jpg',
        ]);

        // Permanent failure
        $mockVision = Mockery::mock(GeminiCardVisionService::class);
        $mockVision->shouldReceive('extractCardData')
            ->once()
            ->andThrow(new PermanentExtractionException('Image is corrupted or empty.'));

        $job = new ProcessBulkImportItemJob($item->id);
        $job->handle($mockVision, app(CardDuplicateDetector::class));

        $item->refresh();
        $this->assertEquals('failed', $item->status);
        $this->assertStringContainsString('Image is corrupted', $item->error_message);
    }

    /**
     * 5. Concurrent Duplicate Prevention: Race condition with simultaneous nonexistent contact.
     */
    public function test_concurrent_saves_of_same_contact_serialize_and_create_one_canonical_card(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Ceramics Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'concurrent-batch-1',
            'status' => 'processing',
        ]);

        $frontFile1 = 'bulk_staging/concurrent-batch-1/card1_front.jpg';
        $frontFile2 = 'bulk_staging/concurrent-batch-1/card2_front.jpg';
        Storage::disk('local')->put($frontFile1, 'fake-jpeg-content-1');
        Storage::disk('local')->put($frontFile2, 'fake-jpeg-content-2');

        $item1 = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-c1',
            'status' => 'extracted',
            'front_image_path' => $frontFile1,
            'extracted_data' => [
                'company' => 'Apex Ceramics',
                'name' => 'Vikas Roy',
                'phone' => ['9876543210'],
            ],
            'decision' => 'create_new',
        ]);

        $item2 = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-c2',
            'status' => 'extracted',
            'front_image_path' => $frontFile2,
            'extracted_data' => [
                'company' => 'Apex Ceramics',
                'name' => 'Vikas Roy',
                'phone' => ['9876543210'],
            ],
            'decision' => 'link_existing', // Links if duplicate found
        ]);

        $saveService = app(BulkCardSaveService::class);

        // Save item 1: creates canonical Card
        $res1 = $saveService->commitItem($item1, [], $owner['user']);
        $this->assertTrue($res1['success']);
        $this->assertFalse($res1['linked_existing']);

        // Save item 2: finds item 1's newly created Card in Phase 2 live check and links!
        $res2 = $saveService->commitItem($item2, [], $owner['user']);
        $this->assertTrue($res2['success']);
        $this->assertTrue($res2['linked_existing']);
        $this->assertEquals($res1['card_id'], $res2['card_id']);

        // Exactly 1 Card and 2 CardScans in workspace
        $this->assertEquals(1, Card::where('workspace_id', $owner['workspace']->id)->count());
        $this->assertEquals(2, CardScan::where('workspace_id', $owner['workspace']->id)->count());
    }

    /**
     * 6. Storage Separation: Staging images promoted to cards/ and staging cleanup preserves cards/.
     */
    public function test_saving_promotes_image_to_cards_and_staging_prune_preserves_card_images(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Medical Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'storage-test-batch',
            'status' => 'ready_for_review',
        ]);

        $stagingFile = 'bulk_staging/storage-test-batch/item1_front.jpg';
        Storage::disk('local')->put($stagingFile, 'fake-staging-image-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-promote-1',
            'status' => 'extracted',
            'front_image_path' => $stagingFile,
            'extracted_data' => [
                'company' => 'BioPharma',
                'name' => 'Dr. Patel',
                'phone' => ['9876543111'],
            ],
            'decision' => 'create_new',
        ]);

        $saveService = app(BulkCardSaveService::class);
        $res = $saveService->commitItem($item, [], $owner['user']);
        $this->assertTrue($res['success']);

        $savedCard = Card::find($res['card_id']);
        $this->assertNotNull($savedCard);
        $this->assertStringStartsWith('cards/', $savedCard->image_path);
        $this->assertTrue(Storage::disk('local')->exists($savedCard->image_path));

        // Staging file still exists until prune
        $this->assertTrue(Storage::disk('local')->exists($stagingFile));

        // Mark batch completed 25 hours ago to trigger staging prune
        BulkImport::where('id', $batch->id)->update([
            'status' => 'completed',
            'updated_at' => now()->subHours(25),
        ]);
        $this->artisan('bulk-import:prune-staging')->assertExitCode(0);

        // Staging directory deleted, but permanent cards/ image is safely preserved!
        $this->assertFalse(Storage::disk('local')->exists($stagingFile));
        $this->assertTrue(Storage::disk('local')->exists($savedCard->image_path));
    }

    /**
     * 7. Database Unique Scan Key: Retrying commit cannot create duplicate CardScan.
     */
    public function test_commit_cannot_create_duplicate_card_scan_due_to_unique_constraint(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Textile Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'idempotent-commit-batch',
            'status' => 'ready_for_review',
        ]);

        $stagingFile = 'bulk_staging/idempotent-commit-batch/item1_front.jpg';
        Storage::disk('local')->put($stagingFile, 'fake-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'client_item_id' => 'item-unique-scan',
            'status' => 'extracted',
            'front_image_path' => $stagingFile,
            'extracted_data' => [
                'company' => 'Surat Weaving',
                'name' => 'Kiran',
                'phone' => ['9876543222'],
            ],
            'decision' => 'create_new',
        ]);

        $saveService = app(BulkCardSaveService::class);

        // Commit 1
        $res1 = $saveService->commitItem($item, [], $owner['user']);
        $this->assertTrue($res1['success']);

        // Commit 2 (Simulating network retry)
        $res2 = $saveService->commitItem($item->fresh(), [], $owner['user']);
        $this->assertTrue($res2['success']);
        $this->assertTrue($res2['already_saved']);
        $this->assertEquals($res1['scan_id'], $res2['scan_id']);

        // Exactly 1 scan in database for this item
        $this->assertEquals(1, CardScan::where('bulk_import_item_id', $item->id)->count());
    }

    /**
     * 8. Attribution Preservation: Admin saving Member batch attributes scan to Member.
     */
    public function test_admin_saving_member_batch_preserves_member_scanner_attribution_and_visibility(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $admin = $this->createWorkspaceUser('Admin Vinay', 'admin@example.com', 'admin', $owner['workspace']);
        $member = $this->createWorkspaceUser('Staff Rahul', 'rahul@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Mega Expo',
            'status' => 'active',
        ]);

        // Member Rahul uploads a batch of cards
        $batch = BulkImport::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $member['user']->id, // Rahul is uploader
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => 'rahul-batch-1',
            'status' => 'ready_for_review',
        ]);

        $stagingFile = 'bulk_staging/rahul-batch-1/card_front.jpg';
        Storage::disk('local')->put($stagingFile, 'fake-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $member['user']->id,
            'client_item_id' => 'rahul-photo-1',
            'status' => 'extracted',
            'front_image_path' => $stagingFile,
            'extracted_data' => [
                'company' => 'Story House Rahul Scan',
                'name' => 'Mehul',
                'phone' => ['9876543999'],
            ],
            'decision' => 'create_new',
        ]);

        // Admin Vinay commits Rahul's batch
        $resCommit = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson("/api/bulk-imports/{$batch->batch_uuid}/commit", [
                'items' => [
                    ['id' => $item->id, 'decision' => 'create_new'],
                ],
            ]);
        $resCommit->assertStatus(200);

        // Verify attribution in CardScan
        $scan = CardScan::where('bulk_import_item_id', $item->id)->first();
        $this->assertNotNull($scan);
        $this->assertEquals($member['user']->id, $scan->user_id); // Attributed to Rahul!
        $this->assertEquals($admin['user']->id, $scan->saved_by_user_id); // Committed by Admin Vinay!

        // Member Rahul requests /api/cards: Rahul MUST see the card because scan.user_id = Rahul
        $resRahulCards = $this->withHeaders(['Authorization' => 'Bearer '.$member['token']])
            ->getJson('/api/cards');
        $resRahulCards->assertStatus(200);
        $this->assertTrue(collect($resRahulCards->json('cards'))->contains('company', 'Story House Rahul Scan'));
    }

    /**
     * 9. Workspace Isolation: Member cannot access or commit another workspace's batch.
     */
    public function test_workspace_isolation_strictly_enforced_on_all_bulk_endpoints(): void
    {
        $wsA = $this->createWorkspaceUser('User A', 'usera@example.com', 'owner');
        $wsB = $this->createWorkspaceUser('User B', 'userb@example.com', 'owner');

        $exA = Exhibition::create([
            'workspace_id' => $wsA['workspace']->id,
            'created_by_user_id' => $wsA['user']->id,
            'name' => 'Workspace A Expo',
            'status' => 'active',
        ]);

        $batchA = BulkImport::create([
            'workspace_id' => $wsA['workspace']->id,
            'user_id' => $wsA['user']->id,
            'exhibition_id' => $exA->id,
            'batch_uuid' => 'ws-a-batch-uuid',
            'status' => 'ready_for_review',
        ]);

        // User B attempts to access Workspace A's batch -> 404
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$wsB['token']])
            ->getJson("/api/bulk-imports/{$batchA->batch_uuid}");
        $res->assertStatus(404);

        // User B attempts to commit Workspace A's batch -> 404
        $resCommit = $this->withHeaders(['Authorization' => 'Bearer '.$wsB['token']])
            ->postJson("/api/bulk-imports/{$batchA->batch_uuid}/commit", ['items' => []]);
        $resCommit->assertStatus(404);
    }

    /**
     * 10. Strict Blank Card Guard: Failed or blank cards with no contact data are NEVER saved as Cards.
     */
    public function test_blank_or_failed_cards_without_contact_details_are_skipped_and_never_create_card_records(): void
    {
        Storage::fake('public');
        $ws = $this->createWorkspaceUser('Blank Guard Test', 'blankguard@example.com', 'owner');
        $ex = Exhibition::create([
            'workspace_id' => $ws['workspace']->id,
            'created_by_user_id' => $ws['user']->id,
            'name' => 'Blank Test Expo',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $ws['workspace']->id,
            'user_id' => $ws['user']->id,
            'exhibition_id' => $ex->id,
            'batch_uuid' => 'blank-guard-batch-uuid',
            'status' => 'ready_for_review',
        ]);

        $initialCardCount = Card::where('workspace_id', $ws['workspace']->id)->count();

        // Staged item with empty / blank extracted data (e.g. failed OCR)
        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $ws['workspace']->id,
            'user_id' => $ws['user']->id,
            'client_item_id' => 'client_blank_1',
            'sequence_order' => 1,
            'status' => 'failed',
            'front_image_path' => 'bulk_staging/blank_front.jpg',
            'extracted_data' => [
                'company' => '',
                'name' => null,
                'phone' => [],
            ],
            'decision' => 'create_new',
        ]);

        // Attempt to commit the blank item
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$ws['token']])
            ->postJson("/api/bulk-imports/{$batch->batch_uuid}/commit", [
                'items' => [
                    ['id' => $item->id, 'decision' => 'create_new'],
                ],
            ]);
        $res->assertStatus(200);

        // Strict verification: NO new Card record created!
        $this->assertEquals($initialCardCount, Card::where('workspace_id', $ws['workspace']->id)->count());

        // Item status transitioned to skipped
        $item->refresh();
        $this->assertEquals('skipped', $item->status);
        $this->assertNull($item->saved_card_id);

        // Batch counter updated correctly
        $batch->refresh();
        $this->assertEquals(1, $batch->skipped_items);
        $this->assertEquals(0, $batch->saved_items);
    }

    /**
     * 11. Duplicate Auto-Link: Duplicate cards automatically link to existing contacts and do not create duplicate Cards.
     */
    public function test_duplicate_cards_automatically_link_to_existing_contact_without_creating_second_card(): void
    {
        Storage::fake('local');
        $ws = $this->createWorkspaceUser('Duplicate Guard Test', 'dupguard@example.com', 'owner');
        $ex = Exhibition::create([
            'workspace_id' => $ws['workspace']->id,
            'created_by_user_id' => $ws['user']->id,
            'name' => 'Dup Test Expo',
            'status' => 'active',
        ]);

        // Existing Card in workspace
        $existingCard = Card::create([
            'workspace_id' => $ws['workspace']->id,
            'user_id' => $ws['user']->id,
            'company' => 'Supreme Textiles',
            'name' => 'Ramesh Kumar',
            'phone' => ['9876500001'],
            'image_path' => 'cards/original_supreme.jpg',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $ws['workspace']->id,
            'user_id' => $ws['user']->id,
            'exhibition_id' => $ex->id,
            'batch_uuid' => 'dup-guard-batch-uuid',
            'status' => 'ready_for_review',
        ]);

        $frontFile = UploadedFile::fake()->image('dup_front.jpg');
        $path = $frontFile->store('bulk_staging', 'local');

        // New item that matches the existing phone
        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $ws['workspace']->id,
            'user_id' => $ws['user']->id,
            'client_item_id' => 'client_dup_1',
            'sequence_order' => 1,
            'status' => 'duplicate_detected',
            'front_image_path' => $path,
            'matched_card_id' => $existingCard->id,
            'extracted_data' => [
                'company' => 'Supreme Textiles',
                'name' => 'Ramesh Kumar',
                'phone' => ['9876500001'],
            ],
            'decision' => 'link_existing',
        ]);

        // Commit item
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$ws['token']])
            ->postJson("/api/bulk-imports/{$batch->batch_uuid}/commit", [
                'items' => [
                    ['id' => $item->id, 'decision' => 'link_existing'],
                ],
            ]);
        $res->assertStatus(200);

        // Strict verification: Exactly 1 Card exists in workspace!
        $this->assertEquals(1, Card::where('workspace_id', $ws['workspace']->id)->count());

        // CardScan is created and linked to the existing card
        $item->refresh();
        $this->assertEquals('saved', $item->status);
        $this->assertEquals($existingCard->id, $item->saved_card_id);

        $scan = CardScan::where('bulk_import_item_id', $item->id)->first();
        $this->assertNotNull($scan);
        $this->assertEquals($existingCard->id, $scan->card_id);

        // Canonical Card image path was preserved
        $existingCard->refresh();
        $this->assertEquals('cards/original_supreme.jpg', $existingCard->image_path);
    }
}
