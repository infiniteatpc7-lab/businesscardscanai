<?php

namespace App\Http\Controllers;

use App\Models\Plan;
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

        $features = is_array($plan->features) ? $plan->features : [];
        $entitlements = [];
        foreach (Plan::getAllValidFeatureKeys() as $key) {
            $entitlements[$key] = in_array($key, $features, true);
        }

        return response()->json([
            'success' => true,
            'currency' => 'INR',
            'currency_symbol' => '₹',
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
                'description' => $plan->description,
                'price' => (float) $plan->price,
                'formatted_price' => '₹'.number_format((float) $plan->price, 2),
                'currency' => 'INR',
                'currency_symbol' => '₹',
                'billing_interval' => in_array($plan->invoice_interval, ['year', 'yearly'], true) ? 'year' : 'month',
                'monthly_scan_allowance' => (int) $plan->monthly_scan_allowance,
                'max_team_members' => (int) ($plan->max_team_members ?? 1),
                'max_workspaces' => (int) ($plan->max_workspaces ?? 1),
                'max_active_exhibitions' => (int) ($plan->max_active_exhibitions ?? 1),
                'is_unlimited_scans' => ((int) $plan->monthly_scan_allowance) === -1,
                'is_unlimited_team' => ((int) $plan->max_team_members) === -1,
                'is_unlimited_workspaces' => ((int) $plan->max_workspaces) === -1,
                'is_unlimited_exhibitions' => ((int) $plan->max_active_exhibitions) === -1,
                'features' => $features,
                'entitlements' => $entitlements,
                'is_active' => (bool) $plan->is_active,
                'is_default' => (bool) $plan->is_default,
            ],
            'quota' => $quota,
        ]);
    }
}
