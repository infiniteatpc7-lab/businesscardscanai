<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\BulkImport;
use App\Models\Card;
use App\Models\CardScan;
use App\Models\PlatformAuditLog;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    /**
     * Return live, real-time platform metrics and recent activity for the dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $totalCustomers = User::count();
        $activeCustomers = User::where('status', 'active')->count();
        $suspendedCustomers = User::where('status', 'suspended')->count();

        $totalWorkspaces = Workspace::count();
        $activeWorkspaces = Workspace::where('status', 'active')->count();
        $suspendedWorkspaces = Workspace::where('status', 'suspended')->count();

        $totalCards = Card::count();
        $totalScans = CardScan::count();
        $totalBulkBatches = BulkImport::count();

        // Real growth / new signups in last 30 days
        $recentSignupsCount = User::where('created_at', '>=', now()->subDays(30))->count();
        $recentScansCount = CardScan::where('created_at', '>=', now()->subDays(30))->count();

        // 5 most recently registered customers
        $recentCustomers = User::with(['ownedWorkspaces:id,name,owner_id'])
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'status' => $u->status,
                'created_at' => $u->created_at?->toIso8601String(),
                'primary_workspace' => $u->ownedWorkspaces->first()?->name ?? 'None',
            ]);

        // 6 most recent platform audit logs
        $recentAuditLogs = PlatformAuditLog::with('platformAdmin:id,name')
            ->latest('id')
            ->limit(6)
            ->get()
            ->map(fn (PlatformAuditLog $log) => [
                'id' => $log->id,
                'admin_name' => $log->platformAdmin?->name ?? 'System',
                'action' => $log->action,
                'target_type' => class_basename($log->target_type ?? ''),
                'target_id' => $log->target_id,
                'details' => $log->details,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'success' => true,
            'metrics' => [
                'customers' => [
                    'total' => $totalCustomers,
                    'active' => $activeCustomers,
                    'suspended' => $suspendedCustomers,
                    'recent_30_days' => $recentSignupsCount,
                ],
                'workspaces' => [
                    'total' => $totalWorkspaces,
                    'active' => $activeWorkspaces,
                    'suspended' => $suspendedWorkspaces,
                ],
                'activity' => [
                    'total_cards' => $totalCards,
                    'total_scans' => $totalScans,
                    'recent_scans_30_days' => $recentScansCount,
                    'bulk_batches' => $totalBulkBatches,
                ],
            ],
            'recent_customers' => $recentCustomers,
            'recent_audit_logs' => $recentAuditLogs,
        ]);
    }
}
