<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * User registration with automatic workspace creation inside an atomic database transaction.
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'workspace_name' => 'nullable|string|max:255',
        ]);

        $result = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
            ]);

            $wsName = $validated['workspace_name'] ?: ($user->name."'s Workspace");
            $baseSlug = Str::slug($wsName) ?: 'workspace';
            $slug = $baseSlug.'-'.Str::lower(Str::random(6));

            $workspace = Workspace::create([
                'name' => $wsName,
                'slug' => $slug,
                'owner_id' => $user->id,
            ]);

            $workspace->users()->attach($user->id, ['role' => 'owner']);

            $tokenData = $user->createToken('register_token');

            return [
                'user' => $user,
                'workspace' => $workspace,
                'token' => $tokenData['plain_token'],
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'User and workspace registered successfully.',
            'token' => $result['token'],
            'user' => [
                'id' => $result['user']->id,
                'name' => $result['user']->name,
                'email' => $result['user']->email,
            ],
            'workspace' => [
                'id' => $result['workspace']->id,
                'name' => $result['workspace']->name,
                'slug' => $result['workspace']->slug,
                'role' => 'owner',
            ],
        ], 201);
    }

    /**
     * User login with generic failure response to prevent user enumeration.
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid credentials.',
            ], 401);
        }

        $tokenData = $user->createToken('login_token');
        $workspace = $user->currentWorkspace();

        return response()->json([
            'success' => true,
            'message' => 'Logged in successfully.',
            'token' => $tokenData['plain_token'],
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'workspace' => $workspace ? [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $workspace->getUserRole($user),
            ] : null,
        ]);
    }

    /**
     * Log out and revoke exclusively the current authenticated Bearer token.
     */
    public function logout(Request $request): JsonResponse
    {
        $bearerToken = $request->bearerToken();

        if ($bearerToken) {
            $hashed = hash('sha256', $bearerToken);
            ApiToken::where('user_id', $request->user()->id)
                ->where('token', $hashed)
                ->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully. Token revoked.',
        ]);
    }

    /**
     * Get the authenticated user's profile and active workspace.
     */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user();
        /** @var Workspace $workspace */
        $workspace = $request->attributes->get('workspace');
        $role = $request->attributes->get('workspace_role');

        $allWorkspaces = $user->workspaces->map(fn ($ws) => [
            'id' => $ws->id,
            'name' => $ws->name,
            'slug' => $ws->slug,
            'role' => $ws->pivot->role ?? 'member',
        ]);

        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
            'current_workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $role,
            ],
            'workspaces' => $allWorkspaces,
        ]);
    }

    /**
     * Switch current active workspace.
     */
    public function switchWorkspace(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'workspace_id' => 'required|integer|exists:workspaces,id',
        ]);

        $user = $request->user();
        $workspace = Workspace::find($validated['workspace_id']);

        if (! $workspace || ! $workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have access to this workspace.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'message' => 'Workspace switched successfully.',
            'current_workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $workspace->getUserRole($user),
            ],
        ]);
    }
}
