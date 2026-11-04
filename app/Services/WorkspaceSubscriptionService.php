<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAuditLog;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use App\Models\WorkspaceSubscriptionHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class WorkspaceSubscriptionService
{
    /**
     * Assign the initial Free Plan to a new workspace and record its initial history.
     */
    public function assignInitialFreePlan(Workspace $workspace): WorkspaceSubscription
    {
        return DB::transaction(function () use ($workspace) {
            $defaultPlan = Plan::getDefaultPlan();
            if (! $defaultPlan) {
                throw new InvalidArgumentException('Default Free Plan is not configured.');
            }

            $now = now();
            $subscription = WorkspaceSubscription::firstOrCreate(
                [
                    'workspace_id' => $workspace->id,
                    'status' => 'active',
                ],
                [
                    'plan_id' => $defaultPlan->id,
                    'started_at' => $now,
                    'current_period_starts_at' => $now,
                    'current_period_ends_at' => $now->copy()->addMonth(),
                    'assignment_source' => 'system_free',
                ]
            );

            // Record initial history if no history exists yet for this subscription
            $hasHistory = WorkspaceSubscriptionHistory::where('subscription_id', $subscription->id)->exists();
            if (! $hasHistory) {
                WorkspaceSubscriptionHistory::create([
                    'workspace_id' => $workspace->id,
                    'workspace_name' => $workspace->name,
                    'subscription_id' => $subscription->id,
                    'previous_plan_id' => null,
                    'previous_plan_name' => null,
                    'plan_id' => $defaultPlan->id,
                    'plan_name' => $defaultPlan->name,
                    'plan_slug' => $defaultPlan->slug,
                    'plan_price' => $defaultPlan->price,
                    'plan_currency' => $defaultPlan->currency,
                    'previous_status' => null,
                    'status' => 'active',
                    'assignment_source' => 'system_free',
                    'period_starts_at' => $subscription->current_period_starts_at ?? $now,
                    'period_ends_at' => $subscription->current_period_ends_at ?? $now->copy()->addMonth(),
                    'assigned_by_admin_id' => null,
                    'reason' => 'Initial Free Plan assignment on workspace creation',
                ]);
            }

            return $subscription->fresh(['plan']);
        });
    }

    /**
     * Atomically change a workspace plan and append immutable subscription history.
     *
     * @param  array{
     *     source?: string,
     *     admin?: ?PlatformAdmin,
     *     reason?: ?string,
     *     request?: ?Request,
     *     idempotency_key?: ?string,
     *     new_status?: string
     * }  $options
     */
    public function changePlan(Workspace $workspace, Plan $newPlan, array $options = []): WorkspaceSubscription
    {
        return DB::transaction(function () use ($workspace, $newPlan, $options) {
            // Lock workspace subscription row to prevent concurrent race conditions
            $currentSub = WorkspaceSubscription::where('workspace_id', $workspace->id)
                ->where('status', 'active')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $currentSub) {
                $currentSub = $this->assignInitialFreePlan($workspace);
            }

            $currentSub->ensureCurrentPeriod();

            $source = $options['source'] ?? 'admin_assigned';
            $admin = $options['admin'] ?? null;
            $reason = $options['reason'] ?? null;
            $request = $options['request'] ?? null;
            $idempotencyKey = $options['idempotency_key'] ?? null;
            $newStatus = $options['new_status'] ?? 'active';

            // 1. Idempotency Key check: verify workspace scope and operation consistency
            if ($idempotencyKey) {
                $existingHistory = WorkspaceSubscriptionHistory::where('idempotency_key', $idempotencyKey)->first();
                if ($existingHistory) {
                    // Check workspace ownership to prevent cross-workspace key collisions
                    if ((int) $existingHistory->workspace_id !== (int) $workspace->id) {
                        throw new InvalidArgumentException("Idempotency key '{$idempotencyKey}' has already been used by another workspace.");
                    }

                    // Check conflicting operation
                    if ((int) $existingHistory->plan_id !== (int) $newPlan->id ||
                        $existingHistory->status !== $newStatus ||
                        $existingHistory->assignment_source !== $source) {
                        throw new InvalidArgumentException("Idempotency key '{$idempotencyKey}' cannot be reused for a different or conflicting plan change operation.");
                    }

                    return $currentSub->fresh(['plan']);
                }
            }

            // 2. Repeated request guard: if already on this plan with same status and source, avoid redundant history
            if ((int) $currentSub->plan_id === (int) $newPlan->id && $currentSub->status === $newStatus) {
                $latestHistory = WorkspaceSubscriptionHistory::where('subscription_id', $currentSub->id)
                    ->latest('id')
                    ->first();

                if ($latestHistory && (int) $latestHistory->plan_id === (int) $newPlan->id && $latestHistory->status === $newStatus) {
                    return $currentSub->fresh(['plan']);
                }
            }

            $oldPlanId = $currentSub->plan_id;
            $oldPlan = $currentSub->plan ?? Plan::find($oldPlanId);
            $oldPlanName = $oldPlan?->name ?? 'None';
            $oldStatus = $currentSub->status;

            // Preserve existing billing period dates
            $currentSub->update([
                'plan_id' => $newPlan->id,
                'status' => $newStatus,
                'assignment_source' => $source,
            ]);

            // Append immutable history with snapshots
            WorkspaceSubscriptionHistory::create([
                'workspace_id' => $workspace->id,
                'workspace_name' => $workspace->name,
                'subscription_id' => $currentSub->id,
                'previous_plan_id' => $oldPlanId,
                'previous_plan_name' => $oldPlanName,
                'plan_id' => $newPlan->id,
                'plan_name' => $newPlan->name,
                'plan_slug' => $newPlan->slug,
                'plan_price' => $newPlan->price,
                'plan_currency' => $newPlan->currency,
                'previous_status' => $oldStatus,
                'status' => $newStatus,
                'assignment_source' => $source,
                'period_starts_at' => $currentSub->current_period_starts_at,
                'period_ends_at' => $currentSub->current_period_ends_at,
                'assigned_by_admin_id' => $admin?->id,
                'reason' => $reason,
                'idempotency_key' => $idempotencyKey,
            ]);

            // Record in audit log if administered by Platform Admin
            if ($admin) {
                PlatformAuditLog::record(
                    $admin,
                    'workspace.plan_change',
                    $workspace,
                    [
                        'workspace_name' => $workspace->name,
                        'old_plan' => $oldPlanName,
                        'new_plan' => $newPlan->name,
                        'reason' => $reason,
                    ],
                    $request
                );
            }

            return $currentSub->fresh(['plan']);
        });
    }
}
