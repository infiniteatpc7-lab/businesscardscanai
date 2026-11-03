<?php

namespace App\Http\Middleware;

use App\Models\PlatformAdminToken;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticatePlatformAdmin
{
    /**
     * Handle an incoming request for Platform Admin operations.
     * Platform Admins authenticate exclusively via dedicated PlatformAdminToken records.
     * Customer API tokens, session cookies, and workspace roles are strictly prohibited.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken() ?: $request->header('X-Platform-Admin-Token');

        if (! $token) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated platform administrator access.',
            ], 401);
        }

        $tokenRecord = PlatformAdminToken::findToken($token);

        if (! $tokenRecord || ! $tokenRecord->platformAdmin) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired administrator token.',
            ], 401);
        }

        if ($tokenRecord->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'Administrator session has expired. Please log in again.',
            ], 401);
        }

        $admin = $tokenRecord->platformAdmin;

        if (! $admin->isActive()) {
            return response()->json([
                'success' => false,
                'message' => 'Platform administrator account has been deactivated.',
            ], 403);
        }

        // Touch token usage timestamp
        $tokenRecord->updateQuietly(['last_used_at' => now()]);

        // Attach platform admin to request
        $request->setUserResolver(fn () => $admin);
        $request->attributes->set('platform_admin', $admin);
        $request->attributes->set('platform_admin_token', $tokenRecord);

        return $next($request);
    }
}
