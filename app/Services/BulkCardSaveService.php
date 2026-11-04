<?php

namespace App\Services;

use App\Exceptions\ConcurrentSaveTimeoutException;
use App\Models\BulkImportItem;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BulkCardSaveService
{
    public function __construct(
        protected CardDuplicateDetector $duplicateDetector,
        protected CardImageService $imageService,
        protected ScanQuotaService $quotaService
    ) {}

    /**
     * Build all normalized lock keys for an item and sort in strict lexicographical order.
     * Prevents deadlocks across concurrent workers.
     *
     * @return list<string>
     */
    public function getDeterministicLockKeys(array $data, int $workspaceId): array
    {
        $keys = [];

        // 1. All normalized phones
        $phones = is_array($data['phone'] ?? null) ? $data['phone'] : (array) ($data['phone'] ?? []);
        foreach ($phones as $phone) {
            if ($normPhone = $this->duplicateDetector->normalizePhone((string) $phone)) {
                $keys[] = "ws:{$workspaceId}:phone:{$normPhone}";
            }
        }

        // 2. Normalized email
        if ($normEmail = $this->duplicateDetector->normalizeEmail($data['email'] ?? null)) {
            $keys[] = "ws:{$workspaceId}:email:{$normEmail}";
        }

        // 3. Normalized Name + Company combinations
        $names = array_filter([
            $this->duplicateDetector->normalizeText($data['name'] ?? null),
            $this->duplicateDetector->normalizeText($data['name_english'] ?? null),
        ]);
        $companies = array_filter([
            $this->duplicateDetector->normalizeText($data['company'] ?? null),
            $this->duplicateDetector->normalizeText($data['company_english'] ?? null),
        ]);

        foreach ($names as $name) {
            foreach ($companies as $company) {
                $hash = hash('sha256', "{$name}#{$company}");
                $keys[] = "ws:{$workspaceId}:nc:{$hash}";
            }
        }

        if (empty($keys)) {
            $keys[] = "ws:{$workspaceId}:generic_card_save";
        }

        $uniqueKeys = array_values(array_unique($keys));
        sort($uniqueKeys);

        return $uniqueKeys;
    }

    /**
     * Acquire nested locks in deterministic order with TTL of 15s and wait timeout of 5s.
     */
    public function executeUnderDuplicateLock(array $data, int $workspaceId, callable $callback)
    {
        $keys = $this->getDeterministicLockKeys($data, $workspaceId);

        return $this->acquireRecursiveLocks($keys, 0, $callback);
    }

    protected function acquireRecursiveLocks(array $keys, int $index, callable $callback)
    {
        if ($index >= count($keys)) {
            return $callback();
        }

        $lockKey = $keys[$index];
        $lock = Cache::lock($lockKey, 15);

        try {
            return $lock->block(5, function () use ($keys, $index, $callback) {
                return $this->acquireRecursiveLocks($keys, $index + 1, $callback);
            });
        } catch (LockTimeoutException) {
            throw new ConcurrentSaveTimeoutException("Lock acquisition timed out for resource: {$lockKey}");
        }
    }

    /**
     * Commit a single bulk import item with per-item atomic transaction, Phase 2 live duplicate check,
     * two-phase image promotion, and original uploader scan attribution.
     */
    public function commitItem(BulkImportItem $stagedItem, array $itemOverrides, User $actor): array
    {
        $workspaceId = $stagedItem->workspace_id;
        $batch = $stagedItem->bulkImport;
        $exhibitionId = $batch->exhibition_id;

        // Merge extracted data with user edits
        $data = array_merge($stagedItem->extracted_data ?? [], $itemOverrides);

        // Strict guard: DO NOT save blank or failed cards into directory!
        // A card MUST contain at least a company name, contact person name, or phone number.
        $hasContent = ! empty(trim((string) ($data['company'] ?? '')))
            || ! empty(trim((string) ($data['company_english'] ?? '')))
            || ! empty(trim((string) ($data['name'] ?? '')))
            || ! empty(trim((string) ($data['name_english'] ?? '')))
            || (! empty($data['phone']) && is_array($data['phone']) && count(array_filter($data['phone'])) > 0)
            || (! empty($data['phone']) && is_string($data['phone']) && trim($data['phone']) !== '');

        if (! $hasContent) {
            $stagedItem->update([
                'status' => 'skipped',
                'decision' => 'skip',
                'error_message' => 'Skipped: Card has no extracted contact details.',
            ]);
            $batch->recalculateCounters();

            return [
                'success' => true,
                'skipped' => true,
                'item_id' => $stagedItem->id,
                'message' => 'Skipped: Card has no contact details.',
            ];
        }

        $decision = $itemOverrides['decision'] ?? $stagedItem->decision ?? 'create_new';
        if (! in_array($decision, ['create_new', 'link_existing', 'skip'], true)) {
            $decision = 'create_new';
        }

        // Quick check if user decided to skip
        if ($decision === 'skip') {
            $stagedItem->update([
                'status' => 'skipped',
                'decision' => 'skip',
            ]);
            $batch->recalculateCounters();

            return ['success' => true, 'skipped' => true, 'item_id' => $stagedItem->id];
        }

        return $this->executeUnderDuplicateLock($data, $workspaceId, function () use ($stagedItem, $data, $workspaceId, $batch, $exhibitionId, $decision, $itemOverrides, $actor) {
            return $this->imageService->executeWithPromotedImages(
                $stagedItem->front_image_path,
                $stagedItem->back_image_path,
                function (string $permanentFront, ?string $permanentBack) use ($stagedItem, $data, $workspaceId, $batch, $exhibitionId, $decision, $itemOverrides, $actor) {
                    return DB::transaction(function () use ($stagedItem, $data, $workspaceId, $batch, $exhibitionId, $decision, $itemOverrides, $actor, $permanentFront, $permanentBack) {
                        // Lock item inside transaction and verify not already saved
                        $item = BulkImportItem::where('id', $stagedItem->id)->lockForUpdate()->firstOrFail();
                        if ($item->status === 'saved' && $item->saved_scan_id) {
                            return [
                                'success' => true,
                                'already_saved' => true,
                                'card_id' => $item->saved_card_id,
                                'scan_id' => $item->saved_scan_id,
                            ];
                        }

                        // Phase 2: Live duplicate check inside serialized lock
                        $liveDup = $this->duplicateDetector->detectDuplicates($data, $workspaceId);
                        $targetCard = null;

                        // If duplicate match exists, default to link_existing unless user explicitly forces new card
                        $hasDup = ! empty($liveDup['has_duplicates']);
                        $isDuplicate = $hasDup || $item->status === 'duplicate_detected';
                        $userForcedNew = ($itemOverrides['force_duplicate'] ?? false) === true;
                        $isLinking = ($decision === 'link_existing') || ($isDuplicate && ! $userForcedNew);

                        if ($isLinking) {
                            $matchedId = $itemOverrides['matched_card_id']
                                ?? $item->matched_card_id
                                ?? ($liveDup['matching_cards'][0]['id'] ?? null);

                            if ($matchedId) {
                                $targetCard = Card::forWorkspace($workspaceId)->lockForUpdate()->find($matchedId);
                            }

                            // Fallback to first matched candidate if ID wasn't directly found
                            if (! $targetCard && ! empty($liveDup['matching_cards'])) {
                                $fallbackId = $liveDup['matching_cards'][0]['id'];
                                $targetCard = Card::forWorkspace($workspaceId)->lockForUpdate()->find($fallbackId);
                            }
                        }

                        if ($targetCard) {
                            // PRESERVE CANONICAL CARD IMAGE PATHS: Do NOT overwrite targetCard->image_path
                            $targetCard->exhibitions()->syncWithoutDetaching([
                                $exhibitionId => ['created_at' => now()],
                            ]);
                        } else {
                            // If it is a duplicate and user didn't force a separate card, do NOT create a second card!
                            if ($isDuplicate && ! $userForcedNew) {
                                $item->update([
                                    'status' => 'skipped',
                                    'decision' => 'skip',
                                    'error_message' => 'Skipped duplicate: Matching contact already exists.',
                                ]);
                                $batch->recalculateCounters();

                                return [
                                    'success' => true,
                                    'skipped' => true,
                                    'item_id' => $item->id,
                                    'message' => 'Skipped duplicate card.',
                                ];
                            }

                            // Create brand-new canonical Card
                            $cardPayload = $data;
                            unset(
                                $cardPayload['decision'],
                                $cardPayload['matched_card_id'],
                                $cardPayload['scan_notes'],
                                $cardPayload['force_duplicate']
                            );

                            $cardPayload['workspace_id'] = $workspaceId;
                            $cardPayload['user_id'] = $item->user_id; // Attributed to original scanner
                            $cardPayload['image_path'] = $permanentFront;
                            $cardPayload['back_image_path'] = $permanentBack;

                            $targetCard = Card::create($cardPayload);
                            $targetCard->exhibitions()->syncWithoutDetaching([
                                $exhibitionId => ['created_at' => now()],
                            ]);
                        }

                        // Insert genuine individual CardScan record with unique idempotency constraints
                        $scanKey = "bulk_item_{$item->id}_ws_{$workspaceId}";
                        try {
                            $scan = CardScan::create([
                                'workspace_id' => $workspaceId,
                                'card_id' => $targetCard->id,
                                'exhibition_id' => $exhibitionId,
                                'user_id' => $item->user_id, // PRESERVES ORIGINAL SCANNER ATTRIBUTION
                                'saved_by_user_id' => $actor->id, // AUDIT OF WHO COMMITTED
                                'bulk_import_item_id' => $item->id,
                                'scan_idempotency_key' => $scanKey,
                                'scanned_at' => now(),
                                'front_image_path' => $permanentFront,
                                'back_image_path' => $permanentBack,
                                'accuracy_score' => $item->accuracy_score ?? 90,
                                'notes' => $itemOverrides['scan_notes'] ?? null,
                            ]);
                        } catch (QueryException $qe) {
                            if ($qe->getCode() == 23000 || str_contains($qe->getMessage(), 'uq_card_scans')) {
                                $scan = CardScan::where('scan_idempotency_key', $scanKey)->firstOrFail();
                            } else {
                                throw $qe;
                            }
                        }

                        // Deduct scan credit idempotently at the transaction boundary
                        $workspace = $batch->workspace ?? Workspace::findOrFail($workspaceId);
                        $this->quotaService->recordSuccessfulScan(
                            $workspace,
                            $actor,
                            $isLinking ? 'link_existing_contact' : 'bulk_import_item',
                            $scanKey,
                            $targetCard->id,
                            $scan->id,
                            $item->id
                        );

                        // Update item state
                        $item->update([
                            'status' => 'saved',
                            'decision' => $isLinking ? 'link_existing' : 'create_new',
                            'saved_card_id' => $targetCard->id,
                            'saved_scan_id' => $scan->id,
                            'saved_at' => now(),
                        ]);

                        // Link AI usage request records to saved entities
                        app(AiUsageTrackingService::class)->linkBulkScanEntities(
                            bulkImportItemId: $item->id,
                            cardId: $targetCard->id,
                            cardScanId: $scan->id
                        );

                        $batch->recalculateCounters();

                        return [
                            'success' => true,
                            'card_id' => $targetCard->id,
                            'scan_id' => $scan->id,
                            'linked_existing' => (bool) $isLinking,
                        ];
                    });
                }
            );
        });
    }
}
