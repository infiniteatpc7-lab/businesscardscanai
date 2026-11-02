<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    /**
     * Handle an incoming request.
     * Tokens are accepted EXCLUSIVELY via the Authorization: Bearer <token> header.
     * Query string credentials, custom headers, and session fallbacks are strictly disallowed.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = null;
        $tokenRecord = null;

        // 1. Accept API token exclusively through Authorization: Bearer header
        $bearerToken = $request->bearerToken();

        if ($bearerToken) {
            $tokenRecord = ApiToken::findToken($bearerToken);
            if ($tokenRecord && $tokenRecord->user) {
                $user = $tokenRecord->user;
                $request->attributes->set('current_api_token', $tokenRecord);
            }
        }

        // Strict Bearer enforcement: No session fallback permitted on API routes
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated. Valid Bearer token required.',
            ], 401);
        }

        // Attach user to request
        $request->setUserResolver(fn () => $user);

        // 2. Resolve active workspace (honors persistent user selection, with optional header override)
        $requestedWorkspaceId = $request->header('X-Workspace-Id');
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
