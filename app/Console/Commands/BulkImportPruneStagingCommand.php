<?php

namespace App\Console\Commands;

use App\Models\BulkImport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class BulkImportPruneStagingCommand extends Command
{
    protected $signature = 'bulk-import:prune-staging';

    protected $description = 'Safely prune abandoned, cancelled, and completed bulk staging directories without touching permanent card storage.';

    public function handle(): int
    {
        $disk = Storage::disk('local');
        $prunedCount = 0;

        // 1. Abandoned / cancelled batches older than 48 hours
        $abandonedBatches = BulkImport::where(function ($q) {
            $q->whereIn('status', ['draft', 'cancelled', 'failed'])
                ->orWhere(function ($sq) {
                    $sq->where('status', 'uploading')->where('updated_at', '<', now()->subHours(48));
                });
        })
            ->where('updated_at', '<', now()->subHours(48))
            ->get();

        foreach ($abandonedBatches as $batch) {
            $dir = "bulk_staging/{$batch->batch_uuid}";
            if ($disk->exists($dir)) {
                $disk->deleteDirectory($dir);
                $prunedCount++;
            }
            $batch->items()->delete();
            $batch->delete();
        }

        // 2. Completed batches older than 24 hours (their images are already safely promoted to cards/)
        $completedBatches = BulkImport::where('status', 'completed')
            ->where('updated_at', '<', now()->subHours(24))
            ->get();

        foreach ($completedBatches as $batch) {
            $dir = "bulk_staging/{$batch->batch_uuid}";
            if ($disk->exists($dir)) {
                $disk->deleteDirectory($dir);
                $prunedCount++;
            }
        }

        $this->info("Pruned staging directories for {$prunedCount} batches.");
        Log::info("Bulk import staging pruner cleaned up {$prunedCount} batches.");

        return self::SUCCESS;
    }
}

