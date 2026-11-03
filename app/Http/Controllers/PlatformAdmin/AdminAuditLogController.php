<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\PlatformAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAuditLogController extends Controller
{
    /**
     * List immutable platform audit trail records.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PlatformAuditLog::with('platformAdmin:id,name,email');

        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }

        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('action', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('platformAdmin', function ($aq) use ($search) {
                        $aq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->input('per_page', 25), 10), 100);
        $paginator = $query->latest('id')->paginate($perPage);

        $items = collect($paginator->items())->map(fn (PlatformAuditLog $log) => [
            'id' => $log->id,
            'admin' => $log->platformAdmin ? [
                'id' => $log->platformAdmin->id,
                'name' => $log->platformAdmin->name,
                'email' => $log->platformAdmin->email,
            ] : null,
            'action' => $log->action,
            'target_type' => class_basename($log->target_type ?? ''),
            'target_id' => $log->target_id,
            'details' => $log->details,
            'ip_address' => $log->ip_address,
            'user_agent' => $log->user_agent,
            'created_at' => $log->created_at?->toIso8601String(),
        ]);

        return response()->json([
            'success' => true,
            'logs' => $items,
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }
}
