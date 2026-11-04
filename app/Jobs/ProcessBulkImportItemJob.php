<?php

namespace App\Jobs;

use App\Exceptions\PermanentExtractionException;
use App\Exceptions\TransientGeminiException;
use App\Models\BulkImportItem;
use App\Services\CardDuplicateDetector;
use App\Services\GeminiCardVisionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class ProcessBulkImportItemJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [5, 15, 30];

    public function __construct(public int $bulkImportItemId) {}

    public function handle(
        GeminiCardVisionService $visionService,
        CardDuplicateDetector $duplicateDetector
    ): void {
        $item = BulkImportItem::with('bulkImport')->find($this->bulkImportItemId);

        // Guard 1: Existence and cancellation check
        if (! $item || ! $item->bulkImport) {
            return;
        }

        if ($item->bulkImport->isCancelled()) {
            $item->updateQuietly([
                'status' => 'skipped',
                'error_message' => 'Batch cancelled by user.',
            ]);
            $item->bulkImport->recalculateCounters();

            return;
        }

        // Only process items that are pending or extracting or retrying failed
        if (! in_array($item->status, ['pending', 'extracting', 'failed'], true)) {
            return;
        }

        $item->update(['status' => 'extracting']);
        $item->bulkImport->recalculateCounters();

        try {
            $extracted = $visionService->extractCardData(
                $item->front_image_path,
                $item->back_image_path,
                [
                    'workspace_id' => $item->workspace_id,
                    'user_id' => $item->user_id,
                    'bulk_import_id' => $item->bulk_import_id,
                    'bulk_import_item_id' => $item->id,
                    'idempotency_key' => 'bulk_item_'.$item->id.'_att_'.$this->attempts(),
                    'scan_type' => 'bulk_scan',
                ]
            );

            // Phase 1 Duplicate Check
            $dupResult = $duplicateDetector->detectDuplicates($extracted, $item->workspace_id);
            $hasDup = $dupResult['has_duplicates'];

            $item->update([
                'status' => $hasDup ? 'duplicate_detected' : 'extracted',
                'extracted_data' => $extracted,
                'accuracy_score' => $extracted['accuracy_score'] ?? 90,
                'matched_card_id' => $hasDup ? ($dupResult['matching_cards'][0]['id'] ?? null) : null,
                'match_reason' => $dupResult['primary_reason'] ?? null,
                'decision' => $hasDup ? 'link_existing' : 'create_new',
                'error_message' => null,
            ]);

            $item->bulkImport->recalculateCounters();
        } catch (PermanentExtractionException $pe) {
            // Permanent failure: DO NOT RETRY
            $item->update([
                'status' => 'failed',
                'error_message' => Str::limit($pe->getMessage(), 500),
            ]);
            $item->bulkImport->recalculateCounters();
        } catch (TransientGeminiException $te) {
            // Transient rate limit or network failure: Retry with exponential backoff
            if ($this->attempts() < $this->tries) {
                $this->release($this->backoff[$this->attempts() - 1] ?? 15);

                return;
            }

            $item->update([
                'status' => 'failed',
                'error_message' => 'Extraction service timed out after multiple attempts: '.Str::limit($te->getMessage(), 250),
            ]);
            $item->bulkImport->recalculateCounters();
        } catch (\Throwable $e) {
            $item->update([
                'status' => 'failed',
                'error_message' => 'Unexpected error: '.Str::limit($e->getMessage(), 250),
            ]);
            $item->bulkImport->recalculateCounters();
        }
    }
}
