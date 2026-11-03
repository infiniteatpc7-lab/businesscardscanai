<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessBulkImportItemJob;
use App\Models\BulkImport;
use App\Models\BulkImportItem;
use App\Models\Exhibition;
use App\Models\Workspace;
use App\Services\BulkCardSaveService;
use App\Services\CardImageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class BulkImportController extends Controller
{
    /**
     * List bulk import batches for current workspace.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $query = BulkImport::forWorkspace($workspace->id)
            ->with(['exhibition:id,name,status', 'user:id,name'])
            ->latest();

        if ($role === 'member') {
            $query->where('user_id', $user->id);
        }

        return response()->json([
            'success' => true,
            'batches' => $query->paginate(20),
        ]);
    }

    /**
     * Initialize a new bulk import batch (Idempotent by client_batch_uuid).
     */
    public function store(Request $request): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $validated = $request->validate([
            'exhibition_id' => 'required|integer',
            'expected_count' => 'nullable|integer|min:1|max:200',
            'client_batch_uuid' => 'nullable|string|max:64',
        ]);

        $exhibition = Exhibition::where('workspace_id', $workspace->id)->find($validated['exhibition_id']);
        if (! $exhibition) {
            return response()->json([
                'success' => false,
                'message' => 'Specified exhibition not found in this workspace.',
            ], 404);
        }

        if ($exhibition->isArchived()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot create bulk import for an archived exhibition.',
            ], 422);
        }

        $batchUuid = $validated['client_batch_uuid'] ?? (string) Str::uuid();

        // Idempotency: return existing draft/uploading batch if UUID already matches
        $existing = BulkImport::where('workspace_id', $workspace->id)
            ->where('batch_uuid', $batchUuid)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => true,
                'batch' => $existing->load(['exhibition:id,name,status']),
                'already_exists' => true,
            ]);
        }

        $batch = BulkImport::create([
            'workspace_id' => $workspace->id,
            'user_id' => $user->id,
            'exhibition_id' => $exhibition->id,
            'batch_uuid' => $batchUuid,
            'status' => 'draft',
            'total_items' => 0,
            'uploaded_items' => 0,
            'processed_items' => 0,
            'failed_items' => 0,
            'saved_items' => 0,
            'skipped_items' => 0,
            'max_batch_size' => $validated['expected_count'] ?? 100,
            'expires_at' => now()->addHours(48),
        ]);

        return response()->json([
            'success' => true,
            'batch' => $batch->load(['exhibition:id,name,status']),
        ], 201);
    }

    /**
     * Show single batch overview and current status.
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        return response()->json([
            'success' => true,
            'batch' => $batch->load(['exhibition:id,name,status', 'user:id,name']),
        ]);
    }

    /**
     * Upload an individual card photo into batch staging (Idempotent by client_item_id).
     */
    public function uploadItem(Request $request, string $uuid, CardImageService $imageService): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);
        $user = $request->user();

        if ($batch->isCancelled()) {
            return response()->json(['success' => false, 'message' => 'Batch has been cancelled.'], 422);
        }

        if ($batch->status === 'completed') {
            return response()->json(['success' => false, 'message' => 'Batch is already completed.'], 422);
        }

        $validated = $request->validate([
            'client_item_id' => 'required|string|max:64',
            'sequence_order' => 'nullable|integer|min:0',
        ]);

        $clientItemId = $validated['client_item_id'];

        // Idempotency: If item already staged, return existing without re-saving
        $existingItem = BulkImportItem::where('bulk_import_id', $batch->id)
            ->where('client_item_id', $clientItemId)
            ->first();

        if ($existingItem) {
            return response()->json([
                'success' => true,
                'item' => $existingItem,
                'already_staged' => true,
            ]);
        }

        // Store into staging directory
        $staged = $imageService->storeStagedImage($request, $batch->batch_uuid, $clientItemId, 'image', 'image_base64', 'front');
        if (! $staged['success']) {
            return response()->json([
                'success' => false,
                'message' => $staged['error'],
            ], $staged['status'] ?? 422);
        }

        $item = BulkImportItem::create([
            'bulk_import_id' => $batch->id,
            'workspace_id' => $batch->workspace_id,
            'user_id' => $user->id,
            'client_item_id' => $clientItemId,
            'sequence_order' => $validated['sequence_order'] ?? 0,
            'status' => 'pending',
            'front_image_path' => $staged['storage_path'],
        ]);

        $batch->recalculateCounters();

        return response()->json([
            'success' => true,
            'item' => $item,
        ], 201);
    }

    /**
     * Manually attach optional back-side image to a specific staged item.
     */
    public function uploadItemBackImage(Request $request, string $uuid, int $itemId, CardImageService $imageService): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);
        $item = BulkImportItem::where('bulk_import_id', $batch->id)->findOrFail($itemId);

        $staged = $imageService->storeStagedImage($request, $batch->batch_uuid, $item->client_item_id, 'back_image', 'back_image_base64', 'back');
        if (! $staged['success']) {
            return response()->json([
                'success' => false,
                'message' => $staged['error'],
            ], $staged['status'] ?? 422);
        }

        $item->update(['back_image_path' => $staged['storage_path']]);

        return response()->json([
            'success' => true,
            'item' => $item,
        ]);
    }

    /**
     * Dispatch background OCR processing jobs for all pending items.
     */
    public function process(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        if ($batch->isCancelled()) {
            return response()->json(['success' => false, 'message' => 'Batch has been cancelled.'], 422);
        }

        $pendingItems = $batch->items()->where('status', 'pending')->get();
        if ($pendingItems->isEmpty()) {
            return response()->json([
                'success' => true,
                'message' => 'No pending items to process in this batch.',
                'queued_count' => 0,
            ]);
        }

        foreach ($pendingItems as $item) {
            ProcessBulkImportItemJob::dispatch($item->id);
        }

        $batch->update(['status' => 'processing']);
        $batch->recalculateCounters();

        return response()->json([
            'success' => true,
            'message' => 'Background extraction queued successfully.',
            'queued_count' => $pendingItems->count(),
        ], 202);
    }

    /**
     * Process next pending item synchronously if background queue worker is idle.
     * Guarantees that progress never hangs in any local or queue-less environment.
     */
    public function processNext(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        if ($batch->isCancelled()) {
            return response()->json(['success' => false, 'message' => 'Batch cancelled.'], 422);
        }

        $nextItem = $batch->items()->where('status', 'pending')->first();
        if (! $nextItem) {
            $batch->recalculateCounters();
            $batch->refresh();

            return response()->json([
                'success' => true,
                'has_more' => false,
                'batch_status' => $batch->status,
                'message' => 'No more pending items.',
            ]);
        }

        // Execute synchronously via job's handle logic
        try {
            ProcessBulkImportItemJob::dispatchSync($nextItem->id);
        } catch (\Throwable $e) {
            Log::error('Synchronous bulk item processing error', [
                'item_id' => $nextItem->id,
                'error' => $e->getMessage(),
            ]);
        }

        $batch->refresh();
        $batch->recalculateCounters();
        $batch->refresh();

        $remainingCount = $batch->items()->where('status', 'pending')->count();

        return response()->json([
            'success' => true,
            'has_more' => $remainingCount > 0,
            'remaining' => $remainingCount,
            'batch_status' => $batch->status,
            'processed_item_id' => $nextItem->id,
        ]);
    }

    /**
     * Lightweight polling endpoint for batch extraction and save progress with full breakdown.
     */
    public function progress(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        $statusCounts = DB::table('bulk_import_items')
            ->where('bulk_import_id', $batch->id)
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();

        return response()->json([
            'success' => true,
            'batch' => [
                'uuid' => $batch->batch_uuid,
                'status' => $batch->status,
                'total_items' => $batch->total_items,
                'uploaded_items' => $batch->uploaded_items,
                'processed_items' => $batch->processed_items,
                'pending_items' => (int) ($statusCounts['pending'] ?? 0),
                'extracting_items' => (int) ($statusCounts['extracting'] ?? 0),
                'extracted_items' => (int) ($statusCounts['extracted'] ?? 0),
                'duplicate_items' => (int) ($statusCounts['duplicate_detected'] ?? 0),
                'failed_items' => $batch->failed_items,
                'saved_items' => $batch->saved_items,
                'skipped_items' => $batch->skipped_items,
            ],
        ]);
    }

    /**
     * Get review items list with filtering (all | ready | duplicate | failed).
     */
    public function items(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        $query = $batch->items()->with(['matchedCard:id,name,company,phone,email']);

        $filter = $request->query('filter', 'all');
        if ($filter === 'ready') {
            $query->where('status', 'extracted');
        } elseif ($filter === 'duplicate') {
            $query->where('status', 'duplicate_detected');
        } elseif ($filter === 'failed') {
            $query->where('status', 'failed');
        }

        return response()->json([
            'success' => true,
            'items' => $query->get(),
        ]);
    }

    /**
     * Update details or decision on an individual staging item during user review.
     */
    public function updateItem(Request $request, string $uuid, int $itemId): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);
        $item = BulkImportItem::where('bulk_import_id', $batch->id)->findOrFail($itemId);

        $validated = $request->validate([
            'decision' => 'nullable|string|in:create_new,link_existing,skip',
            'matched_card_id' => 'nullable|integer',
            'extracted_data' => 'nullable|array',
        ]);

        if (isset($validated['decision'])) {
            $item->decision = $validated['decision'];
        }
        if (array_key_exists('matched_card_id', $validated)) {
            $item->matched_card_id = $validated['matched_card_id'];
        }
        if (isset($validated['extracted_data'])) {
            $item->extracted_data = array_merge($item->extracted_data ?? [], $validated['extracted_data']);
        }

        $item->save();

        return response()->json([
            'success' => true,
            'item' => $item->load('matchedCard:id,name,company,phone,email'),
        ]);
    }

    /**
     * Retry OCR extraction on an individual failed item.
     */
    public function retryItem(Request $request, string $uuid, int $itemId): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);
        $item = BulkImportItem::where('bulk_import_id', $batch->id)->findOrFail($itemId);

        $item->update([
            'status' => 'pending',
            'error_message' => null,
        ]);

        ProcessBulkImportItemJob::dispatch($item->id);
        $batch->recalculateCounters();

        return response()->json([
            'success' => true,
            'message' => 'Item queued for re-extraction.',
            'item' => $item,
        ]);
    }

    /**
     * Incrementally commit reviewed items to directory using per-item atomic transactions.
     */
    public function commit(Request $request, string $uuid, BulkCardSaveService $saveService): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);
        $user = $request->user();

        if ($batch->isCancelled()) {
            return response()->json(['success' => false, 'message' => 'Batch has been cancelled.'], 422);
        }

        $validated = $request->validate([
            'items' => 'nullable|array',
            'items.*.id' => 'required|integer',
            'items.*.decision' => 'required|string|in:create_new,link_existing,skip',
            'items.*.matched_card_id' => 'nullable|integer',
            'items.*.scan_notes' => 'nullable|string|max:1000',
        ]);

        $itemOverrides = collect($validated['items'] ?? [])->keyBy('id');

        $query = $batch->items();
        if ($itemOverrides->isNotEmpty()) {
            $query->whereIn('id', $itemOverrides->keys());
        } else {
            $query->whereIn('status', ['extracted', 'duplicate_detected']);
        }

        $itemsToCommit = $query->get();
        $results = [];

        foreach ($itemsToCommit as $stagedItem) {
            $overrides = $itemOverrides->get($stagedItem->id, []);
            try {
                $res = $saveService->commitItem($stagedItem, $overrides, $user);
                $results[] = [
                    'item_id' => $stagedItem->id,
                    'status' => 'saved',
                    'card_id' => $res['card_id'] ?? null,
                    'scan_id' => $res['scan_id'] ?? null,
                    'linked_existing' => $res['linked_existing'] ?? false,
                    'skipped' => $res['skipped'] ?? false,
                ];
            } catch (\Throwable $e) {
                $stagedItem->update([
                    'status' => 'failed',
                    'error_message' => 'Save failed: '.$e->getMessage(),
                ]);
                $results[] = [
                    'item_id' => $stagedItem->id,
                    'status' => 'failed',
                    'error' => $e->getMessage(),
                ];
            }
        }

        $batch->committed_by_user_id = $user->id;
        $batch->save();
        $batch->recalculateCounters();

        return response()->json([
            'success' => true,
            'batch' => $batch->fresh(),
            'results' => $results,
        ]);
    }

    /**
     * Cancel batch and stop all active/pending processing.
     */
    public function cancel(Request $request, string $uuid): JsonResponse
    {
        $batch = $this->resolveBatch($request, $uuid);

        $batch->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $batch->items()->whereIn('status', ['pending', 'extracting'])->update([
            'status' => 'skipped',
            'error_message' => 'Batch cancelled by user.',
        ]);

        $batch->recalculateCounters();

        return response()->json([
            'success' => true,
            'message' => 'Batch cancelled successfully.',
            'batch' => $batch,
        ]);
    }

    /**
     * Securely serve staged card front or back image.
     */
    public function image(Request $request, string $uuid, int $itemId): Response
    {
        $batch = $this->resolveBatch($request, $uuid);
        $item = BulkImportItem::where('bulk_import_id', $batch->id)->findOrFail($itemId);

        $type = $request->query('type', 'front');
        $targetPath = ($type === 'back') ? $item->back_image_path : $item->front_image_path;

        if (! $targetPath || ! Storage::disk('local')->exists($targetPath)) {
            return response()->json(['success' => false, 'message' => 'Image not found.'], 404);
        }

        $resp = response()->file(Storage::disk('local')->path($targetPath));
        $resp->setPrivate();
        $resp->setMaxAge(3600);

        return $resp;
    }

    /**
     * Resolve batch by UUID with strict workspace and role scoping.
     */
    protected function resolveBatch(Request $request, string $uuid): BulkImport
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');
        $user = $request->user();

        $query = BulkImport::where('workspace_id', $workspace->id)
            ->where('batch_uuid', $uuid);

        if ($role === 'member') {
            $query->where('user_id', $user->id);
        }

        $batch = $query->first();

        if (! $batch) {
            abort(response()->json([
                'success' => false,
                'message' => 'Bulk import batch not found or access denied.',
            ], 404));
        }

        return $batch;
    }
}
