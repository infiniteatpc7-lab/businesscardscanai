<?php

namespace App\Http\Controllers;

use App\Models\Workspace;
use App\Services\ScanQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerSubscriptionController extends Controller
{
    /**
     * Get current subscription and scan quota accounting for the active workspace.
     */
    public function current(Request $request, ScanQuotaService $quotaService): JsonResponse
    {
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        if (! $workspace) {
            return response()->json([
                'success' => false,
                'message' => 'Workspace not resolved.',
            ], 400);
        }

        $subscription = $workspace->activeSubscription();
        $subscription->ensureCurrentPeriod();
        $plan = $subscription->plan;
        $quota = $quotaService->getWorkspaceQuota($workspace);

        return response()->json([
            'success' => true,
            'subscription' => [
                'id' => $subscription->id,
                'status' => $subscription->status,
                'assignment_source' => $subscription->assignment_source,
                'starts_at' => $subscription->starts_at?->toIso8601String(),
                'renews_at' => $subscription->renews_at?->toIso8601String(),
                'ends_at' => $subscription->ends_at?->toIso8601String(),
                'billing_period_starts_at' => $subscription->current_period_starts_at?->toIso8601String(),
                'billing_period_ends_at' => $subscription->current_period_ends_at?->toIso8601String(),
            ],
            'plan' => [
                'id' => $plan->id,
                'name' => $plan->name,
                'slug' => $plan->slug,
                'price' => (float) $plan->price,
                'currency' => $plan->currency,
                'billing_interval' => $plan->billing_interval,
                'monthly_scan_allowance' => (int) $plan->monthly_scan_allowance,
                'features' => $plan->features ?? [],
                'is_active' => (bool) $plan->is_active,
            ],
            'quota' => $quota,
        ]);
    }
}
