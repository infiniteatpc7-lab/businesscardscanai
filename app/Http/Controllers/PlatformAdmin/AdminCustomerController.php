<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\BulkImport;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminCustomerController extends Controller
{
    /**
     * List customers with search, status filtering, and workspace summaries.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::query()->with([
            'workspaces:id,name',
            'ownedWorkspaces:id,name',
        ]);

        // Status filter: all | active | suspended
        if ($status = $request->input('status')) {
            if (in_array($status, ['active', 'suspended'], true)) {
                $query->where('status', $status);
            }
        }

        // Search by customer name, email, or workspace name
        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('workspaces', function ($wq) use ($search) {
                        $wq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $paginator = $query->latest('id')->paginate($perPage);

        $customerIds = collect($paginator->items())->pluck('id')->all();

        // Batch aggregate scan & card counts for these customers
        $scanCounts = CardScan::whereIn('user_id', $customerIds)
            ->groupBy('user_id')
            ->selectRaw('user_id, count(*) as count')
            ->pluck('count', 'user_id');

        $cardCounts = Card::whereIn('user_id', $customerIds)
            ->groupBy('user_id')
            ->selectRaw('user_id, count(*) as count')
            ->pluck('count', 'user_id');

        $items = collect($paginator->items())->map(function (User $u) use ($scanCounts, $cardCounts) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'status' => $u->status,
                'suspended_at' => $u->suspended_at?->toIso8601String(),
                'suspension_reason' => $u->suspension_reason,
                'created_at' => $u->created_at?->toIso8601String(),
                'workspaces_count' => $u->workspaces->count(),
                'primary_workspace' => $u->ownedWorkspaces->first()?->name
                    ?? $u->workspaces->first()?->name
                    ?? 'None',
                'workspaces' => $u->workspaces->map(fn ($ws) => [
                    'id' => $ws->id,
                    'name' => $ws->name,
                    'role' => $ws->pivot->role ?? 'member',
                ]),
                'cards_count' => $cardCounts[$u->id] ?? 0,
                'scans_count' => $scanCounts[$u->id] ?? 0,
            ];
        });

        return response()->json([
            'success' => true,
            'customers' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    /**
     * Show detailed customer profile with workspace affiliations and activity metrics.
     */
    public function show(int $id): JsonResponse
    {
        $customer = User::with([
            'workspaces' => function ($q) {
                $q->withCount(['cards', 'exhibitions', 'users']);
            },
            'ownedWorkspaces',
            'suspendedByAdmin:id,name,email',
        ])->findOrFail($id);

        $totalScans = CardScan::where('user_id', $customer->id)->count();
        $totalCardsCreated = Card::where('user_id', $customer->id)->count();
        $totalBulkBatches = BulkImport::where('user_id', $customer->id)->count();

        // Audit log entries regarding this customer
        $auditHistory = PlatformAuditLog::where('target_type', User::class)
            ->where('target_id', $customer->id)
            ->with('platformAdmin:id,name')
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (PlatformAuditLog $log) => [
                'id' => $log->id,
                'admin_name' => $log->platformAdmin?->name ?? 'System',
                'action' => $log->action,
                'details' => $log->details,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'status' => $customer->status,
                'suspended_at' => $customer->suspended_at?->toIso8601String(),
                'suspension_reason' => $customer->suspension_reason,
                'suspended_by' => $customer->suspendedByAdmin ? [
                    'id' => $customer->suspendedByAdmin->id,
                    'name' => $customer->suspendedByAdmin->name,
                ] : null,
                'created_at' => $customer->created_at?->toIso8601String(),
                'activity' => [
                    'cards_count' => $totalCardsCreated,
                    'scans_count' => $totalScans,
                    'bulk_batches_count' => $totalBulkBatches,
                ],
                'workspaces' => $customer->workspaces->map(fn ($ws) => [
                    'id' => $ws->id,
                    'name' => $ws->name,
                    'slug' => $ws->slug,
                    'status' => $ws->status,
                    'role' => $ws->pivot->role ?? 'member',
                    'is_owner' => $ws->owner_id === $customer->id,
                    'members_count' => $ws->users_count,
                    'cards_count' => $ws->cards_count,
                    'exhibitions_count' => $ws->exhibitions_count,
                    'created_at' => $ws->created_at?->toIso8601String(),
                ]),
                'audit_history' => $auditHistory,
            ],
        ]);
    }

    /**
     * Suspend a customer account and record the audit action.
     */
    public function suspend(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|min:3|max:500',
        ]);

        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $customer = User::findOrFail($id);

        if ($customer->isSuspended()) {
            return response()->json([
                'success' => true,
                'message' => 'Customer account is already suspended.',
                'customer' => $customer,
            ]);
        }

        $customer->update([
            'status' => 'suspended',
            'suspended_at' => now(),
            'suspension_reason' => $validated['reason'],
            'suspended_by_admin_id' => $admin->id,
        ]);

        // Record in platform audit log
        PlatformAuditLog::record(
            $admin,
            'customer.suspend',
            $customer,
            [
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'reason' => $validated['reason'],
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Customer account has been suspended successfully.',
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'status' => $customer->status,
                'suspended_at' => $customer->suspended_at?->toIso8601String(),
                'suspension_reason' => $customer->suspension_reason,
            ],
        ]);
    }

    /**
     * Reactivate a suspended customer account and record the audit action.
     */
    public function activate(Request $request, int $id): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        $customer = User::findOrFail($id);

        $previousReason = $customer->suspension_reason;

        $customer->update([
            'status' => 'active',
            'suspended_at' => null,
            'suspension_reason' => null,
            'suspended_by_admin_id' => null,
        ]);

        PlatformAuditLog::record(
            $admin,
            'customer.activate',
            $customer,
            [
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'previous_suspension_reason' => $previousReason,
            ],
            $request
        );

        return response()->json([
            'success' => true,
            'message' => 'Customer account has been reactivated successfully.',
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'status' => $customer->status,
            ],
        ]);
    }
}
