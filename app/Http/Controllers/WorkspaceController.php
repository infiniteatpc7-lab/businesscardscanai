<?php

namespace App\Http\Controllers;

use App\Mail\WorkspaceInvitationMail;
use App\Models\Plan;
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

        // Enforce plan workspace limits
        $primaryWs = ($user->current_workspace_id ? Workspace::find($user->current_workspace_id) : null) ?? Workspace::where('owner_id', $user->id)->first();
        $plan = $primaryWs?->currentPlan() ?? Plan::getDefaultPlan();
        if ($plan && ! $plan->isUnlimited('max_workspaces')) {
            $maxWs = $plan->max_workspaces ?? 1;
            $ownedCount = Workspace::where('owner_id', $user->id)->count();
            if ($ownedCount >= $maxWs) {
                return response()->json([
                    'success' => false,
                    'error_code' => 'PLAN_LIMIT_EXCEEDED',
                    'message' => "Workspace limit of {$maxWs} reached for your account. Please upgrade your plan to create more workspaces.",
                    'limit' => 'max_workspaces',
                    'current_count' => $ownedCount,
                    'max_allowed' => $maxWs,
                ], 403);
            }
        }

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
     * Restricted strictly to Workspace Owners and Admins.
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

        $actorRole = $workspace->getUserRole($user);

        if (! Workspace::canViewTeam($actorRole)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only workspace owners and admins can view team members.',
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

        $invitationsQuery = $workspace->invitations()
            ->whereNull('accepted_at')
            ->with('inviter:id,name,email');

        // Admins can only view and manage Member invitations
        if ($actorRole === 'admin') {
            $invitationsQuery->where('role', 'member');
        }

        $invitations = $invitationsQuery->get()->map(function (WorkspaceInvitation $inv) {
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

        // Enforce plan team member limits
        if (! $workspace->canInviteMoreMembers()) {
            $limit = $workspace->currentPlan()->max_team_members ?? 1;

            return response()->json([
                'success' => false,
                'error_code' => 'PLAN_LIMIT_EXCEEDED',
                'message' => "Team member limit of {$limit} reached for this workspace. Please upgrade your plan to invite more members.",
                'limit' => 'max_team_members',
                'max_allowed' => $limit,
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

        $baseUrl = $this->resolveBaseUrl($request);
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

            if (config('mail.default') === 'log' && ! app()->runningUnitTests()) {
                $emailSent = false;
                $emailError = 'Invitation email written to system log (SMTP not configured). Share the invitation link directly.';
            } else {
                $emailSent = true;
            }
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

        $baseUrl = $this->resolveBaseUrl($request);
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

            if (config('mail.default') === 'log' && ! app()->runningUnitTests()) {
                $emailSent = false;
                $emailError = 'Invitation email written to system log (SMTP not configured). Share the invitation link directly.';
            } else {
                $emailSent = true;
            }
        } catch (Exception $e) {
            Log::warning("Failed to resend workspace invitation email to {$invitation->email}: ".$e->getMessage());
            $emailError = 'Email delivery could not be completed. You can share the invitation link directly.';
        }

        return response()->json([
            'success' => true,
            'message' => $emailSent
                ? 'Invitation resent successfully.'
                : ($emailError ?? 'Invitation token regenerated. Share the link manually.'),
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
     * Prevents race conditions, duplicate acceptance, and role overwriting.
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

        // Check if user is already an active member before transaction
        if ($workspace->hasUser($user)) {
            return response()->json([
                'success' => false,
                'message' => "You are already a member of {$workspace->name}. Your existing role will not be changed.",
            ], 422);
        }

        // Atomic transaction with row locking
        $result = DB::transaction(function () use ($invitation, $workspace, $user) {
            /** @var WorkspaceInvitation|null $locked */
            $locked = WorkspaceInvitation::where('id', $invitation->id)->lockForUpdate()->first();

            if (! $locked) {
                return ['status' => 'not_found'];
            }

            if ($locked->accepted_at !== null) {
                return ['status' => 'already_accepted'];
            }

            if ($locked->isExpired()) {
                return ['status' => 'expired'];
            }

            // Double check membership inside row lock to eliminate race conditions
            if ($workspace->users()->where('users.id', $user->id)->exists()) {
                return ['status' => 'already_member'];
            }

            // Attach user with invited role
            $workspace->users()->attach($user->id, ['role' => $locked->role]);

            // Mark invitation accepted
            $locked->markAccepted();

            // Switch to accepted workspace
            $user->forceFill(['current_workspace_id' => $workspace->id])->save();

            return [
                'status' => 'success',
                'role' => $locked->role,
                'workspace_id' => $workspace->id,
                'workspace_name' => $workspace->name,
                'workspace_slug' => $workspace->slug,
            ];
        });

        if ($result['status'] === 'already_accepted') {
            return response()->json([
                'success' => false,
                'message' => 'This invitation has already been accepted.',
            ], 410);
        }

        if ($result['status'] === 'expired') {
            return response()->json([
                'success' => false,
                'message' => 'This invitation has expired. Please ask the inviter to resend it.',
            ], 410);
        }

        if ($result['status'] === 'already_member') {
            return response()->json([
                'success' => false,
                'message' => "You are already a member of {$workspace->name}. Your existing role will not be changed.",
            ], 422);
        }

        if ($result['status'] !== 'success') {
            return response()->json([
                'success' => false,
                'message' => 'Could not accept invitation.',
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully joined {$result['workspace_name']} as {$result['role']}.",
            'workspace' => [
                'id' => $result['workspace_id'],
                'name' => $result['workspace_name'],
                'slug' => $result['workspace_slug'],
                'role' => $result['role'],
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

        if ($actorRole === 'member') {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Members cannot manage member roles.',
            ], 403);
        }

        $targetUser = User::find($userId);

        if (! $targetUser || ! $workspace->hasUser($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'User is not a member of this workspace.',
            ], 404);
        }

        $targetCurrentRole = $workspace->getUserRole($targetUser);

        // 1. Admins and Members cannot modify an Owner
        if ($targetCurrentRole === 'owner' && $actorRole !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) cannot modify a {$targetCurrentRole}.",
            ], 403);
        }

        // 2. Demoting the sole owner is blocked
        if ($targetCurrentRole === 'owner' && $workspace->isSoleOwner($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot demote the sole workspace owner.',
            ], 422);
        }

        // 3. Prevent self-role modification (self-promotion or self-demotion)
        if ($actor->id === $targetUser->id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot change your own role.',
            ], 403);
        }

        // 4. Check if actor has permission to manage target's current role
        if (! Workspace::canManageRole($actorRole, $targetCurrentRole)) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) cannot modify a {$targetCurrentRole}.",
            ], 403);
        }

        // 5. Check if actor has permission to assign target new role
        if (! Workspace::canInviteRole($actorRole, $validated['role'])) {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) cannot assign role {$validated['role']}.",
            ], 403);
        }

        $updateResult = DB::transaction(function () use ($workspace, $targetUser, $validated) {
            $workspace->users()->updateExistingPivot($targetUser->id, ['role' => $validated['role']]);

            return ['success' => true];
        });

        if (! $updateResult['success']) {
            return response()->json([
                'success' => false,
                'message' => $updateResult['message'],
            ], $updateResult['status']);
        }

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
        $isSelfLeaving = $actor->id === $targetUser->id;

        // 1. Admins and Members cannot remove an Owner
        if ($targetRole === 'owner' && $actorRole !== 'owner') {
            return response()->json([
                'success' => false,
                'message' => "Your role ({$actorRole}) does not have permission to remove a {$targetRole}.",
            ], 403);
        }

        // 2. Disallow removing sole owner (even if the sole owner attempts self-removal/leaving)
        if ($targetRole === 'owner' && $workspace->isSoleOwner($targetUser)) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot remove the sole workspace owner.',
            ], 422);
        }

        // 3. Members cannot remove other members
        if ($actorRole === 'member' && ! $isSelfLeaving) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Members cannot remove other members.',
            ], 403);
        }

        // 4. Admins cannot remove other Admins
        if ($actorRole === 'admin' && ! $isSelfLeaving && $targetRole !== 'member') {
            return response()->json([
                'success' => false,
                'message' => 'Admins can only remove Members.',
            ], 403);
        }

        // 5. If an actor is attempting to remove someone else, check role management authorization
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

    /**
     * Dynamically resolve the application base URL using the active request host,
     * request port, and substituting local LAN IP for localhost so physical phone devices
     * on the same network can access the invitation links directly.
     */
    protected function resolveBaseUrl(Request $request): string
    {
        $scheme = $request->getScheme() ?: 'http';
        $host = $request->getHost();
        $port = $request->getPort();

        // If request was initiated from localhost or loopback, substitute local LAN IP
        if (in_array($host, ['localhost', '127.0.0.1', '::1', '0.0.0.0'], true) && ! app()->runningUnitTests()) {
            $lanIp = gethostbyname(gethostname());
            if ($lanIp && filter_var($lanIp, FILTER_VALIDATE_IP) && ! in_array($lanIp, ['127.0.0.1', '::1'], true)) {
                $host = $lanIp;
            }
        }

        $formattedPort = ($port && ! in_array($port, [80, 443], true)) ? ":{$port}" : '';

        return "{$scheme}://{$host}{$formattedPort}";
    }
}
