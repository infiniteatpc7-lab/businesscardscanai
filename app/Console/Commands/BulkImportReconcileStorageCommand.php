<?php

namespace App\Console\Commands;

use App\Services\CardImageService;
use Illuminate\Console\Command;

class BulkImportReconcileStorageCommand extends Command
{
    protected $signature = 'bulk-import:reconcile-storage {--hours=2 : Safety threshold in hours to prevent touching active in-flight uploads}';

    protected $description = 'Safely reconcile permanent card storage, deleting only verified unreferenced files older than threshold hours.';

    public function handle(CardImageService $imageService): int
    {
        $hours = (int) $this->option('hours');
        if ($hours < 1) {
            $hours = 2;
        }

        $this->info("Scanning permanent card storage for unreferenced orphan files older than {$hours} hours...");
        $result = $imageService->reconcileStorage($hours);

        $this->info("Scanned {$result['scanned_count']} files. Safely purged {$result['deleted_count']} unreferenced orphan files.");

        return self::SUCCESS;
    }
}
