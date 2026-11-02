<?php

namespace App\Http\Controllers;

use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    /**
     * List all workspaces the authenticated user belongs to with role and counts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $workspaces = $user->workspaces()->withCount(['cards', 'users'])->get()->map(function (Workspace $ws) {
            return [
                'id' => $ws->id,
                'name' => $ws->name,
                'slug' => $ws->slug,
                'role' => $ws->pivot->role ?? 'member',
                'cards_count' => $ws->cards_count,
                'members_count' => $ws->users_count,
                'created_at' => $ws->created_at?->toISOString(),
            ];
        });

        return response()->json([
            'success' => true,
            'workspaces' => $workspaces,
        ]);
    }

    /**
     * Create a new workspace and immediately switch to it.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        $user = $request->user();

        $result = DB::transaction(function () use ($validated, $user) {
            $baseSlug = Str::slug($validated['name']) ?: 'workspace';
            $slug = $baseSlug.'-'.Str::lower(Str::random(6));

            $workspace = Workspace::create([
                'name' => $validated['name'],
                'slug' => $slug,
                'owner_id' => $user->id,
            ]);

            $workspace->users()->attach($user->id, ['role' => 'owner']);
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();

            return $workspace;
        });

        return response()->json([
            'success' => true,
            'message' => 'Workspace created successfully.',
            'workspace' => [
                'id' => $result->id,
                'name' => $result->name,
                'slug' => $result->slug,
                'role' => 'owner',
                'cards_count' => 0,
                'members_count' => 1,
            ],
        ], 201);
    }

    /**
     * List members and pending invitations for a specific workspace.
     */
    public function members(Request $request, int $workspaceId): JsonResponse
    {
        $user = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $members = $workspace->users()->get()->map(function (User $u) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->pivot->role ?? 'member',
                'joined_at' => $u->pivot->created_at?->toISOString(),
            ];
        });

        $invitations = $workspace->invitations()
            ->whereNull('accepted_at')
            ->with('inviter:id,name,email')
            ->get()
            ->map(function (WorkspaceInvitation $inv) {
                return [
                    'id' => $inv->id,
                    'email' => $inv->email,
                    'role' => $inv->role,
                    'inviter' => [
                        'name' => $inv->inviter?->name ?? 'Team Member',
                        'email' => $inv->inviter?->email,
                    ],
                    'expires_at' => $inv->expires_at?->toISOString(),
                    'is_expired' => $inv->isExpired(),
                    'created_at' => $inv->created_at?->toISOString(),
                ];
            });

        return response()->json([
            'success' => true,
            'members' => $members,
            'invitations' => $invitations,
        ]);
    }

    /**
     * Invite a new member to the workspace.
     */
    public function invite(Request $request, int $workspaceId): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|string|email|max:255',
            'role' => 'required|string|in:admin,member',
        ]);

        $user = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $actorRole = $workspace->getUserRole($user);

        if (! Workspace::canInviteRole($actorRole, $validated['role'])) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) does not have permission to invite a {$validated['role']}.",
            ], 403);
        }

        $targetEmail = strtolower(trim($validated['email']));

        // Check if user is already an active member in this workspace
        $existingUser = User::where('email', $targetEmail)->first();
        if ($existingUser && $workspace->hasUser($existingUser)) {
            return response()->json([
                'success' => false,
                'message' => 'User with this email is already a member of this workspace.',
            ], 422);
        }

        $inviteData = WorkspaceInvitation::createInvitation(
            $workspace,
            $user,
            $targetEmail,
            $validated['role']
        );

        $invitation = $inviteData['invitation'];
        $plainToken = $inviteData['plainToken'];

        $baseUrl = config('app.url', url('/'));
        $acceptUrl = rtrim($baseUrl, '/').'/invitations/'.$plainToken;

        $emailSent = false;
        $emailError = null;

        try {
            Mail::to($invitation->email)->send(
                new WorkspaceInvitationMail(
                    workspace: $workspace,
                    inviter: $user,
                    invitation: $invitation,
                    plainToken: $plainToken,
                    acceptUrl: $acceptUrl
                )
            );
            $emailSent = true;
        } catch (Exception $e) {
            Log::warning("Failed to deliver workspace invitation email to {$invitation->email}: ".$e->getMessage());
            $emailError = 'Email delivery could not be completed, but the invitation was created. You can share the invitation link directly.';
        }

        return response()->json([
            'success' => true,
            'message' => $emailSent
                ? 'Invitation sent successfully by email.'
                : ($emailError ?? 'Invitation created. Share the link manually.'),
            'email_sent' => $emailSent,
            'invitation' => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'role' => $invitation->role,
                'expires_at' => $invitation->expires_at?->toISOString(),
            ],
            'invite_token' => $plainToken,
            'invite_link' => $acceptUrl,
        ], 201);
    }

    /**
     * Resend an invitation with a newly rotated token and refreshed expiry.
     */
    public function resendInvitation(Request $request, int $workspaceId, int $invitationId): JsonResponse
    {
        $user = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $actorRole = $workspace->getUserRole($user);

        $invitation = $workspace->invitations()
            ->where('id', $invitationId)
            ->whereNull('accepted_at')
            ->first();

        if (! $invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Pending invitation not found.',
            ], 404);
        }

        if (! Workspace::canInviteRole($actorRole, $invitation->role)) {
            return response()->json([
                'success' => false,
                'message' => 'Permission denied to manage this invitation.',
            ], 403);
        }

        $plainToken = Str::random(40);
        $hashedToken = hash('sha256', $plainToken);

        $invitation->update([
            'token' => $hashedToken,
            'expires_at' => now()->addDays(7),
        ]);

        $baseUrl = config('app.url', url('/'));
        $acceptUrl = rtrim($baseUrl, '/').'/invitations/'.$plainToken;

        $emailSent = false;
        try {
            Mail::to($invitation->email)->send(
                new WorkspaceInvitationMail(
                    workspace: $workspace,
                    inviter: $user,
                    invitation: $invitation,
                    plainToken: $plainToken,
                    acceptUrl: $acceptUrl
                )
            );
            $emailSent = true;
        } catch (Exception $e) {
            Log::warning("Failed to resend workspace invitation email to {$invitation->email}: ".$e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => $emailSent
                ? 'Invitation resent successfully.'
                : 'Invitation token regenerated. Share the link manually.',
            'email_sent' => $emailSent,
            'invite_token' => $plainToken,
            'invite_link' => $acceptUrl,
        ]);
    }

    /**
     * Revoke (delete) a pending invitation.
     */
    public function revokeInvitation(Request $request, int $workspaceId, int $invitationId): JsonResponse
    {
        $user = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $actorRole = $workspace->getUserRole($user);

        $invitation = $workspace->invitations()
            ->where('id', $invitationId)
            ->whereNull('accepted_at')
            ->first();

        if (! $invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Pending invitation not found.',
            ], 404);
        }

        if (! Workspace::canInviteRole($actorRole, $invitation->role)) {
            return response()->json([
                'success' => false,
                'message' => 'Permission denied to revoke this invitation.',
            ], 403);
        }

        $invitation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Invitation revoked successfully.',
        ]);
    }

    /**
     * Accept an invitation using the plaintext token.
     * The authenticated user's email MUST strictly match the invitation email.
     */
    public function acceptInvitation(Request $request, string $token): JsonResponse
    {
        $user = $request->user();
        $invitation = WorkspaceInvitation::findByPlainToken($token);

        if (! $invitation) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid invitation token.',
            ], 404);
        }

        if ($invitation->accepted_at !== null) {
            return response()->json([
                'success' => false,
                'message' => 'This invitation has already been accepted.',
            ], 410);
        }

        if ($invitation->isExpired()) {
            return response()->json([
                'success' => false,
                'message' => 'This invitation has expired. Please ask the inviter to resend it.',
            ], 410);
        }

        // Enforce strict email matching: logged-in user email must match invitation email
        if (strtolower(trim($user->email)) !== strtolower(trim($invitation->email))) {
            return response()->json([
                'success' => false,
                'message' => "This invitation was sent to {$invitation->email}. You are logged in as {$user->email}.",
            ], 403);
        }

        $workspace = $invitation->workspace;

        if (! $workspace) {
            return response()->json([
                'success' => false,
                'message' => 'The associated workspace no longer exists.',
            ], 404);
        }

        // Prevent duplicate acceptance using atomic database lock & transaction
        DB::transaction(function () use ($invitation, $workspace, $user) {
            /** @var WorkspaceInvitation $locked */
            $locked = WorkspaceInvitation::where('id', $invitation->id)->lockForUpdate()->first();

            if (! $locked || $locked->accepted_at !== null) {
                return;
            }

            if (! $workspace->hasUser($user)) {
                $workspace->users()->attach($user->id, ['role' => $locked->role]);
            } else {
                $workspace->users()->updateExistingPivot($user->id, ['role' => $locked->role]);
            }

            $locked->markAccepted();
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        });

        return response()->json([
            'success' => true,
            'message' => "Successfully joined {$workspace->name} as {$invitation->role}.",
            'workspace' => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'role' => $invitation->role,
            ],
        ]);
    }

    /**
     * Update a workspace member's role (enforcing role permissions and sole owner safety).
     */
    public function updateMemberRole(Request $request, int $workspaceId, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'role' => 'required|string|in:admin,member',
        ]);

        $actor = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($actor)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $actorRole = $workspace->getUserRole($actor);
        $targetUser = User::find($userId);

        if (! $targetUser || ! $workspace->hasUser($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'User is not a member of this workspace.',
            ], 404);
        }

        $targetCurrentRole = $workspace->getUserRole($targetUser);

        // Never allow demoting the sole owner
        if ($targetCurrentRole === 'owner' && $workspace->isSoleOwner($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot demote the sole workspace owner.',
            ], 422);
        }

        // Check if actor has permission to manage target's current role
        if (! Workspace::canManageRole($actorRole, $targetCurrentRole)) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) cannot modify a {$targetCurrentRole}.",
            ], 403);
        }

        // Check if actor has permission to assign target new role
        if (! Workspace::canInviteRole($actorRole, $validated['role'])) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) cannot assign role {$validated['role']}.",
            ], 403);
        }

        $workspace->users()->updateExistingPivot($targetUser->id, ['role' => $validated['role']]);

        return response()->json([
            'success' => true,
            'message' => "Member role updated to {$validated['role']}.",
            'member' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $validated['role'],
            ],
        ]);
    }

    /**
     * Remove a member from the workspace without deleting user account or shared cards.
     */
    public function removeMember(Request $request, int $workspaceId, int $userId): JsonResponse
    {
        $actor = $request->user();
        $workspace = Workspace::find($workspaceId);

        if (! $workspace || ! $workspace->hasUser($actor)) {
            return response()->json([
                'success' => false,
                'message' => 'Access denied to this workspace.',
            ], 403);
        }

        $actorRole = $workspace->getUserRole($actor);
        $targetUser = User::find($userId);

        if (! $targetUser || ! $workspace->hasUser($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'User is not a member of this workspace.',
            ], 404);
        }

        $targetRole = $workspace->getUserRole($targetUser);

        // Disallow removing sole owner
        if ($targetRole === 'owner' && $workspace->isSoleOwner($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot remove the sole workspace owner.',
            ], 422);
        }

        // Check permissions: Owner can remove Admin/Member; Admin can remove Member; Member cannot remove anyone
        // Exception: A user can leave a workspace themselves unless they are the sole owner
        $isSelfLeaving = $actor->id === $targetUser->id;

        if (! $isSelfLeaving && ! Workspace::canManageRole($actorRole, $targetRole)) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) does not have permission to remove a {$targetRole}.",
            ], 403);
        }

        DB::transaction(function () use ($workspace, $targetUser) {
            // Detach user from workspace without deleting user or cards
            $workspace->users()->detach($targetUser->id);

            // If this was the user's active workspace, switch to another workspace they belong to
            if ($targetUser->current_workspace_id === $workspace->id) {
                $fallback = $targetUser->workspaces()->first();
                $targetUser->forceFill([
                    'current_workspace_id' => $fallback?->id,
                ])->save();
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Member removed from workspace successfully.',
        ]);
    }
}
