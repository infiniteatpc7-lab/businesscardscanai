<?php

namespace Tests\Feature;

use App\Models\AiApiRequest;
use App\Models\AiApiUsageDetail;
use App\Models\ApiToken;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\User;
use App\Models\Workspace;
use Database\Seeders\AiPricingSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminAiCostDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(AiPricingSeeder::class);
    }

    /**
     * Helper to create a platform admin with an active token.
     */
    private function createPlatformAdmin(): array
    {
        $admin = PlatformAdmin::create([
            'name' => 'Platform Operator',
            'email' => 'operator.'.uniqid().'@businesscardscan.ai',
            'password' => Hash::make('AdminPass123!'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin);

        return [
            'admin' => $admin,
            'token' => $tokenResult['token'],
        ];
    }

    /**
     * Helper to create a customer user with workspace and token.
     */
    private function createCustomer(): array
    {
        $user = User::create([
            'name' => 'Test Customer',
            'email' => 'cust.'.uniqid().'@example.com',
            'password' => Hash::make('CustPass123!'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Customer WS',
            'slug' => 'ws-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $tokenResult = ApiToken::createTokenForUser($user);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
        ];
    }

    /**
     * Helper to create sample AI API requests.
     */
    private function createSampleAiRequest(array $overrides = []): AiApiRequest
    {
        return AiApiRequest::create(array_merge([
            'scan_type' => 'single_scan',
            'request_uuid' => Str::uuid()->toString(),
            'idempotency_key' => 'idemp_'.Str::random(16),
            'requested_model' => 'gemini-3.5-flash',
            'actual_model' => 'gemini-3.5-flash',
            'attempt_number' => 1,
            'is_fallback' => false,
            'image_count' => 1,
            'status' => 'success',
            'http_status' => 200,
            'started_at' => Carbon::parse('2026-01-10 10:00:00'),
            'completed_at' => Carbon::parse('2026-01-10 10:00:01'),
            'created_at' => Carbon::parse('2026-01-10 10:00:00'),
            'duration_ms' => 650,
            'prompt_tokens' => 1000,
            'candidates_tokens' => 200,
            'thoughts_tokens' => 0,
            'cached_tokens' => 0,
            'total_tokens' => 1200,
            'cost_usd' => '0.003300',
            'cost_inr' => '0.295218',
            'cost_calculation_status' => 'calculated',
            'cost_calculated_at' => Carbon::parse('2026-01-10 10:00:01'),
            'pricing_version' => '2026-v2',
            'exchange_rate' => '89.4600',
        ], $overrides));
    }

    /**
     * Test 1: Unauthenticated request is rejected.
     */
    public function test_01_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/platform-admin/ai-costs/requests');
        $response->assertStatus(401);
    }

    /**
     * Test 2: Customer token cannot access platform admin AI cost routes.
     */
    public function test_02_customer_token_cannot_access_platform_admin_ai_cost_routes(): void
    {
        $customer = $this->createCustomer();

        $response = $this->withHeader('Authorization', 'Bearer '.$customer['token'])
            ->getJson('/api/platform-admin/ai-costs/requests');

        $response->assertStatus(401);
    }

    /**
     * Test 3: Platform admin can access AI usage and cost summary with requests list.
     */
    public function test_03_platform_admin_can_access_ai_cost_requests_and_summary(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer();

        $this->createSampleAiRequest([
            'workspace_id' => $customer['workspace']->id,
            'user_id' => $customer['user']->id,
            'prompt_tokens' => 5000,
            'candidates_tokens' => 1000,
            'total_tokens' => 6000,
            'cost_usd' => '0.016500',
            'cost_inr' => '1.476090',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'summary' => [
                    'total_requests',
                    'successful_requests',
                    'failed_requests',
                    'pending_requests',
                    'total_tokens',
                    'prompt_tokens',
                    'candidates_tokens',
                    'cached_tokens',
                    'thoughts_tokens',
                    'total_cost_usd',
                    'total_cost_inr',
                    'null_cost_count',
                    'no_usage_count',
                ],
                'requests' => [
                    '*' => [
                        'id',
                        'request_uuid',
                        'scan_type',
                        'status',
                        'requested_model',
                        'actual_model',
                        'total_tokens',
                        'image_count',
                        'cost_usd',
                        'cost_inr',
                        'estimated_cost_per_image_usd',
                        'cost_calculation_status',
                    ],
                ],
                'pagination',
            ]);

        $this->assertEquals(1, $response->json('summary.total_requests'));
        $this->assertEquals(6000, $response->json('summary.total_tokens'));
        $this->assertEquals('0.016500', $response->json('summary.total_cost_usd'));
    }

    /**
     * Test 4: Filtering by date presets (today, 7d, 30d).
     */
    public function test_04_filtering_by_date_presets(): void
    {
        $admin = $this->createPlatformAdmin();

        // 1 request today
        $reqToday = $this->createSampleAiRequest([
            'total_tokens' => 500,
            'cost_usd' => '0.001000',
            'cost_inr' => '0.089460',
        ]);
        $reqToday->created_at = now();
        $reqToday->saveQuietly();

        // 1 request 10 days ago
        $reqPast = $this->createSampleAiRequest([
            'total_tokens' => 1500,
            'cost_usd' => '0.003000',
            'cost_inr' => '0.268380',
        ]);
        $reqPast->created_at = now()->subDays(10);
        $reqPast->saveQuietly();

        // Filter: today -> only 1 request
        $todayRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?date_preset=today');

        $todayRes->assertStatus(200);
        $this->assertEquals(1, $todayRes->json('summary.total_requests'));
        $this->assertEquals(500, $todayRes->json('summary.total_tokens'));

        // Filter: 7d -> only 1 request (today)
        $sevenDaysRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?date_preset=7d');

        $sevenDaysRes->assertStatus(200);
        $this->assertEquals(1, $sevenDaysRes->json('summary.total_requests'));

        // Filter: 30d -> both requests
        $thirtyDaysRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?date_preset=30d');

        $thirtyDaysRes->assertStatus(200);
        $this->assertEquals(2, $thirtyDaysRes->json('summary.total_requests'));
        $this->assertEquals(2000, $thirtyDaysRes->json('summary.total_tokens'));
    }

    /**
     * Test 5: Filtering by workspace and customer.
     */
    public function test_05_filtering_by_workspace_and_customer(): void
    {
        $admin = $this->createPlatformAdmin();
        $customerA = $this->createCustomer();
        $customerB = $this->createCustomer();

        $this->createSampleAiRequest([
            'workspace_id' => $customerA['workspace']->id,
            'user_id' => $customerA['user']->id,
            'total_tokens' => 1000,
        ]);

        $this->createSampleAiRequest([
            'workspace_id' => $customerB['workspace']->id,
            'user_id' => $customerB['user']->id,
            'total_tokens' => 2000,
        ]);

        // Filter by workspace A
        $resA = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?workspace_id='.$customerA['workspace']->id);

        $resA->assertStatus(200);
        $this->assertEquals(1, $resA->json('summary.total_requests'));
        $this->assertEquals($customerA['workspace']->id, $resA->json('requests.0.workspace.id'));

        // Filter by user B
        $resB = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?user_id='.$customerB['user']->id);

        $resB->assertStatus(200);
        $this->assertEquals(1, $resB->json('summary.total_requests'));
        $this->assertEquals($customerB['user']->id, $resB->json('requests.0.user.id'));
    }

    /**
     * Test 6: Filtering by model, status, and scan type.
     */
    public function test_06_filtering_by_model_status_and_scan_type(): void
    {
        $admin = $this->createPlatformAdmin();

        $this->createSampleAiRequest([
            'requested_model' => 'gemini-3.5-flash',
            'actual_model' => 'gemini-3.5-flash',
            'scan_type' => 'single_scan',
            'status' => 'success',
        ]);

        $this->createSampleAiRequest([
            'requested_model' => 'gemini-3.5-flash-lite',
            'actual_model' => 'gemini-3.5-flash-lite',
            'scan_type' => 'bulk_scan',
            'status' => 'failed',
        ]);

        // Filter by model gemini-3.5-flash-lite
        $modelRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?model=gemini-3.5-flash-lite');
        $this->assertEquals(1, $modelRes->json('summary.total_requests'));
        $this->assertEquals('bulk_scan', $modelRes->json('requests.0.scan_type'));

        // Filter by status failed
        $statusRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?status=failed');
        $this->assertEquals(1, $statusRes->json('summary.total_requests'));
        $this->assertEquals('failed', $statusRes->json('requests.0.status'));

        // Filter by scan_type single_scan
        $scanTypeRes = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?scan_type=single_scan');
        $this->assertEquals(1, $scanTypeRes->json('summary.total_requests'));
        $this->assertEquals('gemini-3.5-flash', $scanTypeRes->json('requests.0.requested_model'));
    }

    /**
     * Test 7: Missing cost data returned as NULL, never as zero.
     */
    public function test_07_missing_cost_data_returned_as_null_never_zero(): void
    {
        $admin = $this->createPlatformAdmin();

        // Create request with missing usage metadata
        $missingReq = $this->createSampleAiRequest([
            'cost_usd' => null,
            'cost_inr' => null,
            'cost_calculation_status' => 'usage_metadata_missing',
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'total_tokens' => 0,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?cost_status=usage_metadata_missing');

        $res->assertStatus(200);
        $requestData = $res->json('requests.0');

        $this->assertNull($requestData['cost_usd']);
        $this->assertNull($requestData['cost_inr']);
        $this->assertNull($requestData['estimated_cost_per_image_usd']);
        $this->assertEquals('usage_metadata_missing', $requestData['cost_calculation_status']);
    }

    /**
     * Test 8: Confirmed zero-token requests returned as "0.000000".
     */
    public function test_08_confirmed_zero_token_requests_returned_as_exact_zero(): void
    {
        $admin = $this->createPlatformAdmin();

        $zeroReq = $this->createSampleAiRequest([
            'cost_usd' => '0.000000',
            'cost_inr' => '0.000000',
            'cost_calculation_status' => 'no_usage',
            'prompt_tokens' => 0,
            'candidates_tokens' => 0,
            'total_tokens' => 0,
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests?cost_status=no_usage');

        $res->assertStatus(200);
        $requestData = $res->json('requests.0');

        $this->assertEquals('0.000000', $requestData['cost_usd']);
        $this->assertEquals('0.000000', $requestData['cost_inr']);
        $this->assertEquals('no_usage', $requestData['cost_calculation_status']);
    }

    /**
     * Test 9: Estimated per-image cost displayed separately from actual request cost.
     */
    public function test_09_estimated_per_image_cost_displayed_separately(): void
    {
        $admin = $this->createPlatformAdmin();

        // 2-sided business card (front and back image scanned in a single Gemini request)
        $req = $this->createSampleAiRequest([
            'image_count' => 2,
            'cost_usd' => '0.006000',
            'cost_inr' => '0.536760',
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/requests');

        $res->assertStatus(200);
        $item = $res->json('requests.0');

        // Actual request cost
        $this->assertEquals('0.006000', $item['cost_usd']);
        $this->assertEquals('0.536760', $item['cost_inr']);

        // Estimated cost per image = total cost / 2
        $this->assertEquals('0.003000', $item['estimated_cost_per_image_usd']);
        $this->assertEquals('0.268380', $item['estimated_cost_per_image_inr']);
    }

    /**
     * Test 10: Request detail endpoint returns comprehensive breakdown.
     */
    public function test_10_request_detail_endpoint_returns_comprehensive_breakdown(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer();

        $req = $this->createSampleAiRequest([
            'workspace_id' => $customer['workspace']->id,
            'user_id' => $customer['user']->id,
            'prompt_tokens' => 1200,
            'candidates_tokens' => 300,
            'cached_tokens' => 200,
            'thoughts_tokens' => 50,
            'total_tokens' => 1500,
            'duration_ms' => 780,
        ]);

        // Attach usage detail
        AiApiUsageDetail::create([
            'ai_api_request_id' => $req->id,
            'prompt_tokens' => 1200,
            'candidates_tokens' => 300,
            'cached_content_tokens' => 200,
            'thoughts_tokens' => 50,
            'total_tokens' => 1500,
            'raw_usage_metadata' => [
                'promptTokenCount' => 1200,
                'candidatesTokenCount' => 300,
                'cachedContentTokenCount' => 200,
                'totalTokenCount' => 1500,
            ],
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson("/api/platform-admin/ai-costs/requests/{$req->id}");

        $res->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'request' => [
                    'id',
                    'request_uuid',
                    'tokens' => [
                        'prompt_tokens',
                        'candidates_tokens',
                        'cached_tokens',
                        'thoughts_tokens',
                        'total_tokens',
                        'non_cached_prompt_tokens',
                    ],
                    'raw_usage_metadata',
                    'workspace',
                    'user',
                    'cost_usd',
                    'cost_inr',
                    'estimated_cost_per_image_usd',
                ],
            ]);

        $data = $res->json('request');
        $this->assertEquals(1000, $data['tokens']['non_cached_prompt_tokens']);
        $this->assertNotNull($data['raw_usage_metadata']);
        $this->assertEquals($customer['workspace']->name, $data['workspace']['name']);
    }

    /**
     * Test 11: Filter options endpoint returns available dropdown values.
     */
    public function test_11_filter_options_endpoint(): void
    {
        $admin = $this->createPlatformAdmin();

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->getJson('/api/platform-admin/ai-costs/filter-options');

        $res->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'models',
                'workspaces',
                'users',
                'statuses',
                'scan_types',
                'cost_statuses',
                'date_presets',
            ]);

        $this->assertContains('gemini-3.5-flash', $res->json('models'));
    }

    /**
     * Test 12: On-demand cost recalculation endpoint.
     */
    public function test_12_on_demand_recalculation_endpoint(): void
    {
        $admin = $this->createPlatformAdmin();

        $req = $this->createSampleAiRequest([
            'prompt_tokens' => 100000,
            'candidates_tokens' => 0,
            'total_tokens' => 100000,
            'cost_usd' => '0.000100', // old wrong cost
            'cost_inr' => '0.008946',
            'cost_calculation_status' => 'calculated',
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$admin['token'])
            ->postJson("/api/platform-admin/ai-costs/requests/{$req->id}/recalculate");

        $res->assertStatus(200)
            ->assertJson([
                'success' => true,
                'message' => 'Cost successfully recalculated.',
            ]);

        // Rate for gemini-3.5-flash 2026-v2 input is $1.50/M -> 100k tokens = $0.150000
        $this->assertEquals('0.150000', $res->json('request.cost_usd'));
    }
}
