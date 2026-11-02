<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use App\Models\User;
use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = null;

        // 1. Check Bearer token or X-Api-Token header or token query parameter
        $bearerToken = $request->bearerToken();
        if (! $bearerToken) {
            $bearerToken = $request->header('X-Api-Token') ?: $request->query('token');
        }

        if ($bearerToken) {
            $tokenRecord = ApiToken::findToken($bearerToken);
            if ($tokenRecord && $tokenRecord->user) {
                $user = $tokenRecord->user;
            }
        }

        // 2. Fallback to existing session authentication if available
        if (! $user && auth()->check()) {
            $user = auth()->user();
        }

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Valid Bearer token required.',
            ], 401);
        }

        // Attach user to request
        $request->setUserResolver(fn () => $user);

        // 3. Resolve active workspace
        $requestedWorkspaceId = $request->header('X-Workspace-Id') ?: $request->input('workspace_id');
        $workspace = null;

        if ($requestedWorkspaceId) {
            $workspace = Workspace::find($requestedWorkspaceId);
            if (! $workspace || ! $workspace->hasUser($user)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied to the specified workspace.',
                ], 403);
            }
        } else {
            $workspace = $user->currentWorkspace();
        }

        if (! $workspace) {
            return response()->json([
                'success' => false,
                'message' => 'User does not belong to any active workspace.',
            ], 403);
        }

        $role = $workspace->getUserRole($user) ?? 'member';

        // Store workspace & role on request attributes for easy controller access
        $request->attributes->set('workspace', $workspace);
        $request->attributes->set('workspace_role', $role);

        return $next($request);
    }
}
