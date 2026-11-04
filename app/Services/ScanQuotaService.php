<?php

namespace App\Services;

use App\Exceptions\QuotaExceededException;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ScanQuotaService
{
    /**
     * Get complete quota accounting summary for a workspace.
     *
     * @return array{
     *     plan: array{id: int, name: string, slug: string, monthly_scan_allowance: int, price: float, currency: string, features: array},
     *     subscription_status: string,
     *     monthly_allowance: int,
     *     used_credits: int,
     *     reserved_credits: int,
     *     remaining_credits: int,
     *     period_starts_at: string,
     *     period_ends_at: string,
     *     is_exhausted: bool
     * }
     */
    public function getWorkspaceQuota(Workspace $workspace): array
    {
        // Prune any stale reservations older than 15 minutes to prevent stuck quota
        $this->pruneStaleReservations(15, $workspace->id);

        $subscription = $workspace->activeSubscription();
        $subscription->ensureCurrentPeriod();
        $subscription->loadMissing('plan');

        $plan = $subscription->plan;
        $periodStart = $subscription->current_period_starts_at;
        $periodEnd = $subscription->current_period_ends_at;

        // Calculate confirmed deductions in current billing period
        $usedCredits = (int) ScanUsageLedger::where('workspace_id', $workspace->id)
            ->where('subscription_id', $subscription->id)
            ->where('status', 'confirmed')
            ->where('confirmed_at', '>=', $periodStart)
            ->where('confirmed_at', '<=', $periodEnd)
            ->sum('quantity');

        // Calculate active reservations (ignoring stale reservations older than 15 minutes)
        $reservedCredits = (int) ScanUsageLedger::where('workspace_id', $workspace->id)
            ->where('subscription_id', $subscription->id)
            ->where('status', 'reserved')
            ->where('reserved_at', '>=', now()->subMinutes(15))
            ->where('billing_period_starts_at', '>=', $periodStart->copy()->subHours(2))
            ->sum('quantity');

        $allowance = (int) $plan->monthly_scan_allowance;
        $isUnlimited = ($allowance === -1);
        $remainingCredits = $isUnlimited ? -1 : max(0, $allowance - $usedCredits - $reservedCredits);

        return [
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'monthly_scan_allowance' => $allowance,
                'is_unlimited' => $isUnlimited,
                'price' => (float) $plan->price,
                'currency' => $plan->currency ?? 'INR',
                'features' => $plan->features ?? [],
            ],
            'subscription_status' => $subscription->status,
            'monthly_allowance' => $allowance,
            'allowance' => $allowance,
            'is_unlimited' => $isUnlimited,
            'used_credits' => $usedCredits,
            'used' => $usedCredits,
            'reserved_credits' => $reservedCredits,
            'reserved' => $reservedCredits,
            'remaining_credits' => $remainingCredits,
            'remaining' => $remainingCredits,
            'period_starts_at' => $periodStart->toIso8601String(),
            'period_ends_at' => $periodEnd->toIso8601String(),
            'is_exhausted' => ! $isUnlimited && $remainingCredits <= 0,
        ];
    }

    /**
     * Reserve quota before initiating billable card processing.
     * Prevents concurrent requests from overspending the workspace quota.
     *
     * @throws QuotaExceededException
     */
    public function reserveQuota(
        Workspace $workspace,
        ?User $user,
        string $operationType,
        string $idempotencyKey,
        int $quantity = 1,
        array $metadata = []
    ): ScanUsageLedger {
        return DB::transaction(function () use ($workspace, $user, $operationType, $idempotencyKey, $quantity, $metadata) {
            // Prune any stale reservations older than 15 minutes to keep quota accurate
            $this->pruneStaleReservations(15, $workspace->id);

            $subscription = $workspace->activeSubscription();
            $subscription->ensureCurrentPeriod();

            // Lock subscription row to serialize concurrent quota checks for this workspace
            WorkspaceSubscription::where('id', $subscription->id)->lockForUpdate()->first();

            // 1. Check idempotency: if already confirmed or reserved with this key, return immediately
            $existing = ScanUsageLedger::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                if ($existing->status === 'confirmed' || $existing->status === 'reserved') {
                    return $existing;
                }
                // If it was previously released, we can revive it if quota permits
            }

            // 2. Calculate remaining quota under strict row lock
            $plan = $subscription->plan;
            $allowance = (int) $plan->monthly_scan_allowance;
            $periodStart = $subscription->current_period_starts_at;
            $periodEnd = $subscription->current_period_ends_at;

            $used = (int) ScanUsageLedger::where('workspace_id', $workspace->id)
                ->where('subscription_id', $subscription->id)
                ->where('status', 'confirmed')
                ->where('confirmed_at', '>=', $periodStart)
                ->where('confirmed_at', '<=', $periodEnd)
                ->sum('quantity');

            $reserved = (int) ScanUsageLedger::where('workspace_id', $workspace->id)
                ->where('subscription_id', $subscription->id)
                ->where('status', 'reserved')
                ->where('reserved_at', '>=', now()->subMinutes(15))
                ->where('idempotency_key', '!=', $idempotencyKey)
                ->sum('quantity');

            $isUnlimited = ($allowance === -1);
            $remaining = $isUnlimited ? -1 : max(0, $allowance - $used - $reserved);

            if (! $isUnlimited && $remaining < $quantity) {
                Log::warning('Scan quota exceeded during reservation attempt', [
                    'workspace_id' => $workspace->id,
                    'user_id' => $user?->id,
                    'operation' => $operationType,
                    'allowance' => $allowance,
                    'used' => $used,
                    'reserved' => $reserved,
                    'requested' => $quantity,
                ]);

                throw new QuotaExceededException(
                    "Monthly scan allowance of {$allowance} credits exceeded for this workspace.",
                    $allowance,
                    $used,
                    $remaining,
                    $plan->name
                );
            }

            // 3. Create or update reservation ledger entry
            if ($existing) {
                $existing->update([
                    'status' => 'reserved',
                    'quantity' => $quantity,
                    'reserved_at' => now(),
                    'released_at' => null,
                    'billing_period_starts_at' => $periodStart,
                    'billing_period_ends_at' => $periodEnd,
                    'metadata' => array_merge($existing->metadata ?? [], $metadata),
                ]);

                return $existing;
            }

            return ScanUsageLedger::create([
                'workspace_id' => $workspace->id,
                'subscription_id' => $subscription->id,
                'user_id' => $user?->id,
                'idempotency_key' => $idempotencyKey,
                'operation_type' => $operationType,
                'quantity' => $quantity,
                'status' => 'reserved',
                'reserved_at' => now(),
                'billing_period_starts_at' => $periodStart,
                'billing_period_ends_at' => $periodEnd,
                'metadata' => $metadata,
            ]);
        });
    }

    /**
     * Confirm credit deduction once the card and scan history are safely persisted.
     */
    public function confirmDeduction(
        string $idempotencyKey,
        ?int $cardId = null,
        ?int $cardScanId = null,
        ?int $bulkImportItemId = null
    ): ?ScanUsageLedger {
        $ledger = ScanUsageLedger::where('idempotency_key', $idempotencyKey)->first();
        if (! $ledger) {
            return null;
        }

        // Idempotency: if already confirmed, do nothing further
        if ($ledger->status === 'confirmed') {
            return $ledger;
        }

        $ledger->update([
            'status' => 'confirmed',
            'confirmed_at' => now(),
            'card_id' => $cardId ?? $ledger->card_id,
            'card_scan_id' => $cardScanId ?? $ledger->card_scan_id,
            'bulk_import_item_id' => $bulkImportItemId ?? $ledger->bulk_import_item_id,
        ]);

        return $ledger;
    }

    /**
     * Release a reserved credit upon extraction failure, cancellation or abandoned processing.
     */
    public function releaseReservation(string $idempotencyKey, ?string $reason = null): ?ScanUsageLedger
    {
        $ledger = ScanUsageLedger::where('idempotency_key', $idempotencyKey)->first();
        if (! $ledger || $ledger->status !== 'reserved') {
            return $ledger;
        }

        $meta = $ledger->metadata ?? [];
        if ($reason) {
            $meta['release_reason'] = $reason;
        }

        $ledger->update([
            'status' => 'released',
            'released_at' => now(),
            'metadata' => $meta,
        ]);

        return $ledger;
    }

    /**
     * Auto-release stale reservations older than the specified threshold.
     */
    public function pruneStaleReservations(int $olderThanMinutes = 15, ?int $workspaceId = null): int
    {
        $query = ScanUsageLedger::where('status', 'reserved')
            ->where('reserved_at', '<', now()->subMinutes($olderThanMinutes));

        if ($workspaceId !== null) {
            $query->where('workspace_id', $workspaceId);
        }

        $staleReservations = $query->get();
        $count = 0;

        foreach ($staleReservations as $stale) {
            $metadata = $stale->metadata ?? [];
            $metadata['release_reason'] = 'stale_reservation_timeout';
            $stale->update([
                'status' => 'released',
                'released_at' => now(),
                'metadata' => $metadata,
            ]);
            $count++;
        }

        return $count;
    }

    /**
     * Atomically reserve and confirm quota deduction in a single transaction boundary.
     * Used by bulk commit and direct card saves to guarantee consistency.
     *
     * @throws QuotaExceededException
     */
    public function recordSuccessfulScan(
        Workspace $workspace,
        ?User $user,
        string $operationType,
        string $idempotencyKey,
        ?int $cardId = null,
        ?int $cardScanId = null,
        ?int $bulkImportItemId = null,
        array $metadata = []
    ): ScanUsageLedger {
        // Idempotency check: if this key is already confirmed, return it without recharging
        $existing = ScanUsageLedger::where('idempotency_key', $idempotencyKey)->first();
        if ($existing && $existing->status === 'confirmed') {
            return $existing;
        }

        // Reserve quota (validates allowance and prevents concurrency overspending)
        $reservation = $this->reserveQuota($workspace, $user, $operationType, $idempotencyKey, 1, $metadata);

        // Confirm deduction
        return $this->confirmDeduction($idempotencyKey, $cardId, $cardScanId, $bulkImportItemId) ?? $reservation;
    }
}
