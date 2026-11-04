<?php

namespace App\Http\Controllers;

use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\Workspace;
use App\Models\WorkspaceSubscriptionHistory;
use App\Services\ScanQuotaService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CustomerSubscriptionController extends Controller
{
    /**
     * Get current subscription and scan quota accounting for the active workspace,
     * including user's workspaces overview.
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

        $role = $request->attributes->get('workspace_role') ?? 'member';
        $user = $request->user();

        $subscription = $workspace->activeSubscription();
        $subscription->ensureCurrentPeriod();
        $plan = $subscription->plan;
        $quota = $quotaService->getWorkspaceQuota($workspace);

        $features = is_array($plan->features) ? $plan->features : [];
        $entitlements = [];
        foreach (Plan::getAllValidFeatureKeys() as $key) {
            $entitlements[$key] = in_array($key, $features, true);
        }

        // Summary of all customer's workspaces and their subscriptions
        $workspacesSummary = [];
        if ($user) {
            $userWorkspaces = $user->workspaces()
                ->with(['subscriptions' => fn ($sq) => $sq->latest('id')->with('plan')])
                ->get();

            $workspacesSummary = $userWorkspaces->map(function (Workspace $ws) use ($workspace) {
                $sub = $ws->subscriptions->firstWhere('status', 'active') ?? $ws->subscriptions->first();
                $p = $sub?->plan;

                return [
                    'id' => $ws->id,
                    'name' => $ws->name,
                    'slug' => $ws->slug,
                    'role' => $ws->pivot->role ?? 'member',
                    'is_current_workspace' => $ws->id === $workspace->id,
                    'plan_name' => $p?->name ?? 'Free Plan',
                    'price' => (float) ($p?->price ?? 0),
                    'formatted_price' => '₹'.number_format((float) ($p?->price ?? 0), 2),
                    'subscription_status' => $sub?->status ?? 'active',
                    'workspace_status' => $ws->status,
                ];
            });
        }

        return response()->json([
            'success' => true,
            'currency' => 'INR',
            'currency_symbol' => '₹',
            'workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'status' => $workspace->status,
            ],
            'user_role' => $role,
            'can_manage_billing' => in_array($role, ['owner', 'admin'], true),
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
            'workspaces_summary' => $workspacesSummary,
        ]);
    }

    /**
     * View workspace scan credit usage ledger.
     * Restricted to Owner & Admin.
     */
    public function usageLedger(Request $request): JsonResponse
    {
        $this->authorizeBillingAccess($request);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $perPage = min(max((int) $request->input('per_page', 15), 5), 50);
        $paginator = ScanUsageLedger::where('workspace_id', $workspace->id)
            ->with('user:id,name,email')
            ->latest('id')
            ->paginate($perPage);

        $items = collect($paginator->items())->map(fn (ScanUsageLedger $l) => [
            'id' => $l->id,
            'user_name' => $l->user?->name ?? 'Team Member',
            'operation_type' => $l->operation_type,
            'quantity' => (int) $l->quantity,
            'status' => $l->status,
            'reason' => $l->reason,
            'confirmed_at' => $l->confirmed_at?->toIso8601String(),
            'created_at' => $l->created_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'ledger' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * View immutable subscription plan change history.
     * Restricted to Owner & Admin.
     */
    public function history(Request $request): JsonResponse
    {
        $this->authorizeBillingAccess($request);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $history = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)
            ->latest('id')
            ->limit(30)
            ->get()
            ->map(fn (WorkspaceSubscriptionHistory $h) => [
                'id' => $h->id,
                'plan_name' => $h->plan_name,
                'plan_slug' => $h->plan_slug,
                'previous_plan_name' => $h->previous_plan_name,
                'status' => $h->status,
                'previous_status' => $h->previous_status,
                'assignment_source' => $h->assignment_source,
                'reason' => $h->reason,
                'period_starts_at' => $h->period_starts_at?->toIso8601String(),
                'period_ends_at' => $h->period_ends_at?->toIso8601String(),
                'created_at' => $h->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'workspace_id' => $workspace->id,
            'history' => $history,
        ]);
    }

    /**
     * View customer's workspace payment transaction history.
     * Restricted to Owner & Admin.
     */
    public function payments(Request $request): JsonResponse
    {
        $this->authorizeBillingAccess($request);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');

        $query = PaymentTransaction::where('workspace_id', $workspace->id);

        if ($status = $request->input('status')) {
            if ($status !== 'all' && in_array($status, ['successful', 'pending', 'failed', 'refunded'], true)) {
                $query->where('status', $status);
            }
        }

        $perPage = min(max((int) $request->input('per_page', 10), 5), 50);
        $paginator = $query->latest('id')->paginate($perPage);

        $transactions = collect($paginator->items())->map(function (PaymentTransaction $tx) {
            $amount = (float) $tx->amount;
            $currency = $tx->currency ?: 'INR';
            $currencySymbol = ($currency === 'INR') ? '₹' : $currency;

            $rawResponse = is_array($tx->gateway_response) ? $tx->gateway_response : [];
            $safeMetadata = [];
            foreach (['method', 'bank', 'wallet', 'card_network', 'card_last4'] as $k) {
                if (isset($rawResponse[$k])) {
                    $safeMetadata[$k] = $rawResponse[$k];
                }
            }

            return [
                'id' => $tx->id,
                'amount' => $amount,
                'currency' => $currency,
                'currency_symbol' => $currencySymbol,
                'formatted_amount' => $currencySymbol.number_format($amount, 2),
                'gateway' => $tx->gateway,
                'gateway_order_id' => $tx->gateway_order_id,
                'gateway_payment_id' => $tx->gateway_payment_id,
                'status' => $tx->status,
                'paid_at' => $tx->paid_at?->toIso8601String(),
                'created_at' => $tx->created_at?->toIso8601String(),
                'plan_name' => $tx->plan_name,
                'error_message' => $tx->error_message,
                'safe_metadata' => $safeMetadata,
            ];
        });

        return response()->json([
            'success' => true,
            'transactions' => $transactions,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * List available active SaaS plans for upgrades.
     * Restricted to Owner & Admin.
     */
    public function plans(Request $request): JsonResponse
    {
        $this->authorizeBillingAccess($request);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $currentPlan = $workspace->currentPlan();

        $plans = Plan::where('is_active', true)
            ->orderBy('price')
            ->get()
            ->map(function (Plan $p) use ($currentPlan) {
                $features = is_array($p->features) ? $p->features : [];

                return [
                    'id' => $p->id,
                    'name' => $p->name,
                    'slug' => $p->slug,
                    'description' => $p->description,
                    'price' => (float) $p->price,
                    'formatted_price' => '₹'.number_format((float) $p->price, 2),
                    'currency' => 'INR',
                    'currency_symbol' => '₹',
                    'billing_interval' => in_array($p->invoice_interval, ['year', 'yearly'], true) ? 'year' : 'month',
                    'monthly_scan_allowance' => (int) $p->monthly_scan_allowance,
                    'is_unlimited_scans' => ((int) $p->monthly_scan_allowance) === -1,
                    'max_team_members' => (int) ($p->max_team_members ?? 1),
                    'max_workspaces' => (int) ($p->max_workspaces ?? 1),
                    'max_active_exhibitions' => (int) ($p->max_active_exhibitions ?? 1),
                    'features' => $features,
                    'is_current' => $p->id === $currentPlan->id,
                    'is_default' => (bool) $p->is_default,
                ];
            });

        return response()->json([
            'success' => true,
            'currency' => 'INR',
            'currency_symbol' => '₹',
            'current_plan_id' => $currentPlan->id,
            'plans' => $plans,
        ]);
    }

    /**
     * Submit an upgrade request or contact admin request for plan change.
     * Restricted to Owner & Admin.
     */
    public function requestUpgrade(Request $request): JsonResponse
    {
        $this->authorizeBillingAccess($request);

        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $user = $request->user();

        $validated = $request->validate([
            'plan_id' => 'required|integer|exists:plans,id',
            'note' => 'nullable|string|max:500',
            'phone' => 'nullable|string|max:30',
        ]);

        $targetPlan = Plan::where('id', $validated['plan_id'])
            ->where('is_active', true)
            ->firstOrFail();

        // Record request in logs
        Log::info("Plan upgrade requested by user #{$user->id} ({$user->email}) for workspace #{$workspace->id} ({$workspace->name}) to plan #{$targetPlan->id} ({$targetPlan->name})");

        return response()->json([
            'success' => true,
            'message' => "Upgrade request for '{$targetPlan->name}' received successfully. Our platform sales team will contact you shortly to activate your new plan.",
            'target_plan' => [
                'id' => $targetPlan->id,
                'name' => $targetPlan->name,
                'price' => (float) $targetPlan->price,
                'currency' => 'INR',
            ],
            'support' => [
                'email' => 'support@businesscardscan.ai',
                'phone' => '+91 76001 98889',
                'whatsapp' => 'https://wa.me/917600198889?text='.urlencode("Hello, I would like to upgrade my workspace '{$workspace->name}' to the '{$targetPlan->name}' plan."),
            ],
        ]);
    }

    /**
     * Authorize that the current request user is an Owner or Admin of the active workspace.
     *
     * @throws HttpResponseException
     */
    private function authorizeBillingAccess(Request $request): void
    {
        $role = $request->attributes->get('workspace_role');
        if (! in_array($role, ['owner', 'admin'], true)) {
            abort(response()->json([
                'success' => false,
                'error_code' => 'BILLING_ACCESS_DENIED',
                'message' => 'Subscription and billing management is restricted to workspace Owners and Admins.',
            ], 403));
        }
    }
}
