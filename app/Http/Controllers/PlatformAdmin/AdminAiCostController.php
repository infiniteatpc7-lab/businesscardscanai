<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\AiApiRequest;
use App\Models\AiModelPricing;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AiCostCalculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AdminAiCostController extends Controller
{
    /**
     * List AI API requests with summary metrics, pagination, and multi-dimensional filters.
     */
    public function index(Request $request, AiCostCalculationService $costService): JsonResponse
    {
        $baseQuery = AiApiRequest::query();

        // 1. Apply Date Range / Preset Filtering
        $datePreset = $request->input('date_preset');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        if ($datePreset && $datePreset !== 'all') {
            match ($datePreset) {
                'today' => $baseQuery->where('created_at', '>=', now()->startOfDay()),
                'yesterday' => $baseQuery->whereBetween('created_at', [
                    now()->subDay()->startOfDay(),
                    now()->subDay()->endOfDay(),
                ]),
                '7d' => $baseQuery->where('created_at', '>=', now()->subDays(7)->startOfDay()),
                '30d' => $baseQuery->where('created_at', '>=', now()->subDays(30)->startOfDay()),
                'this_month' => $baseQuery->where('created_at', '>=', now()->startOfMonth()),
                'last_month' => $baseQuery->whereBetween('created_at', [
                    now()->subMonth()->startOfMonth(),
                    now()->subMonth()->endOfMonth(),
                ]),
                default => null,
            };
        } elseif ($startDate || $endDate) {
            if ($startDate) {
                $baseQuery->where('created_at', '>=', Carbon::parse($startDate)->startOfDay());
            }
            if ($endDate) {
                $baseQuery->where('created_at', '<=', Carbon::parse($endDate)->endOfDay());
            }
        }

        // 2. Workspace Filter
        if ($workspaceId = $request->input('workspace_id')) {
            $baseQuery->where('workspace_id', (int) $workspaceId);
        }

        // 3. User Filter
        if ($userId = $request->input('user_id')) {
            $baseQuery->where('user_id', (int) $userId);
        }

        // 4. Model Filter
        if ($model = $request->input('model')) {
            $baseQuery->where(function ($q) use ($model) {
                $q->where('actual_model', $model)
                    ->orWhere('requested_model', $model);
            });
        }

        // 5. Status Filter (success | failed | pending)
        if ($status = $request->input('status')) {
            if ($status !== 'all') {
                $baseQuery->where('status', $status);
            }
        }

        // 6. Scan Type Filter (single_scan | bulk_scan)
        if ($scanType = $request->input('scan_type')) {
            if ($scanType !== 'all') {
                $baseQuery->where('scan_type', $scanType);
            }
        }

        // 7. Cost Calculation Status Filter
        if ($costStatus = $request->input('cost_status')) {
            if ($costStatus !== 'all') {
                $baseQuery->where('cost_calculation_status', $costStatus);
            }
        }

        // 8. General Search (UUID, error message, workspace name, user email)
        if ($search = trim((string) $request->input('search', ''))) {
            $baseQuery->where(function ($q) use ($search) {
                $q->where('request_uuid', 'like', "%{$search}%")
                    ->orWhere('idempotency_key', 'like', "%{$search}%")
                    ->orWhere('error_message', 'like', "%{$search}%")
                    ->orWhere('actual_model', 'like', "%{$search}%")
                    ->orWhereHas('workspace', function ($wq) use ($search) {
                        $wq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        // Calculate Summary Aggregates on the Filtered Query
        $summaryQuery = clone $baseQuery;
        $totalRequests = (int) $summaryQuery->count();
        $successfulRequests = (int) (clone $summaryQuery)->where('status', 'success')->count();
        $failedRequests = (int) (clone $summaryQuery)->where('status', 'failed')->count();
        $pendingRequests = (int) (clone $summaryQuery)->where('status', 'pending')->count();

        $tokenStats = (clone $summaryQuery)->selectRaw('
            SUM(total_tokens) as total_tokens,
            SUM(prompt_tokens) as prompt_tokens,
            SUM(candidates_tokens) as candidates_tokens,
            SUM(cached_tokens) as cached_tokens,
            SUM(thoughts_tokens) as thoughts_tokens
        ')->first();

        $totalCostUsdRaw = (clone $summaryQuery)->whereNotNull('cost_usd')->sum('cost_usd');
        $totalCostInrRaw = (clone $summaryQuery)->whereNotNull('cost_inr')->sum('cost_inr');

        $totalCostUsd = $costService->roundDecimal((string) ($totalCostUsdRaw ?? '0'), 6);
        $totalCostInr = $costService->roundDecimal((string) ($totalCostInrRaw ?? '0'), 6);

        $nullCostCount = (int) (clone $summaryQuery)->whereNull('cost_usd')->count();
        $noUsageCount = (int) (clone $summaryQuery)->where('cost_calculation_status', 'no_usage')->count();

        // Paginate Requests List
        $perPage = min(max((int) $request->input('per_page', 25), 5), 100);
        $paginator = $baseQuery->with([
            'workspace:id,name,slug',
            'user:id,name,email',
            'modelPricing:id,model_identifier,pricing_version,currency',
            'exchangeRate:id,exchange_rate,source',
        ])
            ->latest('id')
            ->paginate($perPage);

        $items = collect($paginator->items())->map(function (AiApiRequest $req) {
            return [
                'id' => $req->id,
                'request_uuid' => $req->request_uuid,
                'idempotency_key' => $req->idempotency_key,
                'scan_type' => $req->scan_type,
                'status' => $req->status,
                'http_status' => $req->http_status,
                'error_code' => $req->error_code,
                'error_message' => $req->error_message,
                'requested_model' => $req->requested_model,
                'actual_model' => $req->actual_model,
                'attempt_number' => $req->attempt_number,
                'is_fallback' => $req->is_fallback,
                'fallback_reason' => $req->fallback_reason,
                'parent_request_id' => $req->parent_request_id,
                'image_count' => $req->image_count,
                'duration_ms' => $req->duration_ms,
                'started_at' => $req->started_at?->toIso8601String(),
                'completed_at' => $req->completed_at?->toIso8601String(),
                'created_at' => $req->created_at?->toIso8601String(),

                // Tokens
                'prompt_tokens' => (int) $req->prompt_tokens,
                'candidates_tokens' => (int) $req->candidates_tokens,
                'cached_tokens' => (int) $req->cached_tokens,
                'thoughts_tokens' => (int) $req->thoughts_tokens,
                'total_tokens' => (int) $req->total_tokens,

                // Actual Costs (Preserve exact string, never display null as 0)
                'cost_usd' => $req->cost_usd !== null ? (string) $req->cost_usd : null,
                'cost_inr' => $req->cost_inr !== null ? (string) $req->cost_inr : null,

                // Estimated per-image cost (Separately labeled as an estimate)
                'estimated_cost_per_image_usd' => $req->estimatedCostPerImageUsd(),
                'estimated_cost_per_image_inr' => $req->estimatedCostPerImageInr(),

                // Calculation Metadata
                'cost_calculation_status' => $req->cost_calculation_status,
                'cost_calculated_at' => $req->cost_calculated_at?->toIso8601String(),
                'pricing_version' => $req->pricing_version,
                'exchange_rate' => $req->exchange_rate !== null ? (string) $req->exchange_rate : null,

                // Relations
                'workspace' => $req->workspace ? [
                    'id' => $req->workspace->id,
                    'name' => $req->workspace->name,
                    'slug' => $req->workspace->slug,
                ] : null,
                'user' => $req->user ? [
                    'id' => $req->user->id,
                    'name' => $req->user->name,
                    'email' => $req->user->email,
                ] : null,
            ];
        });

        return response()->json([
            'success' => true,
            'summary' => [
                'total_requests' => $totalRequests,
                'successful_requests' => $successfulRequests,
                'failed_requests' => $failedRequests,
                'pending_requests' => $pendingRequests,
                'total_tokens' => (int) ($tokenStats->total_tokens ?? 0),
                'prompt_tokens' => (int) ($tokenStats->prompt_tokens ?? 0),
                'candidates_tokens' => (int) ($tokenStats->candidates_tokens ?? 0),
                'cached_tokens' => (int) ($tokenStats->cached_tokens ?? 0),
                'thoughts_tokens' => (int) ($tokenStats->thoughts_tokens ?? 0),
                'total_cost_usd' => $totalCostUsd,
                'total_cost_inr' => $totalCostInr,
                'null_cost_count' => $nullCostCount,
                'no_usage_count' => $noUsageCount,
            ],
            'requests' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Retrieve complete details for an individual AI request attempt.
     */
    public function show(int $id): JsonResponse
    {
        $request = AiApiRequest::with([
            'workspace:id,name,slug,owner_id',
            'workspace.owner:id,name,email',
            'user:id,name,email',
            'usageDetail',
            'modelPricing',
            'exchangeRate',
            'cardScan:id,image_path,status',
            'card:id,company_name',
            'bulkImport:id,status,total_items,processed_items',
            'bulkImportItem:id,bulk_import_id,status,file_name',
            'parentRequest:id,request_uuid,requested_model,actual_model,status,cost_usd,cost_inr',
            'fallbackAttempts:id,parent_request_id,request_uuid,attempt_number,requested_model,actual_model,status,is_fallback,fallback_reason,cost_usd,cost_inr,cost_calculation_status,created_at',
        ])->find($id);

        if (! $request) {
            return response()->json([
                'success' => false,
                'message' => 'AI API request not found.',
            ], 404);
        }

        $usage = $request->usageDetail;
        $pricing = $request->modelPricing;
        $rate = $request->exchangeRate;

        return response()->json([
            'success' => true,
            'request' => [
                'id' => $request->id,
                'request_uuid' => $request->request_uuid,
                'idempotency_key' => $request->idempotency_key,
                'scan_type' => $request->scan_type,
                'status' => $request->status,
                'http_status' => $request->http_status,
                'error_code' => $request->error_code,
                'error_message' => $request->error_message,
                'requested_model' => $request->requested_model,
                'actual_model' => $request->actual_model,
                'attempt_number' => $request->attempt_number,
                'is_fallback' => $request->is_fallback,
                'fallback_reason' => $request->fallback_reason,
                'parent_request_id' => $request->parent_request_id,
                'image_count' => $request->image_count,
                'duration_ms' => $request->duration_ms,
                'started_at' => $request->started_at?->toIso8601String(),
                'completed_at' => $request->completed_at?->toIso8601String(),
                'created_at' => $request->created_at?->toIso8601String(),

                // Cost and Calculations
                'cost_usd' => $request->cost_usd !== null ? (string) $request->cost_usd : null,
                'cost_inr' => $request->cost_inr !== null ? (string) $request->cost_inr : null,
                'estimated_cost_per_image_usd' => $request->estimatedCostPerImageUsd(),
                'estimated_cost_per_image_inr' => $request->estimatedCostPerImageInr(),
                'cost_calculation_status' => $request->cost_calculation_status,
                'cost_calculated_at' => $request->cost_calculated_at?->toIso8601String(),
                'pricing_version' => $request->pricing_version,
                'exchange_rate' => $request->exchange_rate !== null ? (string) $request->exchange_rate : null,

                // Token Breakdown
                'tokens' => [
                    'prompt_tokens' => (int) $request->prompt_tokens,
                    'candidates_tokens' => (int) $request->candidates_tokens,
                    'cached_tokens' => (int) $request->cached_tokens,
                    'thoughts_tokens' => (int) $request->thoughts_tokens,
                    'total_tokens' => (int) $request->total_tokens,
                    'non_cached_prompt_tokens' => max(0, (int) $request->prompt_tokens - (int) $request->cached_tokens),
                    'non_thought_candidate_tokens' => max(0, (int) $request->candidates_tokens - (int) $request->thoughts_tokens),
                ],

                // Raw Gemini Usage Metadata
                'raw_usage_metadata' => $usage?->raw_usage_metadata,

                // Applied Model Pricing
                'applied_pricing' => $pricing ? [
                    'id' => $pricing->id,
                    'provider' => $pricing->provider,
                    'model_identifier' => $pricing->model_identifier,
                    'pricing_version' => $pricing->pricing_version,
                    'input_token_price_per_million' => (string) $pricing->input_token_price_per_million,
                    'output_token_price_per_million' => (string) $pricing->output_token_price_per_million,
                    'cached_input_token_price_per_million' => (string) $pricing->cached_input_token_price_per_million,
                    'thoughts_token_price_per_million' => (string) $pricing->thoughts_token_price_per_million,
                    'currency' => $pricing->currency,
                    'effective_from' => $pricing->effective_from?->toIso8601String(),
                    'notes' => $pricing->notes,
                ] : null,

                // Applied Exchange Rate
                'applied_exchange_rate' => $rate ? [
                    'id' => $rate->id,
                    'base_currency' => $rate->base_currency,
                    'target_currency' => $rate->target_currency,
                    'exchange_rate' => (string) $rate->exchange_rate,
                    'effective_date' => $rate->effective_date?->toDateString(),
                    'source' => $rate->source,
                    'notes' => $rate->notes,
                ] : null,

                // Related Entities
                'workspace' => $request->workspace ? [
                    'id' => $request->workspace->id,
                    'name' => $request->workspace->name,
                    'slug' => $request->workspace->slug,
                    'owner' => $request->workspace->owner ? [
                        'id' => $request->workspace->owner->id,
                        'name' => $request->workspace->owner->name,
                        'email' => $request->workspace->owner->email,
                    ] : null,
                ] : null,
                'user' => $request->user ? [
                    'id' => $request->user->id,
                    'name' => $request->user->name,
                    'email' => $request->user->email,
                ] : null,

                'card_scan_id' => $request->card_scan_id,
                'card_id' => $request->card_id,
                'bulk_import_id' => $request->bulk_import_id,
                'bulk_import_item_id' => $request->bulk_import_item_id,

                // Fallback & Retry Lineage
                'parent_request' => $request->parentRequest,
                'fallback_attempts' => $request->fallbackAttempts,
            ],
        ]);
    }

    /**
     * Return dynamic filter options for models, workspaces, and users.
     */
    public function filterOptions(): JsonResponse
    {
        $models = AiModelPricing::where('is_active', true)
            ->distinct()
            ->orderBy('model_identifier')
            ->pluck('model_identifier')
            ->all();

        // Also check if any models exist in requests table that aren't in active pricing
        $loggedModels = AiApiRequest::distinct()
            ->whereNotNull('actual_model')
            ->pluck('actual_model')
            ->all();

        $allModels = array_values(array_unique(array_filter(array_merge($models, $loggedModels))));

        $workspaces = Workspace::select('id', 'name', 'slug')
            ->orderBy('name')
            ->limit(100)
            ->get();

        $users = User::select('id', 'name', 'email')
            ->orderBy('name')
            ->limit(100)
            ->get();

        return response()->json([
            'success' => true,
            'models' => $allModels,
            'workspaces' => $workspaces,
            'users' => $users,
            'statuses' => ['success', 'failed', 'pending'],
            'scan_types' => ['single_scan', 'bulk_scan'],
            'cost_statuses' => [
                'calculated',
                'no_usage',
                'usage_metadata_missing',
                'pricing_missing',
                'exchange_rate_missing',
                'pending',
                'calculation_failed',
            ],
            'date_presets' => [
                ['id' => 'today', 'label' => 'Today'],
                ['id' => 'yesterday', 'label' => 'Yesterday'],
                ['id' => '7d', 'label' => 'Last 7 Days'],
                ['id' => '30d', 'label' => 'Last 30 Days'],
                ['id' => 'this_month', 'label' => 'This Month'],
                ['id' => 'all', 'label' => 'All Time'],
            ],
        ]);
    }

    /**
     * Trigger forced cost recalculation for an individual AI API request.
     */
    public function recalculate(int $id, AiCostCalculationService $costService): JsonResponse
    {
        $request = AiApiRequest::find($id);

        if (! $request) {
            return response()->json([
                'success' => false,
                'message' => 'AI API request not found.',
            ], 404);
        }

        $updated = $costService->recalculate($request, force: true, reason: 'Platform Admin manual recalculation');

        return response()->json([
            'success' => true,
            'message' => 'Cost successfully recalculated.',
            'request' => [
                'id' => $updated->id,
                'cost_usd' => $updated->cost_usd !== null ? (string) $updated->cost_usd : null,
                'cost_inr' => $updated->cost_inr !== null ? (string) $updated->cost_inr : null,
                'cost_calculation_status' => $updated->cost_calculation_status,
                'pricing_version' => $updated->pricing_version,
                'exchange_rate' => $updated->exchange_rate !== null ? (string) $updated->exchange_rate : null,
            ],
        ]);
    }
}
