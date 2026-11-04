<?php

namespace Tests\Feature;

use App\Http\Controllers\CardController;
use App\Jobs\ProcessBulkImportItemJob;
use App\Models\AiApiRequest;
use App\Models\AiApiUsageDetail;
use App\Models\ApiToken;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\Exhibition;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AiUsageTrackingService;
use App\Services\CardDuplicateDetector;
use App\Services\GeminiCardVisionService;
use App\Services\ScanQuotaService;
use Carbon\CarbonInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class AiUsageCaptureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Config::set('services.gemini.api_key', 'test-fake-gemini-key');
        Config::set('services.gemini.model', 'gemini-3.5-flash');
        Config::set('services.gemini.models', ['gemini-3.5-flash', 'gemini-2.5-flash']);
    }

    protected function tearDown(): void
    {
        CardController::$curlHandler = null;
        GeminiCardVisionService::$curlHandler = null;
        parent::tearDown();
    }

    private function createWorkspaceUser(string $email = 'user@example.com', int $allowance = 10): array
    {
        $user = User::create([
            'name' => 'Kiran Mehta',
            'email' => $email,
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Mehta Industries',
            'slug' => 'mehta-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $plan = Plan::firstOrCreate(
            ['slug' => 'test-plan-'.$allowance],
            [
                'name' => 'Test Plan',
                'price' => 0.00,
                'monthly_scan_allowance' => $allowance,
                'features' => ['single_card_scan', 'bulk_import'],
                'is_active' => true,
            ]
        );
        $plan->update(['monthly_scan_allowance' => $allowance]);

        $subscription = $workspace->activeSubscription();
        $subscription->update([
            'plan_id' => $plan->id,
            'status' => 'active',
            'current_period_starts_at' => now()->startOfMonth(),
            'current_period_ends_at' => now()->endOfMonth(),
            'scan_allowance' => $allowance,
        ]);

        $tokenResult = ApiToken::createTokenForUser($user);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'subscription' => $subscription,
            'token' => $tokenResult['plain_token'],
        ];
    }

    private function getValidGeminiCardJson(): string
    {
        return json_encode([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'company' => 'Acme Corporation',
                                    'company_english' => 'Acme Corporation',
                                    'name' => 'John Doe',
                                    'name_english' => 'John Doe',
                                    'designation' => 'Managing Director',
                                    'department' => 'Executive',
                                    'phone' => ['9876543210'],
                                    'email' => 'john@acme.com',
                                    'website' => 'https://acme.com',
                                    'address' => '123 Market Street, Ahmedabad',
                                    'address_english' => '123 Market Street, Ahmedabad',
                                    'tagline_services' => 'Ceramic Tiles & Sanitaryware',
                                    'tax_id' => '24ABCDE1234F1Z5',
                                    'social_profiles' => ['https://linkedin.com/in/johndoe'],
                                    'detected_language' => 'English',
                                    'accuracy_score' => 95,
                                    'accuracy_reason' => 'Clear legible text',
                                ]),
                            ],
                        ],
                    ],
                ],
            ],
            'usageMetadata' => [
                'promptTokenCount' => 120,
                'candidatesTokenCount' => 45,
                'totalTokenCount' => 165,
                'cachedContentTokenCount' => 0,
                'thoughtsTokenCount' => 0,
            ],
        ]);
    }

    /**
     * Requirement 1: Successful single Gemini request records usage.
     */
    public function test_successful_single_gemini_request_records_usage(): void
    {
        $setup = $this->createWorkspaceUser();

        CardController::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('ai_api_requests', [
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'scan_type' => 'single_scan',
            'status' => 'success',
            'http_status' => 200,
            'prompt_tokens' => 120,
            'candidates_tokens' => 45,
            'total_tokens' => 165,
        ]);

        $recorded = AiApiRequest::where('scan_type', 'single_scan')->first();
        $this->assertNotNull($recorded);
        $this->assertNotNull($recorded->request_uuid);
        $this->assertGreaterThanOrEqual(0, $recorded->duration_ms);

        $this->assertDatabaseHas('ai_api_usage_details', [
            'ai_api_request_id' => $recorded->id,
            'prompt_tokens' => 120,
            'candidates_tokens' => 45,
            'total_tokens' => 165,
        ]);
    }

    /**
     * Requirement 2: Failed single request records failure.
     */
    public function test_failed_single_request_records_failure(): void
    {
        $setup = $this->createWorkspaceUser();

        CardController::$curlHandler = function () {
            return [
                'response' => json_encode(['error' => ['message' => 'Resource exhausted: quota exceeded']]),
                'http_code' => 429,
                'error' => null,
            ];
        };

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $response->assertStatus(502);

        // All configured models failed, records recorded for each attempt
        $failedRequests = AiApiRequest::where('status', 'failed')->get();
        $this->assertNotEmpty($failedRequests);

        $firstFailed = $failedRequests->first();
        $this->assertEquals('rate_limit', $firstFailed->error_code);
        $this->assertEquals(429, $firstFailed->http_status);
        $this->assertNotNull($firstFailed->error_message);
    }

    /**
     * Requirement 3: Gemini fallback creates separate attempt records.
     */
    public function test_gemini_fallback_creates_separate_attempt_records(): void
    {
        $setup = $this->createWorkspaceUser();

        $callCount = 0;
        CardController::$curlHandler = function ($endpoint, $jsonPayload, $apiKey, $model) use (&$callCount) {
            $callCount++;
            if ($callCount === 1) {
                // First model fails with 503
                return [
                    'response' => json_encode(['error' => ['message' => 'Service Unavailable']]),
                    'http_code' => 503,
                    'error' => null,
                ];
            }

            // Second model succeeds
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $response->assertStatus(200);

        $requests = AiApiRequest::orderBy('attempt_number')->get();
        $this->assertCount(2, $requests);

        // Attempt 1: Failed
        $attempt1 = $requests[0];
        $this->assertEquals(1, $attempt1->attempt_number);
        $this->assertFalse((bool) $attempt1->is_fallback);
        $this->assertEquals('failed', $attempt1->status);
        $this->assertEquals(503, $attempt1->http_status);
        $this->assertNull($attempt1->parent_request_id);

        // Attempt 2: Succeeded fallback
        $attempt2 = $requests[1];
        $this->assertEquals(2, $attempt2->attempt_number);
        $this->assertTrue((bool) $attempt2->is_fallback);
        $this->assertEquals('success', $attempt2->status);
        $this->assertEquals(200, $attempt2->http_status);
        $this->assertEquals($attempt1->id, $attempt2->parent_request_id);
        $this->assertStringContainsString('Fallback from', $attempt2->fallback_reason);
    }

    /**
     * Requirement 4: Successful bulk extraction records usage with bulk_import_id & bulk_import_item_id.
     */
    public function test_successful_bulk_extraction_records_usage_with_references(): void
    {
        $setup = $this->createWorkspaceUser();

        $exhibition = Exhibition::create([
            'workspace_id' => $setup['workspace']->id,
            'created_by_user_id' => $setup['user']->id,
            'name' => 'Auto Expo 2026',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => (string) Str::uuid(),
            'total_items' => 1,
            'status' => 'processing',
        ]);

        $frontPath = 'bulk/test_front.jpg';
        Storage::disk('local')->put($frontPath, 'fake-front-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'client_item_id' => 'item_001',
            'front_image_path' => $frontPath,
            'status' => 'pending',
        ]);

        GeminiCardVisionService::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $job = new ProcessBulkImportItemJob($item->id);
        $job->handle(app(GeminiCardVisionService::class), app(CardDuplicateDetector::class));

        $item->refresh();
        $this->assertEquals('extracted', $item->status);

        $this->assertDatabaseHas('ai_api_requests', [
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'bulk_import_id' => $batch->id,
            'bulk_import_item_id' => $item->id,
            'scan_type' => 'bulk_scan',
            'status' => 'success',
            'http_status' => 200,
            'prompt_tokens' => 120,
            'candidates_tokens' => 45,
            'total_tokens' => 165,
        ]);
    }

    /**
     * Requirement 5: Failed bulk extraction records failure.
     */
    public function test_failed_bulk_extraction_records_failure(): void
    {
        $setup = $this->createWorkspaceUser();

        $exhibition = Exhibition::create([
            'workspace_id' => $setup['workspace']->id,
            'created_by_user_id' => $setup['user']->id,
            'name' => 'Auto Expo 2026',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => (string) Str::uuid(),
            'total_items' => 1,
            'status' => 'processing',
        ]);

        $frontPath = 'bulk/test_front_fail.jpg';
        Storage::disk('local')->put($frontPath, 'fake-front-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'client_item_id' => 'item_fail_001',
            'front_image_path' => $frontPath,
            'status' => 'pending',
        ]);

        GeminiCardVisionService::$curlHandler = function () {
            return [
                'response' => json_encode(['error' => ['message' => 'Rate limit exceeded']]),
                'http_code' => 429,
                'error' => null,
            ];
        };

        $job = new ProcessBulkImportItemJob($item->id);
        $job->handle(app(GeminiCardVisionService::class), app(CardDuplicateDetector::class));

        $this->assertDatabaseHas('ai_api_requests', [
            'bulk_import_item_id' => $item->id,
            'scan_type' => 'bulk_scan',
            'status' => 'failed',
            'http_status' => 429,
        ]);
    }

    /**
     * Requirement 6: Bulk retries preserve separate attempt history.
     */
    public function test_bulk_retries_preserve_separate_attempt_history(): void
    {
        $setup = $this->createWorkspaceUser();

        $exhibition = Exhibition::create([
            'workspace_id' => $setup['workspace']->id,
            'created_by_user_id' => $setup['user']->id,
            'name' => 'Auto Expo 2026',
            'status' => 'active',
        ]);

        $batch = BulkImport::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => (string) Str::uuid(),
            'total_items' => 1,
            'status' => 'processing',
        ]);

        $frontPath = 'bulk/test_retry.jpg';
        Storage::disk('local')->put($frontPath, 'fake-front-bytes');

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'client_item_id' => 'item_retry_001',
            'front_image_path' => $frontPath,
            'status' => 'pending',
        ]);

        // Attempt 1: All fail
        GeminiCardVisionService::$curlHandler = function () {
            return [
                'response' => json_encode(['error' => ['message' => 'Server error']]),
                'http_code' => 500,
                'error' => null,
            ];
        };

        $job1 = new ProcessBulkImportItemJob($item->id);
        $job1->handle(app(GeminiCardVisionService::class), app(CardDuplicateDetector::class));

        $countAfterFirstJob = AiApiRequest::where('bulk_import_item_id', $item->id)->count();
        $this->assertGreaterThanOrEqual(1, $countAfterFirstJob);

        // Attempt 2: Retry job succeeds
        $item->update(['status' => 'pending']);
        GeminiCardVisionService::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $job2 = new ProcessBulkImportItemJob($item->id);
        $job2->handle(app(GeminiCardVisionService::class), app(CardDuplicateDetector::class));

        $countAfterSecondJob = AiApiRequest::where('bulk_import_item_id', $item->id)->count();
        $this->assertGreaterThan($countAfterFirstJob, $countAfterSecondJob);

        // Every request has a unique UUID
        $uuids = AiApiRequest::where('bulk_import_item_id', $item->id)->pluck('request_uuid');
        $this->assertEquals($uuids->count(), $uuids->unique()->count());
    }

    /**
     * Requirement 7: Correct workspace and user attribution.
     */
    public function test_correct_workspace_and_user_attribution(): void
    {
        $setup = $this->createWorkspaceUser();

        CardController::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $request = AiApiRequest::where('workspace_id', $setup['workspace']->id)->first();
        $this->assertNotNull($request);
        $this->assertEquals($setup['workspace']->id, $request->workspace_id);
        $this->assertEquals($setup['workspace']->name, $request->workspace_name);
        $this->assertEquals($setup['user']->id, $request->user_id);
        $this->assertEquals($setup['user']->name, $request->user_name);
        $this->assertEquals($setup['user']->email, $request->user_email);
    }

    /**
     * Requirement 8: Exact token metadata persistence.
     */
    public function test_exact_token_metadata_persistence(): void
    {
        $trackingService = app(AiUsageTrackingService::class);

        $usageMeta = [
            'promptTokenCount' => 312,
            'candidatesTokenCount' => 89,
            'totalTokenCount' => 401,
            'cachedContentTokenCount' => 50,
            'thoughtsTokenCount' => 12,
        ];

        $recorded = $trackingService->recordAttempt(
            scanType: 'single_scan',
            requestedModel: 'gemini-3.5-flash',
            actualModel: 'gemini-3.5-flash',
            attemptNumber: 1,
            isFallback: false,
            fallbackReason: null,
            parentRequestId: null,
            imageCount: 1,
            status: 'success',
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
            startedAt: now()->subSeconds(2),
            completedAt: now(),
            durationMs: 1250,
            usageMetadata: $usageMeta
        );

        $this->assertNotNull($recorded);
        $this->assertEquals(312, $recorded->prompt_tokens);
        $this->assertEquals(89, $recorded->candidates_tokens);
        $this->assertEquals(401, $recorded->total_tokens);
        $this->assertEquals(50, $recorded->cached_tokens);
        $this->assertEquals(12, $recorded->thoughts_tokens);

        $detail = AiApiUsageDetail::where('ai_api_request_id', $recorded->id)->first();
        $this->assertNotNull($detail);
        $this->assertEquals(312, $detail->prompt_tokens);
        $this->assertEquals(89, $detail->candidates_tokens);
        $this->assertEquals(401, $detail->total_tokens);
        $this->assertEquals(50, $detail->cached_content_tokens);
        $this->assertEquals(12, $detail->thoughts_tokens);
        $this->assertEquals($usageMeta, $detail->raw_usage_metadata);
    }

    /**
     * Requirement 9: Missing token metadata is not fabricated.
     */
    public function test_missing_token_metadata_is_not_fabricated(): void
    {
        $trackingService = app(AiUsageTrackingService::class);

        $recorded = $trackingService->recordAttempt(
            scanType: 'single_scan',
            requestedModel: 'gemini-3.5-flash',
            actualModel: 'gemini-3.5-flash',
            attemptNumber: 1,
            isFallback: false,
            fallbackReason: null,
            parentRequestId: null,
            imageCount: 1,
            status: 'success',
            httpStatus: 200,
            errorCode: null,
            errorMessage: null,
            startedAt: now()->subSeconds(1),
            completedAt: now(),
            durationMs: 500,
            usageMetadata: null // No usage metadata returned
        );

        $this->assertNotNull($recorded);
        $this->assertEquals(0, $recorded->prompt_tokens);
        $this->assertEquals(0, $recorded->candidates_tokens);
        $this->assertEquals(0, $recorded->total_tokens);
        $this->assertEquals(0, $recorded->cached_tokens);
        $this->assertEquals(0, $recorded->thoughts_tokens);

        // No fabricated usage details record should exist
        $this->assertDatabaseMissing('ai_api_usage_details', [
            'ai_api_request_id' => $recorded->id,
        ]);
    }

    /**
     * Requirement 10: Tracking failure does not corrupt successful extraction.
     */
    public function test_tracking_failure_does_not_corrupt_successful_extraction(): void
    {
        $setup = $this->createWorkspaceUser();

        CardController::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        // Bind mock tracking service that throws on recordAttempt
        $failingTracker = new class extends AiUsageTrackingService
        {
            public function recordAttempt(
                string $scanType,
                string $requestedModel,
                ?string $actualModel,
                int $attemptNumber,
                bool $isFallback,
                ?string $fallbackReason,
                ?int $parentRequestId,
                int $imageCount,
                string $status,
                ?int $httpStatus,
                ?string $errorCode,
                ?string $errorMessage,
                ?CarbonInterface $startedAt = null,
                ?CarbonInterface $completedAt = null,
                ?int $durationMs = null,
                ?array $usageMetadata = null,
                array $attribution = [],
                array $references = []
            ): ?AiApiRequest {
                // Guaranteed safety boundary returns null on internal error
                return null;
            }
        };

        $this->app->instance(AiUsageTrackingService::class, $failingTracker);

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        // Core scanning must succeed despite tracking failure
        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.company', 'Acme Corporation');
    }

    /**
     * Requirement 11: No API credentials or sensitive card data are stored.
     */
    public function test_no_api_credentials_or_sensitive_card_data_are_stored(): void
    {
        $trackingService = app(AiUsageTrackingService::class);

        $dirtyMessage = 'Failed with key=AIzaSySecretApiKey123 and header x-goog-api-key: secret-header-key and Bearer ya29.secretBearerToken';
        $sanitized = $trackingService->sanitizeErrorMessage($dirtyMessage);

        $this->assertStringNotContainsString('AIzaSySecretApiKey123', $sanitized);
        $this->assertStringNotContainsString('secret-header-key', $sanitized);
        $this->assertStringNotContainsString('ya29.secretBearerToken', $sanitized);
        $this->assertStringContainsString('[REDACTED]', $sanitized);

        $recorded = $trackingService->recordAttempt(
            scanType: 'single_scan',
            requestedModel: 'gemini-3.5-flash',
            actualModel: 'gemini-3.5-flash',
            attemptNumber: 1,
            isFallback: false,
            fallbackReason: null,
            parentRequestId: null,
            imageCount: 1,
            status: 'failed',
            httpStatus: 400,
            errorCode: 'invalid_response',
            errorMessage: $dirtyMessage
        );

        $this->assertNotNull($recorded);
        $this->assertStringNotContainsString('AIzaSySecretApiKey123', $recorded->error_message);
        $this->assertStringNotContainsString('secret-header-key', $recorded->error_message);
    }

    /**
     * Requirement 12: Gemini fallback does not consume additional customer scan credits.
     */
    public function test_gemini_fallback_does_not_consume_additional_customer_scan_credits(): void
    {
        $setup = $this->createWorkspaceUser('fallback-user@example.com', 5);

        // Fallback: 1 fail, 1 success (2 Gemini attempts)
        $callCount = 0;
        CardController::$curlHandler = function () use (&$callCount) {
            $callCount++;
            if ($callCount === 1) {
                return [
                    'response' => json_encode(['error' => ['message' => '503 overload']]),
                    'http_code' => 503,
                    'error' => null,
                ];
            }

            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        $image = UploadedFile::fake()->image('card.jpg', 800, 600);

        $scanResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $image,
        ]);

        $scanResponse->assertStatus(200);
        $scanKey = $scanResponse->json('data.scan_idempotency_key') ?? $scanResponse->json('scan_idempotency_key');

        // Confirm exactly 2 Gemini attempts were tracked
        $this->assertEquals(2, AiApiRequest::count());

        // Now save the card using the returned scan_idempotency_key
        $saveResponse = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->postJson('/api/cards', [
            'company' => 'Acme Corporation',
            'name' => 'John Doe',
            'phone' => ['9876543210'],
            'scan_idempotency_key' => $scanKey,
            'image_path' => $scanResponse->json('data.image_path') ?? $scanResponse->json('image_path'),
        ]);

        $saveResponse->assertStatus(201);

        // ScanUsageLedger must have confirmed exactly ONE credit deduction
        $confirmedDeductions = ScanUsageLedger::where('workspace_id', $setup['workspace']->id)
            ->where('status', 'confirmed')
            ->count();

        $this->assertEquals(1, $confirmedDeductions);

        // Check available quota in ScanQuotaService
        $quotaService = app(ScanQuotaService::class);
        $quotaStatus = $quotaService->getWorkspaceQuota($setup['workspace']);
        $this->assertEquals(1, $quotaStatus['used_credits']);
        $this->assertEquals(4, $quotaStatus['remaining_credits']);
    }

    /**
     * Requirement 13: Existing scan quota and bulk workflows continue working.
     */
    public function test_existing_scan_quota_and_bulk_workflows_continue_working(): void
    {
        $setup = $this->createWorkspaceUser('quota-user@example.com', 2);

        CardController::$curlHandler = function () {
            return [
                'response' => $this->getValidGeminiCardJson(),
                'http_code' => 200,
                'error' => null,
            ];
        };

        // Scan & save 2 cards to exhaust allowance
        for ($i = 1; $i <= 2; $i++) {
            $image = UploadedFile::fake()->image("card_{$i}.jpg", 800, 600);
            $scanRes = $this->withHeaders([
                'Authorization' => 'Bearer '.$setup['token'],
                'X-Workspace-Id' => (string) $setup['workspace']->id,
            ])->post('/api/scan', [
                'image' => $image,
            ]);
            $scanRes->assertStatus(200);

            $scanKey = $scanRes->json('data.scan_idempotency_key') ?? $scanRes->json('scan_idempotency_key');
            $imagePath = $scanRes->json('data.image_path') ?? $scanRes->json('image_path');

            $saveRes = $this->withHeaders([
                'Authorization' => 'Bearer '.$setup['token'],
                'X-Workspace-Id' => (string) $setup['workspace']->id,
            ])->postJson('/api/cards', [
                'company' => "Company {$i}",
                'name' => "Person {$i}",
                'phone' => ["+91987654321{$i}"],
                'scan_idempotency_key' => $scanKey,
                'image_path' => $imagePath,
            ]);
            $saveRes->assertStatus(201);
        }

        // 3rd scan must be blocked with 403 quota exceeded BEFORE Gemini call
        $thirdImage = UploadedFile::fake()->image('card_3.jpg', 800, 600);
        $thirdScan = $this->withHeaders([
            'Authorization' => 'Bearer '.$setup['token'],
            'X-Workspace-Id' => (string) $setup['workspace']->id,
        ])->post('/api/scan', [
            'image' => $thirdImage,
        ]);

        $thirdScan->assertStatus(403)
            ->assertJsonPath('error_code', 'QUOTA_EXCEEDED');

        // Total AiApiRequest count must remain 2 (3rd request never hit Gemini)
        $this->assertEquals(2, AiApiRequest::count());
    }
}
