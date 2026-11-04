<?php

namespace App\Console\Commands;

use App\Models\AiApiRequest;
use App\Services\AiCostCalculationService;
use Illuminate\Console\Command;

class RecalculateAiCostsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'ai:recalculate-costs 
                            {--request-id= : Specific AI API Request ID to recalculate}
                            {--all-pending : Recalculate all requests with pending or missing costs}
                            {--force : Force recalculation even if status is already calculated}
                            {--reason= : Reason for audit logging}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate Gemini API costs in USD and INR for historical requests';

    /**
     * Execute the console command.
     */
    public function handle(AiCostCalculationService $costService): int
    {
        $requestId = $this->option('request-id');
        $allPending = $this->option('all-pending');
        $force = (bool) $this->option('force');
        $reason = $this->option('reason') ?: 'Manual console command recalculation';

        if ($requestId) {
            $request = AiApiRequest::find($requestId);
            if (! $request) {
                $this->error("AI API Request #{$requestId} not found.");

                return self::FAILURE;
            }

            $updated = $costService->recalculate($request, $force, $reason);
            $this->info("Request #{$request->id} recalculated. Status: {$updated->cost_calculation_status}, USD: \${$updated->cost_usd}, INR: ₹{$updated->cost_inr}");

            return self::SUCCESS;
        }

        $query = AiApiRequest::query();

        if (! $force || $allPending) {
            $query->whereIn('cost_calculation_status', ['pending', 'pricing_missing', 'exchange_rate_missing', 'usage_metadata_missing']);
        }

        $count = $query->count();
        $this->info("Processing {$count} AI API requests for cost recalculation...");

        $bar = $this->output->createProgressBar($count);
        $bar->start();

        $processed = 0;
        $query->chunkById(100, function ($requests) use ($costService, $force, $reason, $bar, &$processed) {
            foreach ($requests as $request) {
                $costService->recalculate($request, $force, $reason);
                $processed++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Successfully recalculated {$processed} requests.");

        return self::SUCCESS;
    }
}
