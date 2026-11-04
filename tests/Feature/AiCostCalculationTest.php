<?php

namespace Tests\Feature;

use App\Models\AiApiRequest;
use App\Models\AiCostExchangeRate;
use App\Models\AiModelPricing;
use App\Models\ApiToken;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AiCostCalculationService;
use App\Services\ScanQuotaService;
use Database\Seeders\AiPricingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AiCostCalculationTest extends TestCase
{
    use RefreshDatabase;

    protected AiCostCalculationService $costService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(AiPricingSeeder::class);
        $this->costService = app(AiCostCalculationService::class);
    }

    private function createWorkspaceUser(): array
    {
        $user = User::create([
            'name' => 'Mehta Admin',
            'email' => 'mehta.'.uniqid().'@example.com',
            'password' => Hash::make('secret123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Ceramics WS',
            'slug' => 'ceramics-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $plan = Plan::firstOrCreate(
            ['slug' => 'test-plan-10'],
            [
                'name' => 'Test 10 Plan',
                'price' => 0.00,
                'monthly_scan_allowance' => 10,
                'features' => ['single_card_scan'],
                'is_active' => true,
            ]
        );

        $subscription = $workspace->activeSubscription();
        $subscription->update([
            'plan_id' => $plan->id,
            'status' => 'active',
            'current_period_starts_at' => now()->startOfMonth(),
            'current_period_ends_at' => now()->endOfMonth(),
            'scan_allowance' => 10,
        ]);

        $tokenResult = ApiToken::createTokenForUser($user);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'subscription' => $subscription,
            'token' => $tokenResult['plain_token'],
        ];
    }

    private function createSampleRequest(array $overrides = []): AiApiRequest
    {
        return AiApiRequest::create(array_merge([
            'scan_type' => 'single_scan',
            'request_uuid' => Str::uuid()->toString(),
            'requested_model' => 'gemini-3.5-flash',
            'actual_model' => 'gemini-3.5-flash',
            'attempt_number' => 1,
            'is_fallback' => false,
            'image_count' => 1,
            'status' => 'success',
            'http_status' => 200,
            'started_at' => now(),
            'completed_at' => now(),
            'duration_ms' => 850,
            'prompt_tokens' => 1000,
            'candidates_tokens' => 200,
            'thoughts_tokens' => 0,
            'cached_tokens' => 0,
            'total_tokens' => 1200,
            'cost_usd' => 0.000000,
            'cost_inr' => 0.000000,
            'cost_calculation_status' => 'pending',
        ], $overrides));
    }

    /**
     * Requirement 1: Correct input-token cost calculation.
     */
    public function test_01_correct_input_token_cost_calculation(): void
    {
        // gemini-3.5-flash: input is $0.075 per 1M tokens ($0.000000075 / token)
        // 100,000 prompt tokens = 100,000 * 0.000000075 = $0.007500
        $request = $this->createSampleRequest([
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
            'cached_tokens' => 0,
            'thoughts_tokens' => 0,
            'total_tokens' => 100000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('calculated', $calculated->cost_calculation_status);
        $this->assertEquals('0.007500', $calculated->cost_usd);

        // Exchange rate is 86.5000 -> 0.007500 * 86.5000 = 0.648750 INR
        $this->assertEquals('0.648750', $calculated->cost_inr);
    }

    /**
     * Requirement 2: Correct output-token cost calculation.
     */
    public function test_02_correct_output_token_cost_calculation(): void
    {
        // gemini-3.5-flash: output is $0.30 per 1M tokens ($0.00000030 / token)
        // 100,000 candidate tokens = 100,000 * 0.00000030 = $0.030000
        $request = $this->createSampleRequest([
            'prompt_tokens' => 0,
            'candidates_tokens' => 100000,
            'cached_tokens' => 0,
            'thoughts_tokens' => 0,
            'total_tokens' => 100000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('calculated', $calculated->cost_calculation_status);
        $this->assertEquals('0.030000', $calculated->cost_usd);

        // 0.030000 * 86.5000 = 2.595000 INR
        $this->assertEquals('2.595000', $calculated->cost_inr);
    }

    /**
     * Requirement 3: Thinking-token cost calculation.
     */
    public function test_03_thinking_token_cost_calculation(): void
    {
        // In Gemini, candidatesTokenCount includes thoughtTokenCount.
        // If candidates_tokens = 50,000 and thoughts_tokens = 20,000:
        // non-thought candidate tokens = 30,000 @ $0.30/M = $0.009000
        // thought tokens = 20,000 @ $0.30/M = $0.006000
        // total output = $0.015000
        $request = $this->createSampleRequest([
            'prompt_tokens' => 0,
            'candidates_tokens' => 50000,
            'thoughts_tokens' => 20000,
            'cached_tokens' => 0,
            'total_tokens' => 50000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('0.015000', $calculated->cost_usd);
    }

    /**
     * Requirement 4: Cached-token calculation without double-counting.
     */
    public function test_04_cached_token_calculation_without_double_counting(): void
    {
        // Gemini promptTokenCount = 10,000, with cachedContentTokenCount = 8,000.
        // Non-cached prompt tokens = 10,000 - 8,000 = 2,000.
        // Input rate = $0.075/M, Cached rate = $0.01875/M
        // Non-cached prompt cost = 2,000 * 0.075/1M = $0.000150
        // Cached prompt cost = 8,000 * 0.01875/1M = $0.000150
        // Total prompt cost = $0.000300
        // (If double counted: 10,000 * 0.075/1M + 8,000 * 0.01875/1M would be $0.000900)
        $request = $this->createSampleRequest([
            'prompt_tokens' => 10000,
            'cached_tokens' => 8000,
            'candidates_tokens' => 0,
            'thoughts_tokens' => 0,
            'total_tokens' => 10000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('0.000300', $calculated->cost_usd);
        $this->assertNotEquals('0.000900', $calculated->cost_usd);
    }

    /**
     * Requirement 5: Different Gemini model pricing.
     */
    public function test_05_different_gemini_model_pricing(): void
    {
        // 1. gemini-3.5-flash-lite: $0.0375 / $0.1500
        $liteRequest = $this->createSampleRequest([
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calculatedLite = $this->costService->calculateAndPersist($liteRequest);
        // (100k * 0.0375/1M) + (100k * 0.15/1M) = 0.003750 + 0.015000 = 0.018750
        $this->assertEquals('0.018750', $calculatedLite->cost_usd);

        // 2. gemini-1.5-pro: $1.25 / $5.00
        $proRequest = $this->createSampleRequest([
            'requested_model' => 'gemini-1.5-pro',
            'actual_model' => 'gemini-1.5-pro',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calculatedPro = $this->costService->calculateAndPersist($proRequest);
        // (100k * 1.25/1M) + (100k * 5.00/1M) = 0.125000 + 0.500000 = 0.625000
        $this->assertEquals('0.625000', $calculatedPro->cost_usd);
    }

    /**
     * Requirement 6: Historical pricing version selection.
     */
    public function test_06_historical_pricing_version_selection(): void
    {
        // Create an older pricing version 2025-v1 valid in 2025
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-custom-model',
            'pricing_version' => '2025-v1',
            'input_token_price_per_million' => 0.100000,
            'output_token_price_per_million' => 0.400000,
            'cached_input_token_price_per_million' => 0.025000,
            'thoughts_token_price_per_million' => 0.400000,
            'input_token_unit_price' => 0.0000001000,
            'output_token_unit_price' => 0.0000004000,
            'cached_input_token_unit_price' => 0.0000000250,
            'thoughts_token_unit_price' => 0.0000004000,
            'currency' => 'USD',
            'effective_from' => '2025-01-01 00:00:00',
            'effective_to' => '2026-01-01 00:00:00',
            'is_active' => true,
        ]);

        // Create new pricing version 2026-v1 valid from 2026 onwards
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-custom-model',
            'pricing_version' => '2026-v1',
            'input_token_price_per_million' => 0.050000,
            'output_token_price_per_million' => 0.200000,
            'cached_input_token_price_per_million' => 0.012500,
            'thoughts_token_price_per_million' => 0.200000,
            'input_token_unit_price' => 0.0000000500,
            'output_token_unit_price' => 0.0000002000,
            'cached_input_token_unit_price' => 0.0000000125,
            'thoughts_token_unit_price' => 0.0000002000,
            'currency' => 'USD',
            'effective_from' => '2026-01-01 00:00:00',
            'effective_to' => null,
            'is_active' => true,
        ]);

        // Historical request from 2025 must select 2025-v1
        $oldRequest = $this->createSampleRequest([
            'requested_model' => 'gemini-custom-model',
            'actual_model' => 'gemini-custom-model',
            'started_at' => Carbon::parse('2025-06-15 12:00:00'),
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
        ]);
        $calcOld = $this->costService->calculateAndPersist($oldRequest);
        $this->assertEquals('2025-v1', $calcOld->pricing_version);
        $this->assertEquals('0.010000', $calcOld->cost_usd); // 100k * 0.10/M

        // Current request from 2026 must select 2026-v1
        $newRequest = $this->createSampleRequest([
            'requested_model' => 'gemini-custom-model',
            'actual_model' => 'gemini-custom-model',
            'started_at' => Carbon::parse('2026-03-01 12:00:00'),
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
        ]);
        $calcNew = $this->costService->calculateAndPersist($newRequest);
        $this->assertEquals('2026-v1', $calcNew->pricing_version);
        $this->assertEquals('0.005000', $calcNew->cost_usd); // 100k * 0.05/M
    }

    /**
     * Requirement 7: Historical USD-INR exchange-rate selection.
     */
    public function test_07_historical_usd_inr_exchange_rate_selection(): void
    {
        // 2025 pricing for gemini-3.5-flash
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-3.5-flash',
            'pricing_version' => '2025-v1',
            'input_token_price_per_million' => 0.075000,
            'output_token_price_per_million' => 0.300000,
            'cached_input_token_price_per_million' => 0.018750,
            'thoughts_token_price_per_million' => 0.300000,
            'input_token_unit_price' => 0.0000000750,
            'output_token_unit_price' => 0.0000003000,
            'cached_input_token_unit_price' => 0.0000000188,
            'thoughts_token_unit_price' => 0.0000003000,
            'currency' => 'USD',
            'effective_from' => '2025-01-01 00:00:00',
            'effective_to' => '2026-01-01 00:00:00',
            'is_active' => true,
        ]);

        // 2025 rate: 83.2500
        AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 83.2500,
            'effective_date' => '2025-01-01',
            'source' => 'system',
            'is_active' => true,
        ]);

        // Request from 2025 must use 83.2500
        $request2025 = $this->createSampleRequest([
            'started_at' => Carbon::parse('2025-08-10 10:00:00'),
            'prompt_tokens' => 100000, // $0.007500 USD
            'candidates_tokens' => 0,
        ]);
        $calc2025 = $this->costService->calculateAndPersist($request2025);
        $this->assertEquals('83.2500', $calc2025->exchange_rate);
        // 0.007500 * 83.25 = 0.624375
        $this->assertEquals('0.624375', $calc2025->cost_inr);

        // Request from 2026 uses 86.5000
        $request2026 = $this->createSampleRequest([
            'started_at' => Carbon::parse('2026-02-15 10:00:00'),
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
        ]);
        $calc2026 = $this->costService->calculateAndPersist($request2026);
        $this->assertEquals('86.5000', $calc2026->exchange_rate);
        $this->assertEquals('0.648750', $calc2026->cost_inr);
    }

    /**
     * Requirement 8: Missing pricing data.
     */
    public function test_08_missing_pricing_data(): void
    {
        $request = $this->createSampleRequest([
            'requested_model' => 'unknown-future-model-99',
            'actual_model' => 'unknown-future-model-99',
            'prompt_tokens' => 5000,
            'candidates_tokens' => 1000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('pricing_missing', $calculated->cost_calculation_status);
        $this->assertEquals('0.000000', $calculated->cost_usd);
        $this->assertEquals('0.000000', $calculated->cost_inr);
    }

    /**
     * Requirement 9: Missing exchange-rate data.
     */
    public function test_09_missing_exchange_rate_data(): void
    {
        // Deactivate all USD-to-INR rates
        AiCostExchangeRate::query()->update(['is_active' => false]);

        $request = $this->createSampleRequest([
            'prompt_tokens' => 100000, // $0.007500 USD
            'candidates_tokens' => 0,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('exchange_rate_missing', $calculated->cost_calculation_status);
        // USD cost is preserved
        $this->assertEquals('0.007500', $calculated->cost_usd);
        // INR cost is zero / pending
        $this->assertEquals('0.000000', $calculated->cost_inr);
        $this->assertNull($calculated->exchange_rate_id);
    }

    /**
     * Requirement 10: Missing token metadata.
     */
    public function test_10_missing_token_metadata(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'thoughts_tokens' => 0,
            'cached_tokens' => 0,
            'total_tokens' => 0,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('no_usage', $calculated->cost_calculation_status);
        $this->assertEquals('0.000000', $calculated->cost_usd);
        $this->assertEquals('0.000000', $calculated->cost_inr);
    }

    /**
     * Requirement 11: Failed Gemini attempt with billable token usage.
     */
    public function test_11_failed_gemini_attempt_with_billable_token_usage(): void
    {
        // Model returned an HTTP 500 or safety block after consuming prompt tokens
        $request = $this->createSampleRequest([
            'status' => 'failed',
            'http_status' => 500,
            'error_code' => 'provider_error',
            'error_message' => 'Internal server error during content generation',
            'prompt_tokens' => 20000,
            'candidates_tokens' => 0,
            'total_tokens' => 20000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('calculated', $calculated->cost_calculation_status);
        // 20,000 * 0.075/1M = $0.001500 USD
        $this->assertEquals('0.001500', $calculated->cost_usd);
        // 0.001500 * 86.5000 = 0.129750 INR
        $this->assertEquals('0.129750', $calculated->cost_inr);
    }

    /**
     * Requirement 12: Multiple fallback attempts with separate costs.
     */
    public function test_12_multiple_fallback_attempts_with_separate_costs(): void
    {
        // Attempt 1: Gemini 3.5 Flash fails after 10,000 prompt tokens
        $attempt1 = $this->createSampleRequest([
            'attempt_number' => 1,
            'is_fallback' => false,
            'requested_model' => 'gemini-3.5-flash',
            'actual_model' => 'gemini-3.5-flash',
            'status' => 'failed',
            'http_status' => 429,
            'prompt_tokens' => 10000,
            'candidates_tokens' => 0,
            'total_tokens' => 10000,
        ]);
        $calc1 = $this->costService->calculateAndPersist($attempt1);

        // Attempt 2: Gemini 3.5 Flash-Lite succeeds with 10,000 prompt + 500 output tokens
        $attempt2 = $this->createSampleRequest([
            'attempt_number' => 2,
            'is_fallback' => true,
            'fallback_reason' => 'Fallback from gemini-3.5-flash: Rate limit',
            'parent_request_id' => $attempt1->id,
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'status' => 'success',
            'http_status' => 200,
            'prompt_tokens' => 10000,
            'candidates_tokens' => 500,
            'total_tokens' => 10500,
        ]);
        $calc2 = $this->costService->calculateAndPersist($attempt2);

        // Attempt 1 Cost: 10,000 * 0.075/1M = $0.000750
        $this->assertEquals('0.000750', $calc1->cost_usd);

        // Attempt 2 Cost (Lite rates): (10,000 * 0.0375/1M) + (500 * 0.15/1M) = 0.000375 + 0.000075 = $0.000450
        $this->assertEquals('0.000450', $calc2->cost_usd);

        // Total AI provider spend is the sum of both attempts
        $totalSpendUsd = (float) $calc1->cost_usd + (float) $calc2->cost_usd;
        $this->assertEquals(0.001200, round($totalSpendUsd, 6));
    }

    /**
     * Requirement 13: Bulk requests with multiple images.
     */
    public function test_13_bulk_requests_with_multiple_images(): void
    {
        $setup = $this->createWorkspaceUser();

        $batch = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => Exhibition::create([
                'workspace_id' => $setup['workspace']->id,
                'created_by_user_id' => $setup['user']->id,
                'name' => 'Ceramics Expo 2026',
                'status' => 'active',
            ])->id,
            'batch_uuid' => Str::uuid()->toString(),
            'total_items' => 1,
            'status' => 'processing',
        ]);

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'client_item_id' => 'item_double_01',
            'front_image_path' => 'bulk/front.jpg',
            'back_image_path' => 'bulk/back.jpg',
            'status' => 'pending',
        ]);

        $request = $this->createSampleRequest([
            'scan_type' => 'bulk_scan',
            'bulk_import_id' => $batch->id,
            'bulk_import_item_id' => $item->id,
            'image_count' => 2, // Front and Back
            'prompt_tokens' => 20000,
            'candidates_tokens' => 0,
            'total_tokens' => 20000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        // Total cost: 20k * 0.075/1M = $0.001500 USD
        $this->assertEquals('0.001500', $calculated->cost_usd);
        // Per image: $0.001500 / 2 = $0.000750 USD
        $this->assertEquals(0.000750, $calculated->costPerImageUsd());
    }

    /**
     * Requirement 14: Idempotent cost calculation.
     */
    public function test_14_idempotent_cost_calculation(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 10000,
            'candidates_tokens' => 2000,
        ]);

        $firstRun = $this->costService->calculateAndPersist($request);
        $this->assertEquals('calculated', $firstRun->cost_calculation_status);
        $firstUsd = $firstRun->cost_usd;
        $firstInr = $firstRun->cost_inr;
        $firstCalculatedAt = $firstRun->cost_calculated_at;

        // Second run without force must return the identical finalized record without changing anything
        $secondRun = $this->costService->calculateAndPersist($request);
        $this->assertEquals($firstUsd, $secondRun->cost_usd);
        $this->assertEquals($firstInr, $secondRun->cost_inr);
        $this->assertEquals($firstCalculatedAt->toIso8601String(), $secondRun->cost_calculated_at->toIso8601String());

        // Total count of records remains 1
        $this->assertEquals(1, AiApiRequest::count());
    }

    /**
     * Requirement 15: Concurrent calculation safety.
     */
    public function test_15_concurrent_calculation_safety(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 50000,
            'candidates_tokens' => 5000,
        ]);

        // Simulate concurrent execution: both calls within transaction locks
        $res1 = $this->costService->calculateAndPersist($request);
        $res2 = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($res1);
        $this->assertNotNull($res2);
        $this->assertEquals($res1->cost_usd, $res2->cost_usd);
        $this->assertEquals('calculated', $res2->cost_calculation_status);
    }

    /**
     * Requirement 16: Historical costs remain unchanged after pricing updates.
     */
    public function test_16_historical_costs_remain_unchanged_after_pricing_updates(): void
    {
        // 1. Calculate a request with current pricing ($0.075 / $0.30)
        $request = $this->createSampleRequest([
            'started_at' => Carbon::parse('2026-01-10 12:00:00'),
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
        ]);
        $calculated = $this->costService->calculateAndPersist($request);
        $originalCostUsd = $calculated->cost_usd;
        $originalCostInr = $calculated->cost_inr;
        $originalVersion = $calculated->pricing_version;

        // 2. Add a new pricing record or new exchange rate
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-3.5-flash',
            'pricing_version' => '2026-v2',
            'input_token_price_per_million' => 0.020000, // Drastically reduced price
            'output_token_price_per_million' => 0.100000,
            'cached_input_token_price_per_million' => 0.005000,
            'thoughts_token_price_per_million' => 0.100000,
            'input_token_unit_price' => 0.0000000200,
            'output_token_unit_price' => 0.0000001000,
            'cached_input_token_unit_price' => 0.0000000050,
            'thoughts_token_unit_price' => 0.0000001000,
            'currency' => 'USD',
            'effective_from' => '2026-06-01 00:00:00',
            'is_active' => true,
        ]);

        AiCostExchangeRate::create([
            'base_currency' => 'USD',
            'target_currency' => 'INR',
            'exchange_rate' => 95.0000, // New exchange rate
            'effective_date' => '2026-06-01',
            'source' => 'system',
            'is_active' => true,
        ]);

        // Historical request refreshed from database must retain its exact original costs and versions
        $refreshed = $request->fresh();
        $this->assertEquals($originalCostUsd, $refreshed->cost_usd);
        $this->assertEquals($originalCostInr, $refreshed->cost_inr);
        $this->assertEquals($originalVersion, $refreshed->pricing_version);

        // Calling calculateAndPersist again without force must leave it completely untouched
        $recalculated = $this->costService->calculateAndPersist($refreshed);
        $this->assertEquals($originalCostUsd, $recalculated->cost_usd);
        $this->assertEquals($originalCostInr, $recalculated->cost_inr);
    }

    /**
     * Requirement 17: Customer scan credits remain completely unaffected.
     */
    public function test_17_customer_scan_credits_remain_completely_unaffected(): void
    {
        $setup = $this->createWorkspaceUser();
        $quotaService = app(ScanQuotaService::class);

        // Initial workspace quota
        $initialQuota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $initialQuota['used_credits']);
        $this->assertEquals(10, $initialQuota['remaining_credits']);

        // Create and calculate AI cost for 5 different expensive requests
        for ($i = 1; $i <= 5; $i++) {
            $req = $this->createSampleRequest([
                'workspace_id' => $setup['workspace']->id,
                'user_id' => $setup['user']->id,
                'prompt_tokens' => 200000,
                'candidates_tokens' => 50000,
            ]);
            $this->costService->calculateAndPersist($req);
        }

        // Quota ledger must have 0 confirmed records
        $ledgerCount = ScanUsageLedger::where('workspace_id', $setup['workspace']->id)->count();
        $this->assertEquals(0, $ledgerCount);

        // Workspace scan credits must remain completely untouched (10 remaining, 0 used)
        $afterQuota = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(0, $afterQuota['used_credits']);
        $this->assertEquals(10, $afterQuota['remaining_credits']);
    }

    /**
     * Requirement 18: Decimal precision and rounding accuracy.
     */
    public function test_18_decimal_precision_and_rounding_accuracy(): void
    {
        // 17 prompt tokens at $0.075 per million:
        // (17 * 0.075) / 1,000,000 = 1.275 / 1,000,000 = 0.000001275 USD
        // Stored with 6 decimal places = 0.000001 USD
        $request = $this->createSampleRequest([
            'prompt_tokens' => 17,
            'candidates_tokens' => 0,
            'cached_tokens' => 0,
            'thoughts_tokens' => 0,
            'total_tokens' => 17,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('0.000001', $calculated->cost_usd);

        // BCMath raw calculation precision verification
        $exactCost = $this->costService->calcTokenCost(17, '0.075000');
        $this->assertEquals('0.000001275000', $exactCost);
    }
}
