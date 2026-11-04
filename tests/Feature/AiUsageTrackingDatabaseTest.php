<?php

namespace Tests\Feature;

use App\Models\AiApiRequest;
use App\Models\AiApiUsageDetail;
use App\Models\AiCostExchangeRate;
use App\Models\AiModelPricing;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use App\Services\ScanQuotaService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AiUsageTrackingDatabaseTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUser(): array
    {
        $user = User::create([
            'name' => 'Kunal Patel',
            'email' => 'kunal@example.com',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Apex Ceramics',
            'slug' => 'apex-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        return ['user' => $user, 'workspace' => $workspace];
    }

    public function test_ai_tracking_tables_exist_and_have_expected_schema(): void
    {
        $this->assertTrue(Schema::hasTable('ai_cost_exchange_rates'));
        $this->assertTrue(Schema::hasTable('ai_model_pricing'));
        $this->assertTrue(Schema::hasTable('ai_api_requests'));
        $this->assertTrue(Schema::hasTable('ai_api_usage_details'));

        $this->assertTrue(Schema::hasColumns('ai_api_requests', [
            'workspace_id', 'workspace_name', 'user_id', 'user_email',
            'scan_type', 'request_uuid', 'idempotency_key',
            'card_scan_id', 'card_id', 'bulk_import_id', 'bulk_import_item_id',
            'requested_model', 'actual_model', 'attempt_number', 'is_fallback',
            'fallback_reason', 'parent_request_id', 'image_count',
            'status', 'http_status', 'error_code', 'error_message',
            'started_at', 'completed_at', 'duration_ms',
            'prompt_tokens', 'candidates_tokens', 'thoughts_tokens', 'cached_tokens', 'total_tokens',
            'cost_usd', 'cost_inr', 'pricing_version', 'exchange_rate',
            'model_pricing_id', 'exchange_rate_id',
        ]));
    }

    public function test_model_pricing_versioning_and_cost_calculation(): void
    {
        // Version 1 pricing
        $v1 = AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-2.5-flash',
            'pricing_version' => '2026-v1',
            'input_token_price_per_million' => 0.075000,
            'output_token_price_per_million' => 0.300000,
            'cached_input_token_price_per_million' => 0.018750,
            'thoughts_token_price_per_million' => 0.300000,
            'input_token_unit_price' => 0.0000000750,
            'output_token_unit_price' => 0.0000003000,
            'cached_input_token_unit_price' => 0.0000000188,
            'thoughts_token_unit_price' => 0.0000003000,
            'currency' => 'USD',
            'effective_from' => now()->subMonths(6),
            'effective_to' => now()->subDay(),
            'is_active' => false,
        ]);

        // Version 2 updated pricing
        $v2 = AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-2.5-flash',
            'pricing_version' => '2026-v2',
            'input_token_price_per_million' => 0.050000,
            'output_token_price_per_million' => 0.200000,
            'cached_input_token_price_per_million' => 0.012500,
            'thoughts_token_price_per_million' => 0.200000,
            'input_token_unit_price' => 0.0000000500,
            'output_token_unit_price' => 0.0000002000,
            'cached_input_token_unit_price' => 0.0000000125,
            'thoughts_token_unit_price' => 0.0000002000,
            'currency' => 'USD',
            'effective_from' => now()->subDay(),
            'is_active' => true,
        ]);

        // Verify active scope locates v2
        $activePricing = AiModelPricing::forModel('gemini-2.5-flash')->first();
        $this->assertNotNull($activePricing);
        $this->assertEquals('2026-v2', $activePricing->pricing_version);

        // Verify cost calculation: 1000 prompt tokens, 500 candidate tokens on v2
        // (1000 * 0.00000005) + (500 * 0.00000020) = 0.000050 + 0.000100 = 0.000150
        $costUsd = $v2->calculateCostUsd(1000, 500);
        $this->assertEquals(0.000150, $costUsd);

        // Verify unique constraint prevents duplicate provider+model+version
        $this->expectException(QueryException::class);
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-2.5-flash',
            'pricing_version' => '2026-v2',
            'input_token_price_per_million' => 0.050000,
            'output_token_price_per_million' => 0.200000,
            'input_token_unit_price' => 0.0000000500,
            'output_token_unit_price' => 0.0000002000,
            'effective_from' => now(),
        ]);
    }

    public function test_exchange_rate_history_and_latest_lookup(): void
    {
        // Old rate
        AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 84.5000,
            'effective_date' => '2025-06-01',
            'source' => 'system',
            'is_active' => true,
        ]);

        // Current rate
        $currentRate = AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 86.7500,
            'effective_date' => '2026-01-01',
            'source' => 'system',
            'is_active' => true,
        ]);

        $latest = AiCostExchangeRate::latestFor('USD', 'INR')->first();
        $this->assertNotNull($latest);
        $this->assertEquals(86.7500, (float) $latest->exchange_rate);
        $this->assertEquals('2026-01-01', $latest->effective_date->format('Y-m-d'));

        // Prevent identical date + source duplicates
        $this->expectException(QueryException::class);
        AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 87.0000,
            'effective_date' => '2026-01-01',
            'source' => 'system',
        ]);
    }

    public function test_ai_api_request_creation_with_relationships_and_casts(): void
    {
        $setup = $this->createWorkspaceUser();
        $user = $setup['user'];
        $workspace = $setup['workspace'];

        $rate = AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 86.5000,
            'effective_date' => '2026-01-01',
            'source' => 'system',
            'is_active' => true,
        ]);

        $pricing = AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-2.5-flash',
            'pricing_version' => '2026-v1',
            'input_token_price_per_million' => 0.075000,
            'output_token_price_per_million' => 0.300000,
            'input_token_unit_price' => 0.0000000750,
            'output_token_unit_price' => 0.0000003000,
            'currency' => 'USD',
            'effective_from' => now()->subDay(),
            'is_active' => true,
        ]);

        $requestUuid = Str::uuid()->toString();

        $aiRequest = AiApiRequest::create([
            'workspace_id' => $workspace->id,
            'workspace_name' => $workspace->name,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'scan_type' => 'single_scan',
            'request_uuid' => $requestUuid,
            'idempotency_key' => 'scan_idemp_12345',
            'requested_model' => 'gemini-2.5-flash',
            'actual_model' => 'gemini-2.5-flash',
            'attempt_number' => 1,
            'is_fallback' => false,
            'image_count' => 2,
            'status' => 'success',
            'http_status' => 200,
            'started_at' => now()->subSeconds(2),
            'completed_at' => now(),
            'duration_ms' => 1850,
            'prompt_tokens' => 820,
            'candidates_tokens' => 210,
            'thoughts_tokens' => 0,
            'cached_tokens' => 0,
            'total_tokens' => 1030,
            'cost_usd' => 0.000124,
            'cost_inr' => 0.010726,
            'pricing_version' => '2026-v1',
            'exchange_rate' => 86.5000,
            'model_pricing_id' => $pricing->id,
            'exchange_rate_id' => $rate->id,
        ]);

        // Normalized usage detail
        $usageDetail = AiApiUsageDetail::create([
            'ai_api_request_id' => $aiRequest->id,
            'prompt_tokens' => 820,
            'candidates_tokens' => 210,
            'thoughts_tokens' => 0,
            'cached_content_tokens' => 0,
            'total_tokens' => 1030,
            'raw_usage_metadata' => [
                'promptTokenCount' => 820,
                'candidatesTokenCount' => 210,
                'totalTokenCount' => 1030,
            ],
        ]);

        $this->assertEquals($workspace->id, $aiRequest->workspace->id);
        $this->assertEquals($user->id, $aiRequest->user->id);
        $this->assertEquals($pricing->id, $aiRequest->modelPricing->id);
        $this->assertEquals($rate->id, $aiRequest->exchangeRate->id);
        $this->assertEquals($usageDetail->id, $aiRequest->usageDetail->id);

        // Reciprocal relations
        $this->assertTrue($workspace->aiApiRequests->contains('id', $aiRequest->id));
        $this->assertTrue($user->aiApiRequests->contains('id', $aiRequest->id));

        // Test cast assertions
        $this->assertIsInt($aiRequest->total_tokens);
        $this->assertIsInt($aiRequest->duration_ms);
        $this->assertIsBool($aiRequest->is_fallback);
        $this->assertEquals(0.000062, $aiRequest->costPerImageUsd());
    }

    public function test_multiple_fallback_attempts_for_single_logical_scan(): void
    {
        $setup = $this->createWorkspaceUser();
        $idempotencyKey = 'client_batch_key_999';

        // Attempt 1: Failed on gemini-2.5-flash
        $attempt1 = AiApiRequest::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'scan_type' => 'single_scan',
            'request_uuid' => Str::uuid()->toString(),
            'idempotency_key' => $idempotencyKey,
            'requested_model' => 'gemini-2.5-flash',
            'actual_model' => 'gemini-2.5-flash',
            'attempt_number' => 1,
            'is_fallback' => false,
            'status' => 'failed',
            'http_status' => 503,
            'error_code' => 'MODEL_OVERLOADED',
            'error_message' => 'The model is currently overloaded. Please try again.',
            'duration_ms' => 2100,
        ]);

        // Attempt 2: Fallback succeeds on gemini-1.5-flash
        $attempt2 = AiApiRequest::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'scan_type' => 'single_scan',
            'request_uuid' => Str::uuid()->toString(),
            'idempotency_key' => $idempotencyKey,
            'requested_model' => 'gemini-2.5-flash',
            'actual_model' => 'gemini-1.5-flash',
            'attempt_number' => 2,
            'is_fallback' => true,
            'fallback_reason' => 'HTTP 503 from primary model gemini-2.5-flash',
            'parent_request_id' => $attempt1->id,
            'status' => 'success',
            'http_status' => 200,
            'prompt_tokens' => 810,
            'candidates_tokens' => 195,
            'total_tokens' => 1005,
            'cost_usd' => 0.000119,
            'cost_inr' => 0.010293,
            'duration_ms' => 1400,
        ]);

        $this->assertTrue($attempt1->fallbackAttempts->contains('id', $attempt2->id));
        $this->assertEquals($attempt1->id, $attempt2->parentRequest->id);
        $this->assertTrue($attempt2->is_fallback);
        $this->assertEquals(2, $attempt2->attempt_number);
    }

    public function test_nullable_entity_references_preserve_history_when_entities_deleted(): void
    {
        $setup = $this->createWorkspaceUser();
        $user = $setup['user'];
        $workspace = $setup['workspace'];

        $exhibition = Exhibition::create([
            'workspace_id' => $workspace->id,
            'name' => 'Ceramics Expo 2026',
            'is_active' => true,
        ]);

        $card = Card::create([
            'workspace_id' => $workspace->id,
            'name' => 'Ramesh Shah',
            'company' => 'Shah Tiles',
        ]);

        $scan = CardScan::create([
            'workspace_id' => $workspace->id,
            'card_id' => $card->id,
            'user_id' => $user->id,
            'exhibition_id' => $exhibition->id,
            'scanned_at' => now(),
        ]);

        $bulkImport = BulkImport::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => Str::uuid()->toString(),
            'status' => 'completed',
        ]);

        $bulkItem = BulkImportItem::create([
            'bulk_import_id' => $bulkImport->id,
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'front_image_path' => 'bulk_imports/front.jpg',
            'client_item_id' => 'item-1',
            'sequence_order' => 1,
            'status' => 'saved',
        ]);

        $aiRequest = AiApiRequest::create([
            'workspace_id' => $workspace->id,
            'workspace_name' => $workspace->name,
            'user_id' => $user->id,
            'user_name' => $user->name,
            'user_email' => $user->email,
            'scan_type' => 'bulk_scan',
            'request_uuid' => Str::uuid()->toString(),
            'card_scan_id' => $scan->id,
            'card_id' => $card->id,
            'bulk_import_id' => $bulkImport->id,
            'bulk_import_item_id' => $bulkItem->id,
            'requested_model' => 'gemini-1.5-flash',
            'actual_model' => 'gemini-1.5-flash',
            'status' => 'success',
            'http_status' => 200,
            'prompt_tokens' => 500,
            'candidates_tokens' => 150,
            'total_tokens' => 650,
            'cost_usd' => 0.000082,
            'cost_inr' => 0.007093,
        ]);

        // Delete the related card scan, bulk item, and bulk import
        $scan->delete();
        $bulkItem->delete();
        $bulkImport->delete();

        // Reload AI request
        $aiRequest->refresh();

        // Foreign keys must be set to null, preserving historical tracking record
        $this->assertNull($aiRequest->card_scan_id);
        $this->assertNull($aiRequest->bulk_import_item_id);
        $this->assertNull($aiRequest->bulk_import_id);

        // Historical snapshots preserved
        $this->assertEquals('Apex Ceramics', $aiRequest->workspace_name);
        $this->assertEquals('kunal@example.com', $aiRequest->user_email);
        $this->assertEquals(650, $aiRequest->total_tokens);
    }

    public function test_decimal_precision_is_preserved_for_pricing_and_costs(): void
    {
        $setup = $this->createWorkspaceUser();

        $pricing = AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-experimental',
            'pricing_version' => '2026-exp',
            'input_token_price_per_million' => 0.123456,
            'output_token_price_per_million' => 0.654321,
            'input_token_unit_price' => 0.0000001235,
            'output_token_unit_price' => 0.0000006543,
            'effective_from' => now(),
            'is_active' => true,
        ]);

        $aiRequest = AiApiRequest::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'scan_type' => 'single_scan',
            'request_uuid' => Str::uuid()->toString(),
            'requested_model' => 'gemini-experimental',
            'actual_model' => 'gemini-experimental',
            'status' => 'success',
            'cost_usd' => 0.000123,
            'cost_inr' => 0.010639,
            'exchange_rate' => 86.4950,
        ]);

        $aiRequest->refresh();
        $this->assertEquals('0.000123', (string) $aiRequest->cost_usd);
        $this->assertEquals('0.010639', (string) $aiRequest->cost_inr);
        $this->assertEquals('86.4950', (string) $aiRequest->exchange_rate);
    }

    public function test_preservation_of_existing_customer_scan_credit_and_quota_ledger(): void
    {
        $setup = $this->createWorkspaceUser();
        $workspace = $setup['workspace'];
        $user = $setup['user'];

        // Existing scan quota system works without interference
        $freePlan = Plan::firstOrCreate(
            ['slug' => 'free'],
            [
                'name' => 'Free',
                'price' => 0.00,
                'monthly_scan_allowance' => 5,
                'features' => ['single_card_scan'],
                'is_active' => true,
            ]
        );

        $subscription = WorkspaceSubscription::firstOrCreate(
            ['workspace_id' => $workspace->id],
            [
                'plan_id' => $freePlan->id,
                'status' => 'active',
                'started_at' => now(),
                'current_period_starts_at' => now()->startOfMonth(),
                'current_period_ends_at' => now()->endOfMonth(),
            ]
        );

        // Record a scan credit reservation in the existing ledger
        $quotaService = app(ScanQuotaService::class);
        $idempotencyKey = 'quota_test_key_'.uniqid();
        $reservation = $quotaService->reserveQuota($workspace, $user, 'single_scan', $idempotencyKey, 1);

        $this->assertInstanceOf(ScanUsageLedger::class, $reservation);
        $this->assertEquals('reserved', $reservation->status);

        // Deduct/confirm scan credit in the existing ledger
        $confirmed = $quotaService->confirmDeduction($idempotencyKey);
        $this->assertNotNull($confirmed);
        $this->assertEquals('confirmed', $confirmed->status);

        $quota = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $quota['used_credits']);
        $this->assertEquals($quota['monthly_allowance'] - 1, $quota['remaining_credits']);

        // Check ScanUsageLedger integrity is completely intact
        $this->assertDatabaseHas('scan_usage_ledger', [
            'workspace_id' => $workspace->id,
            'idempotency_key' => $idempotencyKey,
            'status' => 'confirmed',
            'quantity' => 1,
        ]);
    }
}
