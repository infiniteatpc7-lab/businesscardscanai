<?php

namespace App\Http\Controllers\PlatformAdmin;

use App\Http\Controllers\Controller;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\PlatformAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthController extends Controller
{
    /**
     * Authenticate Platform Administrator and issue a dedicated admin session token.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $admin = PlatformAdmin::where('email', strtolower(trim($validated['email'])))->first();

        if (! $admin || ! Hash::check($validated['password'], $admin->password)) {
            PlatformAuditLog::record(
                null,
                'platform_admin.login_failed',
                null,
                ['email' => $validated['email']],
                $request
            );

            return response()->json([
                'success' => false,
                'message' => 'Invalid administrator credentials.',
            ], 401);
        }

        if (! $admin->isActive()) {
            PlatformAuditLog::record(
                $admin,
                'platform_admin.login_blocked_deactivated',
                $admin,
                null,
                $request
            );

            return response()->json([
                'success' => false,
                'message' => 'This administrator account is deactivated.',
            ], 403);
        }

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin, 'platform_admin_session');

        $admin->updateQuietly([
            'last_login_at' => now(),
        ]);

        PlatformAuditLog::record(
            $admin,
            'platform_admin.login',
            $admin,
            ['session_token_id' => $tokenResult['model']->id],
            $request
        );

        return response()->json([
            'success' => true,
            'token' => $tokenResult['token'],
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
                'last_login_at' => $admin->last_login_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Return currently authenticated Platform Administrator profile.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');

        return response()->json([
            'success' => true,
            'admin' => [
                'id' => $admin->id,
                'name' => $admin->name,
                'email' => $admin->email,
                'role' => $admin->role,
                'status' => $admin->status,
                'last_login_at' => $admin->last_login_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Terminate the administrator session token.
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var PlatformAdmin $admin */
        $admin = $request->attributes->get('platform_admin');
        /** @var PlatformAdminToken|null $token */
        $token = $request->attributes->get('platform_admin_token');

        if ($token) {
            $token->delete();
        }

        PlatformAuditLog::record($admin, 'platform_admin.logout', $admin, null, $request);

        return response()->json([
            'success' => true,
            'message' => 'Administrator session terminated successfully.',
        ]);
    }
}
