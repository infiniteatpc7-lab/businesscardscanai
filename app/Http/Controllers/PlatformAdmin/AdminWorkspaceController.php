<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAuditLog;
use App\Models\ScanUsageLedger;
use App\Models\Workspace;
use App\Models\WorkspaceSubscriptionHistory;
use App\Services\ScanQuotaService;
use App\Services\WorkspaceSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWorkspaceController extends Controller
{
    /**
     * List all workspaces across the platform with activity metrics.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Workspace::query()->with([
            'owner:id,name,email,status',
            'subscriptions' => function ($sq) {
                $sq->where('status', 'active')->with('plan');
            },
        ])->withCount(['users', 'cards', 'exhibitions']);

        if ($status = $request->input('status')) {
            if (in_array($status, ['active', 'suspended'], true)) {
                $query->where('status', $status);
            }
        }

        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhereHas('owner', function ($oq) use ($search) {
                        $oq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $paginator = $query->latest('id')->paginate($perPage);

        $items = collect($paginator->items())->map(fn (Workspace $ws) => [
            'id' => $ws->id,
            'name' => $ws->name,
            'slug' => $ws->slug,
            'status' => $ws->status,
            'suspended_at' => $ws->suspended_at?->toIso8601String(),
            'suspension_reason' => $ws->suspension_reason,
            'owner' => $ws->owner ? [
                'id' => $ws->owner->id,
                'name' => $ws->owner->name,
                'email' => $ws->owner->email,
                'status' => $ws->owner->status,
            ] : null,
            'members_count' => $ws->users_count,
            'cards_count' => $ws->cards_count,
            'exhibitions_count' => $ws->exhibitions_count,
            'plan' => $ws->currentPlan() ? [
                'id' => $ws->currentPlan()->id,
                'name' => $ws->currentPlan()->name,
                'price' => (float) $ws->currentPlan()->price,
                'formatted_price' => '₹'.number_format((float) $ws->currentPlan()->price, 2),
                'currency' => 'INR',
                'currency_symbol' => '₹',
                'allowance' => (int) $ws->currentPlan()->monthly_scan_allowance,
                'is_unlimited_scans' => ((int) $ws->currentPlan()->monthly_scan_allowance) === -1,
            ] : null,
            'created_at' => $ws->created_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'workspaces' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Show single workspace with member details and exhibitions.
     */
    public function show(int $id): JsonResponse
    {
        $workspace = Workspace::with([
            'owner:id,name,email,status',
            'users' => function ($uq) {
                $uq->select('users.id', 'users.name', 'users.email', 'users.status')
                    ->withPivot('role');
            },
            'exhibitions:id,workspace_id,name,status,start_date,end_date',
        ])->withCount(['cards'])->findOrFail($id);

        $subscription = $workspace->activeSubscription();
        $subscription->ensureCurrentPeriod();
        $plan = $subscription->plan;

        return response()->json([
            'success' => true,
            'workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'status' => $workspace->status,
                'suspended_at' => $workspace->suspended_at?->toIso8601String(),
                'suspension_reason' => $workspace->suspension_reason,
                'owner' => $workspace->owner,
                'cards_count' => $workspace->cards_count,
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'assignment_source' => $subscription->assignment_source,
                    'starts_at' => $subscription->starts_at?->toIso8601String(),
                    'renews_at' => $subscription->renews_at?->toIso8601String(),
                ],
                'plan' => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'price' => (float) $plan->price,
                    'formatted_price' => '₹'.number_format((float) $plan->price, 2),
                    'currency' => 'INR',
                    'currency_symbol' => '₹',
                    'monthly_scan_allowance' => (int) $plan->monthly_scan_allowance,
                    'max_team_members' => (int) ($plan->max_team_members ?? 1),
                    'max_workspaces' => (int) ($plan->max_workspaces ?? 1),
                    'max_active_exhibitions' => (int) ($plan->max_active_exhibitions ?? 1),
                    'is_unlimited_scans' => ((int) $plan->monthly_scan_allowance) === -1,
                    'features' => $plan->features ?? [],
                ],
                'members' => $workspace->users->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'status' => $u->status,
                    'role' => $u->pivot->role ?? 'member',
                ]),
                'exhibitions' => $workspace->exhibitions,
                'created_at' => $workspace->created_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Suspend a workspace.
     */
    public function suspend(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $workspace = Workspace::findOrFail($id);

        $workspace->update([
            'status' => 'suspended',
            'suspended_at' => now(),
            'suspension_reason' => $validated['reason'],
        ]);

        PlatformAuditLog::record(
            $admin,
            'workspace.suspend',
            $workspace,
            [
                'workspace_name' => $workspace->name,
                'reason' => $validated['reason'],
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Workspace has been suspended successfully.',
            'workspace' => $workspace,
        ]);
    }

    /**
     * Reactivate a suspended workspace.
     */
    public function activate(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $workspace = Workspace::findOrFail($id);

        $workspace->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspension_reason' => null,
        ]);

        PlatformAuditLog::record(
            $admin,
            'workspace.activate',
            $workspace,
            [
                'workspace_name' => $workspace->name,
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Workspace has been reactivated successfully.',
            'workspace' => $workspace,
        ]);
    }

    /**
     * View workspace subscription details and scan usage ledger.
     */
    public function subscription(int $id, ScanQuotaService $quotaService): JsonResponse
    {
        $workspace = Workspace::findOrFail($id);
        $subscription = $workspace->activeSubscription();
        $subscription->ensureCurrentPeriod();
        $plan = $subscription->plan;
        $quota = $quotaService->getWorkspaceQuota($workspace);

        $recentLedger = ScanUsageLedger::where('workspace_id', $workspace->id)
            ->with(['user:id,name,email'])
            ->latest('id')
            ->limit(25)
            ->get();

        return response()->json([
            'success' => true,
            'workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
            ],
            'subscription' => $subscription,
            'plan' => $plan,
            'quota' => $quota,
            'recent_ledger' => $recentLedger,
        ]);
    }

    /**
     * Manually change or assign a workspace plan.
     */
    public function changePlan(
        Request $request,
        int $id,
        ScanQuotaService $quotaService,
        WorkspaceSubscriptionService $subscriptionService
    ): JsonResponse {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $validated = $request->validate([
            'plan_id' => 'required|integer|exists:plans,id',
            'reason' => 'nullable|string|max:500',
        ]);

        $workspace = Workspace::findOrFail($id);
        $newPlan = Plan::findOrFail($validated['plan_id']);

        $subscription = $subscriptionService->changePlan($workspace, $newPlan, [
            'source' => 'admin_assigned',
            'admin' => $admin,
            'reason' => $validated['reason'] ?? null,
            'request' => $request,
        ]);

        $quota = $quotaService->getWorkspaceQuota($workspace->fresh());

        return response()->json([
            'success' => true,
            'message' => "Workspace plan changed to '{$newPlan->name}' successfully.",
            'subscription' => $subscription,
            'plan' => $subscription->plan,
            'quota' => $quota,
        ]);
    }

    /**
     * Get immutable subscription history for a workspace.
     */
    public function subscriptionHistory(Request $request, int $id): JsonResponse
    {
        $workspace = Workspace::findOrFail($id);

        $history = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)
            ->with([
                'plan:id,name,slug,price,currency',
                'previousPlan:id,name,slug,price,currency',
                'assignedByAdmin:id,name,email',
            ])
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'workspace_id' => $workspace->id,
            'history' => $history,
        ]);
    }
}
