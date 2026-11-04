<?php

namespace Tests\Feature;

use App\Mail\WorkspaceInvitationMail;
use App\Models\Card;
use App\Models\Plan;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class WorkspaceTeamManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUser(string $name, string $email, string $role = 'owner'): array
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
        ]);

        $workspace = Workspace::create([
            'name' => "{$name}'s Workspace",
            'slug' => "ws-{$user->id}-".uniqid(),
            'owner_id' => $role === 'owner' ? $user->id : null,
        ]);

        $workspace->users()->attach($user->id, ['role' => $role]);
        $user->forceFill(['current_workspace_id' => $workspace->id])->save();

        $businessPlan = Plan::where('slug', 'business')->first();
        if ($businessPlan) {
            $workspace->activeSubscription()->update(['plan_id' => $businessPlan->id]);
        }

        $tokenData = $user->createToken('test_token');

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenData['plain_token'],
            'token_model' => $tokenData['token_model'],
        ];
    }

    /**
     * 1. Authenticated user can create an additional workspace and it becomes active.
     */
    public function test_authenticated_user_can_create_additional_workspace(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/workspaces', [
            'name' => 'Secondary Booth 2026',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('workspace.name', 'Secondary Booth 2026')
            ->assertJsonPath('workspace.role', 'owner');

        $this->assertDatabaseHas('workspaces', [
            'name' => 'Secondary Booth 2026',
            'owner_id' => $owner['user']->id,
        ]);

        $owner['user']->refresh();
        $this->assertEquals($response->json('workspace.id'), $owner['user']->current_workspace_id);
    }

    /**
     * 2. Listing workspaces returns all workspaces with membership roles and counts.
     */
    public function test_workspaces_listing_api_returns_roles_and_counts(): void
    {
        $owner = $this->createWorkspaceUser('Multi Owner', 'multi@example.com');

        // Create card in first workspace
        Card::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'John Doe',
            'company' => 'Alpha Tiles',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->getJson('/api/workspaces');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('workspaces.0.cards_count', 1)
            ->assertJsonPath('workspaces.0.members_count', 1)
            ->assertJsonPath('workspaces.0.role', 'owner');
    }

    /**
     * 3. Owner can invite Admin and Member.
     */
    public function test_owner_can_invite_admin_and_member(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Main Owner', 'boss@example.com');

        // Invite Admin
        $resAdmin = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);

        $resAdmin->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('invitation.email', 'admin@example.com')
            ->assertJsonPath('invitation.role', 'admin');

        $this->assertNotEmpty($resAdmin->json('invite_token'));
        $this->assertNotEmpty($resAdmin->json('invite_link'));

        // Invite Member
        $resMember = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'staff@example.com',
            'role' => 'member',
        ]);

        $resMember->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('invitation.role', 'member');

        Mail::assertSent(WorkspaceInvitationMail::class, 2);
    }

    /**
     * 4. Admin can only invite Member, NOT Admin.
     */
    public function test_admin_can_invite_member_but_cannot_invite_admin(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Main Owner', 'owner@example.com');

        // Create an Admin in this workspace
        $adminUser = User::create([
            'name' => 'Workspace Admin',
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($adminUser->id, ['role' => 'admin']);
        $adminToken = $adminUser->createToken('admin_token')['plain_token'];

        // Admin inviting Member -> allowed
        $resMember = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'boothstaff@example.com',
            'role' => 'member',
        ]);
        $resMember->assertStatus(201);

        // Admin inviting Admin -> 403 Forbidden
        $resAdmin = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'anotheradmin@example.com',
            'role' => 'admin',
        ]);
        $resAdmin->assertStatus(403);
    }

    /**
     * 5. Regular Member cannot invite anyone.
     */
    public function test_member_cannot_invite_anyone(): void
    {
        $owner = $this->createWorkspaceUser('Main Owner', 'owner@example.com');

        $memberUser = User::create([
            'name' => 'Regular Member',
            'email' => 'member@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($memberUser->id, ['role' => 'member']);
        $memberToken = $memberUser->createToken('member_token')['plain_token'];

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$memberToken,
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'other@example.com',
            'role' => 'member',
        ]);

        $res->assertStatus(403);
    }

    /**
     * 6. Invitation token is stored only as SHA-256 hash in database.
     */
    public function test_invitation_token_is_hashed_and_not_stored_plaintext(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Hash', 'ownerhash@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'verifyhash@example.com',
            'role' => 'member',
        ]);

        $plainToken = $res->json('invite_token');
        $this->assertNotEmpty($plainToken);

        // Verify the plaintext token does NOT exist in the database table
        $this->assertDatabaseMissing('workspace_invitations', [
            'token' => $plainToken,
        ]);

        // Verify the SHA-256 hash DOES exist
        $this->assertDatabaseHas('workspace_invitations', [
            'token' => hash('sha256', $plainToken),
            'email' => 'verifyhash@example.com',
        ]);
    }

    /**
     * 7. Existing user can accept invitation if authenticated email matches.
     */
    public function test_existing_user_with_matching_email_can_accept_invitation(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Org', 'ownerorg@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'invitee@example.com',
            'role' => 'member',
        ]);

        $plainToken = $res->json('invite_token');

        // Create the invitee user account
        $invitee = User::create([
            'name' => 'Invited Colleague',
            'email' => 'invitee@example.com',
            'password' => bcrypt('password123'),
        ]);
        $inviteeToken = $invitee->createToken('invitee_token')['plain_token'];

        // Accept invitation
        $acceptRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$inviteeToken,
        ])->postJson("/api/invitations/{$plainToken}/accept");

        $acceptRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('workspace.id', $owner['workspace']->id);

        $this->assertTrue($owner['workspace']->hasUser($invitee));
        $this->assertEquals('member', $owner['workspace']->getUserRole($invitee));

        $invitee->refresh();
        $this->assertEquals($owner['workspace']->id, $invitee->current_workspace_id);
    }

    /**
     * 8. Invitation cannot be accepted by a user with a different email.
     */
    public function test_cannot_accept_invitation_with_mismatched_email(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Org', 'ownerorg2@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'intended@example.com',
            'role' => 'member',
        ]);

        $plainToken = $res->json('invite_token');

        // Another user logs in with different email
        $intruder = User::create([
            'name' => 'Intruder',
            'email' => 'intruder@example.com',
            'password' => bcrypt('password123'),
        ]);
        $intruderToken = $intruder->createToken('intruder_token')['plain_token'];

        $acceptRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$intruderToken,
        ])->postJson("/api/invitations/{$plainToken}/accept");

        $acceptRes->assertStatus(403);
        $this->assertFalse($owner['workspace']->hasUser($intruder));
    }

    /**
     * 9. Invitation token is strictly single-use.
     */
    public function test_invitation_token_is_single_use(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Single', 'ownersingle@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'singleuse@example.com',
            'role' => 'member',
        ]);

        $plainToken = $res->json('invite_token');

        $user = User::create([
            'name' => 'Single Use User',
            'email' => 'singleuse@example.com',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('token')['plain_token'];

        // First acceptance -> 200 OK
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$plainToken}/accept")
            ->assertStatus(200);

        // Second acceptance attempt -> 410 Gone / Already accepted
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$plainToken}/accept")
            ->assertStatus(410);
    }

    /**
     * 10. Expired invitation cannot be accepted.
     */
    public function test_expired_invitation_cannot_be_accepted(): void
    {
        $owner = $this->createWorkspaceUser('Owner Exp', 'ownerexp@example.com');

        $inviteData = WorkspaceInvitation::createInvitation(
            $owner['workspace'],
            $owner['user'],
            'expired@example.com',
            'member',
            -1 // Expired yesterday
        );

        $plainToken = $inviteData['plainToken'];

        $user = User::create([
            'name' => 'Expired User',
            'email' => 'expired@example.com',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('token')['plain_token'];

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$plainToken}/accept")
            ->assertStatus(410);
    }

    /**
     * 11. Resending invitation rotates token and invalidates old one.
     */
    public function test_resending_invitation_rotates_token_and_invalidates_previous(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Resend', 'ownerresend@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'resendtest@example.com',
            'role' => 'member',
        ]);

        $oldToken = $res->json('invite_token');
        $invitationId = $res->json('invitation.id');

        // Resend
        $resendRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations/{$invitationId}/resend");

        $resendRes->assertStatus(200);
        $newToken = $resendRes->json('invite_token');

        $this->assertNotEquals($oldToken, $newToken);

        $user = User::create([
            'name' => 'Resend User',
            'email' => 'resendtest@example.com',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('token')['plain_token'];

        // Old token must fail
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$oldToken}/accept")
            ->assertStatus(404);

        // New token must succeed
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$newToken}/accept")
            ->assertStatus(200);
    }

    /**
     * 12. Revoking an invitation prevents acceptance.
     */
    public function test_revoking_invitation_prevents_acceptance(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Revoke', 'ownerrev@example.com');

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson("/api/workspaces/{$owner['workspace']->id}/invitations", [
            'email' => 'revoketest@example.com',
            'role' => 'member',
        ]);

        $plainToken = $res->json('invite_token');
        $invitationId = $res->json('invitation.id');

        // Revoke
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->deleteJson("/api/workspaces/{$owner['workspace']->id}/invitations/{$invitationId}")
            ->assertStatus(200);

        $user = User::create([
            'name' => 'Revoke User',
            'email' => 'revoketest@example.com',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('token')['plain_token'];

        // Try accepting revoked token -> 404
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson("/api/invitations/{$plainToken}/accept")
            ->assertStatus(404);
    }

    /**
     * 13. Protection of sole workspace owner: cannot be removed or demoted.
     */
    public function test_sole_owner_cannot_be_removed_or_demoted(): void
    {
        $owner = $this->createWorkspaceUser('Sole Owner', 'sole@example.com');

        // Try demoting sole owner -> 422 Unprocessable
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$owner['user']->id}", [
            'role' => 'admin',
        ])->assertStatus(422);

        // Try removing sole owner -> 422 Unprocessable
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->deleteJson("/api/workspaces/{$owner['workspace']->id}/members/{$owner['user']->id}")
            ->assertStatus(422);
    }

    /**
     * 14. Admin cannot manage or remove other Admins.
     */
    public function test_admin_cannot_modify_or_remove_other_admins(): void
    {
        $owner = $this->createWorkspaceUser('Workspace Owner', 'orgowner@example.com');

        // Create Admin 1
        $admin1 = User::create(['name' => 'Admin 1', 'email' => 'admin1@example.com', 'password' => bcrypt('pw')]);
        $owner['workspace']->users()->attach($admin1->id, ['role' => 'admin']);
        $admin1Token = $admin1->createToken('admin1_tok')['plain_token'];

        // Create Admin 2
        $admin2 = User::create(['name' => 'Admin 2', 'email' => 'admin2@example.com', 'password' => bcrypt('pw')]);
        $owner['workspace']->users()->attach($admin2->id, ['role' => 'admin']);

        // Admin 1 attempts to remove Admin 2 -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$admin1Token,
        ])->deleteJson("/api/workspaces/{$owner['workspace']->id}/members/{$admin2->id}")
            ->assertStatus(403);

        // Admin 1 attempts to demote Admin 2 -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$admin1Token,
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$admin2->id}", [
            'role' => 'member',
        ])->assertStatus(403);
    }

    /**
     * 15. Removing a member does NOT delete their user account or shared workspace cards.
     */
    public function test_removing_member_preserves_user_account_and_shared_cards(): void
    {
        $owner = $this->createWorkspaceUser('Company Owner', 'compowner@example.com');

        $staffUser = User::create([
            'name' => 'Staff Member',
            'email' => 'staffmem@example.com',
            'password' => bcrypt('pw'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($staffUser->id, ['role' => 'member']);

        // Staff member scanned a card in this workspace
        $staffCard = Card::create([
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $staffUser->id,
            'name' => 'Lead Contact',
            'company' => 'Ceramic Corp',
        ]);

        // Owner removes the member
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->deleteJson("/api/workspaces/{$owner['workspace']->id}/members/{$staffUser->id}")
            ->assertStatus(200);

        // Assert member detached from workspace
        $this->assertFalse($owner['workspace']->hasUser($staffUser));

        // Assert user account STILL exists in database
        $this->assertDatabaseHas('users', [
            'id' => $staffUser->id,
            'email' => 'staffmem@example.com',
        ]);

        // Assert card STILL exists in workspace
        $this->assertDatabaseHas('cards', [
            'id' => $staffCard->id,
            'workspace_id' => $owner['workspace']->id,
        ]);
    }

    /**
     * 16. Card editing updates fields in database and respects workspace scoping.
     */
    public function test_card_editing_is_workspace_scoped_and_updates_data(): void
    {
        $ownerA = $this->createWorkspaceUser('Owner A', 'ownera@example.com');
        $ownerB = $this->createWorkspaceUser('Owner B', 'ownerb@example.com');

        $cardA = Card::create([
            'workspace_id' => $ownerA['workspace']->id,
            'name' => 'Original Name',
            'company' => 'Original Company',
        ]);

        // Owner B attempts to edit Card A in Workspace A -> 404
        $this->withHeaders([
            'Authorization' => 'Bearer '.$ownerB['token'],
        ])->putJson("/api/cards/{$cardA->id}", [
            'name' => 'Hacked Name',
        ])->assertStatus(404);

        // Owner A updates Card A -> 200 OK
        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$ownerA['token'],
        ])->putJson("/api/cards/{$cardA->id}", [
            'name' => 'Updated Person Name',
            'company' => 'Updated Ceramic Firm',
            'phone' => ['+91 9876543210'],
            'email' => 'updated@firm.com',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('card.name', 'Updated Person Name')
            ->assertJsonPath('card.company', 'Updated Ceramic Firm');

        $this->assertDatabaseHas('cards', [
            'id' => $cardA->id,
            'name' => 'Updated Person Name',
            'email' => 'updated@firm.com',
        ]);
    }

    /**
     * 17. POST /api/scan endpoint is rate-limited.
     */
    public function test_scan_endpoint_is_rate_limited(): void
    {
        $owner = $this->createWorkspaceUser('Scan Owner', 'scanowner@example.com');

        // Send requests up to throttle limit (20 req/min)
        for ($i = 0; $i < 20; $i++) {
            $res = $this->withHeaders([
                'Authorization' => 'Bearer '.$owner['token'],
            ])->postJson('/api/scan', []);

            // 422 because empty body, but importantly not 429 yet
            $this->assertNotEquals(429, $res->status());
        }

        // 21st request should be throttled with 429
        $throttledRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/scan', []);

        $throttledRes->assertStatus(429);
    }

    /**
     * 18. Member cannot retrieve team members or pending invitations.
     */
    public function test_member_cannot_retrieve_team_members_or_invitations(): void
    {
        $owner = $this->createWorkspaceUser('Owner Secure', 'secureowner@example.com');

        $member = User::create([
            'name' => 'Regular Staff',
            'email' => 'regularstaff@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($member->id, ['role' => 'member']);
        $memberToken = $member->createToken('member_token')['plain_token'];

        // Member calling members list -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$memberToken,
        ])->getJson("/api/workspaces/{$owner['workspace']->id}/members")
            ->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    /**
     * 19. Admin sees only member invitations, never admin invitations.
     */
    public function test_admin_only_sees_member_invitations(): void
    {
        Mail::fake();

        $owner = $this->createWorkspaceUser('Owner Filter', 'filterowner@example.com');

        $admin = User::create([
            'name' => 'Workspace Admin',
            'email' => 'adminfilter@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($admin->id, ['role' => 'admin']);
        $adminToken = $admin->createToken('admin_token')['plain_token'];

        // Owner creates 1 Admin invite and 1 Member invite
        WorkspaceInvitation::createInvitation($owner['workspace'], $owner['user'], 'pendingadmin@example.com', 'admin');
        WorkspaceInvitation::createInvitation($owner['workspace'], $owner['user'], 'pendingmember@example.com', 'member');

        // Admin checks members endpoint
        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->getJson("/api/workspaces/{$owner['workspace']->id}/members");

        $res->assertStatus(200);
        $invitations = $res->json('invitations');

        $this->assertCount(1, $invitations);
        $this->assertEquals('member', $invitations[0]['role']);
        $this->assertEquals('pendingmember@example.com', $invitations[0]['email']);
    }

    /**
     * 20. Users cannot modify their own role (self-promotion or self-demotion is blocked).
     */
    public function test_self_role_modification_is_blocked(): void
    {
        $owner = $this->createWorkspaceUser('Owner Self', 'ownerself@example.com');

        $admin = User::create([
            'name' => 'Self Admin',
            'email' => 'selfadmin@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($admin->id, ['role' => 'admin']);
        $adminToken = $admin->createToken('admin_token')['plain_token'];

        // Admin attempting to change own role -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$admin->id}", [
            'role' => 'member',
        ])->assertStatus(403)
            ->assertJsonPath('message', 'You cannot change your own role.');
    }

    /**
     * 21. Existing workspace member cannot have their role overwritten by an invitation.
     */
    public function test_existing_workspace_member_cannot_have_role_overwritten_by_invitation(): void
    {
        $owner = $this->createWorkspaceUser('Owner Overwrite', 'owneroverwrite@example.com');

        $member = User::create([
            'name' => 'Existing Member',
            'email' => 'existingmember@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($member->id, ['role' => 'member']);
        $memberToken = $member->createToken('member_token')['plain_token'];

        // An invitation was somehow issued for this email with 'admin' role
        $inviteData = WorkspaceInvitation::createInvitation(
            $owner['workspace'],
            $owner['user'],
            'existingmember@example.com',
            'admin'
        );

        // Member tries to accept to upgrade to admin -> 422 Unprocessable
        $this->withHeaders([
            'Authorization' => 'Bearer '.$memberToken,
        ])->postJson("/api/invitations/{$inviteData['plainToken']}/accept")
            ->assertStatus(422)
            ->assertJsonPath('success', false);

        // Verify role remained 'member'
        $this->assertEquals('member', $owner['workspace']->getUserRole($member));
    }

    /**
     * 22. Removed member immediately loses access to workspace, but retains access to their other workspaces.
     */
    public function test_removed_member_loses_access_immediately_but_retains_other_workspaces(): void
    {
        $ownerA = $this->createWorkspaceUser('Owner A', 'ownerA_test@example.com');
        $ownerB = $this->createWorkspaceUser('Owner B', 'ownerB_test@example.com');

        // User belongs to both Workspace A and Workspace B
        $user = User::create([
            'name' => 'Dual Member',
            'email' => 'dual@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $ownerA['workspace']->id,
        ]);
        $ownerA['workspace']->users()->attach($user->id, ['role' => 'member']);
        $ownerB['workspace']->users()->attach($user->id, ['role' => 'member']);
        $userToken = $user->createToken('dual_token')['plain_token'];

        // Create cards in both workspaces
        $cardA = Card::create(['workspace_id' => $ownerA['workspace']->id, 'name' => 'Card In A']);
        $cardB = Card::create(['workspace_id' => $ownerB['workspace']->id, 'name' => 'Card In B']);

        // Owner A removes the member from Workspace A
        $this->withHeaders([
            'Authorization' => 'Bearer '.$ownerA['token'],
        ])->deleteJson("/api/workspaces/{$ownerA['workspace']->id}/members/{$user->id}")
            ->assertStatus(200);

        // User attempting to access cards in Workspace A via X-Workspace-Id header -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userToken,
            'X-Workspace-Id' => (string) $ownerA['workspace']->id,
        ])->getJson('/api/cards')
            ->assertStatus(403);

        // User accessing cards in Workspace B -> 200 OK
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userToken,
            'X-Workspace-Id' => (string) $ownerB['workspace']->id,
        ])->getJson('/api/cards')
            ->assertStatus(200)
            ->assertJsonPath('success', true);
    }

    /**
     * 23. Owner can promote Member to Admin and demote Admin to Member.
     */
    public function test_owner_can_promote_and_demote_team_members(): void
    {
        $owner = $this->createWorkspaceUser('Owner Hierarchy', 'ownerhierarchy@example.com');

        $staff = User::create([
            'name' => 'Staff Hierarchy',
            'email' => 'staffhier@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($staff->id, ['role' => 'member']);

        // 1. Promote Member -> Admin
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$staff->id}", [
            'role' => 'admin',
        ])->assertStatus(200)
            ->assertJsonPath('member.role', 'admin');

        $this->assertEquals('admin', $owner['workspace']->getUserRole($staff));

        // 2. Demote Admin -> Member
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$staff->id}", [
            'role' => 'member',
        ])->assertStatus(200)
            ->assertJsonPath('member.role', 'member');

        $this->assertEquals('member', $owner['workspace']->getUserRole($staff));
    }

    /**
     * 24. Admin cannot modify or remove workspace Owner.
     */
    public function test_admin_cannot_modify_or_remove_workspace_owner(): void
    {
        $owner = $this->createWorkspaceUser('Big Boss', 'bigboss@example.com');

        $admin = User::create([
            'name' => 'Sub Admin',
            'email' => 'subadmin@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $owner['workspace']->id,
        ]);
        $owner['workspace']->users()->attach($admin->id, ['role' => 'admin']);
        $adminToken = $admin->createToken('admin_token')['plain_token'];

        // Admin attempting to demote Owner -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->patchJson("/api/workspaces/{$owner['workspace']->id}/members/{$owner['user']->id}", [
            'role' => 'member',
        ])->assertStatus(403);

        // Admin attempting to remove Owner -> 403 Forbidden
        $this->withHeaders([
            'Authorization' => 'Bearer '.$adminToken,
        ])->deleteJson("/api/workspaces/{$owner['workspace']->id}/members/{$owner['user']->id}")
            ->assertStatus(403);
    }

    /**
     * 25. Concurrent or duplicate invitation acceptance cannot attach user twice or return false success.
     */
    public function test_concurrent_or_duplicate_acceptance_cannot_attach_twice(): void
    {
        $owner = $this->createWorkspaceUser('Owner Race', 'ownerrace@example.com');

        $inviteData = WorkspaceInvitation::createInvitation(
            $owner['workspace'],
            $owner['user'],
            'raceuser@example.com',
            'member'
        );

        $user = User::create([
            'name' => 'Race User',
            'email' => 'raceuser@example.com',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('race_token')['plain_token'];

        // First acceptance -> 200 OK
        $res1 = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson("/api/invitations/{$inviteData['plainToken']}/accept");

        $res1->assertStatus(200)
            ->assertJsonPath('success', true);

        // Second duplicate acceptance attempt -> 410 Already Accepted (never falls through to false success)
        $res2 = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson("/api/invitations/{$inviteData['plainToken']}/accept");

        $res2->assertStatus(410)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'This invitation has already been accepted.');

        // User should only appear ONCE in the workspace pivot
        $this->assertEquals(1, $owner['workspace']->users()->where('users.id', $user->id)->count());
    }
}
