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
     * Tokens are accepted EXCLUSIVELY via the Authorization: Bearer <token> header.
     * Query string credentials and custom headers are strictly disallowed.
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

        // 2. Fallback to existing framework auth session (e.g. for testing or stateful sessions)
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
