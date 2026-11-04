<?php

namespace Tests\Feature;

use App\Models\AiApiRequest;
use App\Models\AiApiUsageDetail;
use App\Models\AiCostExchangeRate;
use App\Models\AiModelPricing;
use App\Models\ApiToken;
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
use Illuminate\Support\Facades\Log;
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
            'started_at' => Carbon::parse('2026-01-10 12:00:00'),
            'completed_at' => Carbon::parse('2026-01-10 12:00:01'),
            'duration_ms' => 850,
            'prompt_tokens' => 1000,
            'candidates_tokens' => 200,
            'thoughts_tokens' => 0,
            'cached_tokens' => 0,
            'total_tokens' => 1200,
            'cost_usd' => null,
            'cost_inr' => null,
            'cost_calculation_status' => 'pending',
        ], $overrides));
    }

    /**
     * Requirement 1: Official model pricing records & effective dates.
     */
    public function test_01_official_model_pricing_records_and_effective_dates(): void
    {
        $expectedModels = [
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3.8-flash',
            'gemini-2.5-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
        ];

        foreach ($expectedModels as $model) {
            $pricing = AiModelPricing::where('model_identifier', $model)
                ->where('pricing_version', '2026-v2')
                ->first();

            $this->assertNotNull($pricing, "Expected 2026-v2 pricing record for {$model}");
            $this->assertTrue($pricing->is_active);
            $this->assertNotNull($pricing->effective_from);
            $this->assertStringContainsString('https://ai.google.dev/gemini-api/docs/pricing', $pricing->notes);
        }
    }

    /**
     * Requirement 2: Correct model-specific pricing (3.5-flash vs 3.5-flash-lite vs 3.8-flash vs 1.5-pro).
     */
    public function test_02_correct_model_specific_pricing(): void
    {
        // 1. gemini-3.5-flash (input: $1.50/M, output: $9.00/M)
        // 100,000 prompt + 100,000 candidate = $0.150000 + $0.900000 = $1.050000
        $flash = $this->createSampleRequest([
            'requested_model' => 'gemini-3.5-flash',
            'actual_model' => 'gemini-3.5-flash',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calcFlash = $this->costService->calculateAndPersist($flash);
        $this->assertEquals('1.050000', $calcFlash->cost_usd);

        // 2. gemini-3.5-flash-lite (input: $0.30/M, output: $2.50/M)
        // 100,000 prompt + 100,000 candidate = $0.030000 + $0.250000 = $0.280000
        $lite = $this->createSampleRequest([
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calcLite = $this->costService->calculateAndPersist($lite);
        $this->assertEquals('0.280000', $calcLite->cost_usd);

        // 3. gemini-3.8-flash (input: $0.75/M, output: $3.75/M)
        // 100,000 prompt + 100,000 candidate = $0.075000 + $0.375000 = $0.450000
        $flash38 = $this->createSampleRequest([
            'requested_model' => 'gemini-3.8-flash',
            'actual_model' => 'gemini-3.8-flash',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calc38 = $this->costService->calculateAndPersist($flash38);
        $this->assertEquals('0.450000', $calc38->cost_usd);

        // 4. gemini-1.5-pro (input: $1.25/M, output: $5.00/M)
        // 100,000 prompt + 100,000 candidate = $0.125000 + $0.500000 = $0.625000
        $pro = $this->createSampleRequest([
            'requested_model' => 'gemini-1.5-pro',
            'actual_model' => 'gemini-1.5-pro',
            'prompt_tokens' => 100000,
            'candidates_tokens' => 100000,
            'total_tokens' => 200000,
        ]);
        $calcPro = $this->costService->calculateAndPersist($pro);
        $this->assertEquals('0.625000', $calcPro->cost_usd);
    }

    /**
     * Requirement 3: No fictional model identifiers seeded.
     */
    public function test_03_no_fictional_model_identifiers(): void
    {
        $fictionalModels = ['gemini-fake-vision', 'gemini-ultra-nonexistent', 'gemini-gpt-turbo'];

        foreach ($fictionalModels as $fictional) {
            $pricing = AiModelPricing::where('model_identifier', $fictional)->first();
            $this->assertNull($pricing, "Fictional model {$fictional} should not exist in pricing database");

            $req = $this->createSampleRequest([
                'requested_model' => $fictional,
                'actual_model' => $fictional,
                'prompt_tokens' => 500,
                'candidates_tokens' => 200,
                'total_tokens' => 700,
            ]);

            $result = $this->costService->calculateAndPersist($req);
            $this->assertEquals('pricing_missing', $result->cost_calculation_status);
            $this->assertNull($result->cost_usd);
            $this->assertNull($result->cost_inr);
        }
    }

    /**
     * Requirement 4: BCMath-only calculations maintaining full precision.
     */
    public function test_04_bcmath_only_calculations(): void
    {
        // Calculate cost for large token amounts and verified rates
        $calcCost = $this->costService->calcTokenCost(1234567, '1.500000');
        // 1,234,567 * 1.50 / 1,000,000 = 1.851850500000
        $this->assertEquals('1.851850500000', $calcCost);

        $rounded = $this->costService->roundDecimal($calcCost, 6);
        $this->assertEquals('1.851851', $rounded);
    }

    /**
     * Requirement 5: No float conversion in financial calculations.
     */
    public function test_05_no_float_conversion_in_financial_calculations(): void
    {
        // In floating-point arithmetic: 0.1 + 0.2 != 0.3.
        // Pure BCMath string rounding handles exact decimal values without exponent representations.
        $rawDecimal = '0.000000499999';
        $rounded = $this->costService->roundDecimal($rawDecimal, 6);
        $this->assertEquals('0.000000', $rounded);

        $rawBoundary = '0.000000500000';
        $roundedHalfUp = $this->costService->roundDecimal($rawBoundary, 6);
        $this->assertEquals('0.000001', $roundedHalfUp);
    }

    /**
     * Requirement 6: Small decimal values and rounding boundaries.
     */
    public function test_06_small_decimal_values_and_rounding_boundaries(): void
    {
        // 1 single prompt token with gemini-3.5-flash-lite ($0.30/M -> $0.00000030 per token)
        $request = $this->createSampleRequest([
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'prompt_tokens' => 1,
            'candidates_tokens' => 0,
            'total_tokens' => 1,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);
        // Cost raw = 0.000000300000 -> rounds to 0.000000 at 6 decimals
        $this->assertEquals('0.000000', $calculated->cost_usd);

        // 2 tokens = 0.000000600000 -> rounds half-up to 0.000001 at 6 decimals
        $request2 = $this->createSampleRequest([
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'prompt_tokens' => 2,
            'candidates_tokens' => 0,
            'total_tokens' => 2,
        ]);

        $calculated2 = $this->costService->calculateAndPersist($request2);
        $this->assertEquals('0.000001', $calculated2->cost_usd);
    }

    /**
     * Requirement 7: Missing usage metadata -> usage_metadata_missing, cost_usd = null, cost_inr = null.
     */
    public function test_07_missing_usage_metadata_returns_null_costs(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'cached_tokens' => 0,
            'thoughts_tokens' => 0,
            'total_tokens' => 0,
            'cost_usd' => null,
            'cost_inr' => null,
        ]);

        // No AiApiUsageDetail record exists for this request
        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('usage_metadata_missing', $calculated->cost_calculation_status);
        $this->assertNull($calculated->cost_usd);
        $this->assertNull($calculated->cost_inr);
    }

    /**
     * Requirement 8: Missing model pricing -> pricing_missing, cost_usd = null, cost_inr = null.
     */
    public function test_08_missing_model_pricing_returns_null_costs(): void
    {
        $request = $this->createSampleRequest([
            'requested_model' => 'gemini-unknown-version-99',
            'actual_model' => 'gemini-unknown-version-99',
            'prompt_tokens' => 1000,
            'candidates_tokens' => 500,
            'total_tokens' => 1500,
            'cost_usd' => null,
            'cost_inr' => null,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('pricing_missing', $calculated->cost_calculation_status);
        $this->assertNull($calculated->cost_usd);
        $this->assertNull($calculated->cost_inr);
    }

    /**
     * Requirement 9: Missing exchange rate -> exchange_rate_missing, cost_usd preserved, cost_inr = null.
     */
    public function test_09_missing_exchange_rate_preserves_usd_and_leaves_inr_null(): void
    {
        // Date before any seeded exchange rates (e.g. 2025-06-01)
        $oldDate = Carbon::parse('2025-06-01 10:00:00');

        $request = $this->createSampleRequest([
            'started_at' => $oldDate,
            'completed_at' => $oldDate->copy()->addSecond(),
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
            'total_tokens' => 100000,
        ]);

        // Historical 2026-v1 is effective from 2026-01-01, create a test pricing for 2025 to test exchange rate absence
        AiModelPricing::create([
            'provider' => 'google',
            'model_identifier' => 'gemini-3.5-flash',
            'pricing_version' => '2025-test',
            'input_token_price_per_million' => 1.500000,
            'output_token_price_per_million' => 9.000000,
            'input_token_unit_price' => 0.0000015000,
            'output_token_unit_price' => 0.0000090000,
            'currency' => 'USD',
            'effective_from' => '2025-01-01 00:00:00',
            'is_active' => true,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('exchange_rate_missing', $calculated->cost_calculation_status);
        $this->assertEquals('0.150000', $calculated->cost_usd);
        $this->assertNull($calculated->cost_inr);
    }

    /**
     * Requirement 10: Confirmed zero-token requests -> no_usage, 0.000000.
     */
    public function test_10_confirmed_zero_token_requests(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'total_tokens' => 0,
        ]);

        // Attach an explicit usage detail confirming 0 tokens
        AiApiUsageDetail::create([
            'ai_api_request_id' => $request->id,
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'thoughts_tokens' => 0,
            'cached_content_tokens' => 0,
            'total_tokens' => 0,
            'raw_usage_metadata' => ['promptTokenCount' => 0, 'candidatesTokenCount' => 0, 'totalTokenCount' => 0],
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('no_usage', $calculated->cost_calculation_status);
        $this->assertEquals('0.000000', $calculated->cost_usd);
        $this->assertEquals('0.000000', $calculated->cost_inr);
    }

    /**
     * Requirement 11: Failed billable API requests -> calculated.
     */
    public function test_11_failed_billable_api_requests(): void
    {
        // An API request that failed with HTTP 400 or 500, but Gemini returned tokens consumed
        $request = $this->createSampleRequest([
            'status' => 'failed',
            'http_status' => 400,
            'error_code' => 'INVALID_ARGUMENT',
            'error_message' => 'Malformed card image content',
            'prompt_tokens' => 50000,
            'candidates_tokens' => 0,
            'total_tokens' => 50000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('calculated', $calculated->cost_calculation_status);
        // 50,000 * 1.50 / 1M = 0.075000 USD
        $this->assertEquals('0.075000', $calculated->cost_usd);
        $this->assertNotNull($calculated->cost_inr);
    }

    /**
     * Requirement 12: NULL INR cost when exchange rate unavailable (never silently 0.000000).
     */
    public function test_12_null_inr_cost_when_exchange_rate_unavailable(): void
    {
        // Create an isolated request without applicable exchange rate
        AiCostExchangeRate::query()->update(['is_active' => false]);

        $request = $this->createSampleRequest([
            'prompt_tokens' => 20000,
            'candidates_tokens' => 10000,
            'total_tokens' => 30000,
        ]);

        $calculated = $this->costService->calculateAndPersist($request);

        $this->assertNotNull($calculated);
        $this->assertEquals('exchange_rate_missing', $calculated->cost_calculation_status);
        $this->assertNotNull($calculated->cost_usd);
        $this->assertNull($calculated->cost_inr);
        $this->assertNotEquals('0.000000', $calculated->cost_inr);
    }

    /**
     * Requirement 13: Historical pricing preservation.
     */
    public function test_13_historical_pricing_preservation(): void
    {
        // Verify 2026-v1 baseline exists alongside 2026-v2
        $v1Count = AiModelPricing::where('pricing_version', '2026-v1')->count();
        $v2Count = AiModelPricing::where('pricing_version', '2026-v2')->count();

        $this->assertGreaterThan(0, $v1Count);
        $this->assertGreaterThan(0, $v2Count);

        // A request specifically processed under 2026-v1 retains its exact pricing version
        $historical = $this->createSampleRequest([
            'pricing_version' => '2026-v1',
            'cost_usd' => '0.007500',
            'cost_inr' => '0.648750',
            'cost_calculation_status' => 'calculated',
        ]);

        // Default recalculate without force does NOT overwrite historical values
        $result = $this->costService->calculateAndPersist($historical, force: false);
        $this->assertEquals('2026-v1', $result->pricing_version);
        $this->assertEquals('0.007500', $result->cost_usd);
    }

    /**
     * Requirement 14: Historical exchange-rate selection.
     */
    public function test_14_historical_exchange_rate_selection(): void
    {
        // 1. Request dated 2026-01-02 -> picks baseline system rate (86.5000)
        $earlyRate = $this->costService->findApplicableExchangeRate('2026-01-02 10:00:00', 'USD', 'INR');
        $this->assertNotNull($earlyRate);
        $this->assertEquals('86.5000', (string) $earlyRate->exchange_rate);
        $this->assertEquals('system', $earlyRate->source);

        // 2. Request dated 2026-01-06 -> picks FBIL reference rate (89.4600)
        $fbilRate = $this->costService->findApplicableExchangeRate('2026-01-06 10:00:00', 'USD', 'INR');
        $this->assertNotNull($fbilRate);
        $this->assertEquals('89.4600', (string) $fbilRate->exchange_rate);
        $this->assertEquals('fbil_reference', $fbilRate->source);
    }

    /**
     * Requirement 15: Safe forced recalculation and audit logging.
     */
    public function test_15_safe_forced_recalculation_and_audit_logging(): void
    {
        $request = $this->createSampleRequest([
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
            'total_tokens' => 100000,
            'cost_usd' => '0.050000', // old incorrect cost
            'cost_inr' => '4.325000',
            'cost_calculation_status' => 'calculated',
        ]);

        // Without force: nothing changes
        $untouched = $this->costService->recalculate($request, force: false);
        $this->assertEquals('0.050000', $untouched->cost_usd);

        // With force: recalculates with 2026-v2 verified rate
        Log::shouldReceive('info')
            ->once()
            ->withArgs(function ($message, $context) use ($request) {
                return $message === 'AI API Request cost recalculated'
                    && $context['request_id'] === $request->id
                    && $context['old_cost_usd'] === '0.050000'
                    && $context['reason'] === 'Pricing model correction';
            });

        $recalculated = $this->costService->recalculate($request, force: true, reason: 'Pricing model correction');
        $this->assertNotNull($recalculated);
        $this->assertEquals('0.150000', $recalculated->cost_usd);
    }

    /**
     * Requirement 16: No impact on customer scan credits.
     */
    public function test_16_no_impact_on_customer_scan_credits(): void
    {
        $context = $this->createWorkspaceUser();
        $workspace = $context['workspace'];
        $user = $context['user'];

        $quotaService = app(ScanQuotaService::class);
        $initialQuota = $quotaService->getWorkspaceQuota($workspace);
        $initialRemaining = $initialQuota['remaining_credits'];
        $initialLedgerCount = ScanUsageLedger::count();

        // Perform multiple AI cost calculations and recalculations
        $req = $this->createSampleRequest([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'prompt_tokens' => 50000,
            'candidates_tokens' => 10000,
            'total_tokens' => 60000,
        ]);

        $this->costService->calculateAndPersist($req);
        $this->costService->recalculate($req, force: true, reason: 'Test verification');

        // Customer credit ledger must remain 100% untouched
        $postQuota = $quotaService->getWorkspaceQuota($workspace);
        $postRemaining = $postQuota['remaining_credits'];
        $postLedgerCount = ScanUsageLedger::count();

        $this->assertEquals($initialRemaining, $postRemaining);
        $this->assertEquals($initialLedgerCount, $postLedgerCount);
    }
}
