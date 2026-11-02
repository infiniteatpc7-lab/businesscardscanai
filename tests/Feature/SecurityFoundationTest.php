<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SecurityFoundationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to create a user, workspace, and role.
     */
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

        $tokenData = $user->createToken('test_token');

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenData['plain_token'],
            'token_model' => $tokenData['token_model'],
        ];
    }

    /**
     * 1. Insecure public bootstrap endpoint no longer exists (must return 404).
     */
    public function test_public_bootstrap_endpoint_no_longer_exists(): void
    {
        $this->getJson('/api/auth/bootstrap')->assertStatus(404);
        $this->postJson('/api/auth/bootstrap')->assertStatus(404);
    }

    /**
     * 2. Hardcoded default users are never created.
     */
    public function test_hardcoded_default_users_are_never_created(): void
    {
        $this->assertDatabaseMissing('users', [
            'email' => 'booth@ceramix.com',
        ]);
        $this->assertEquals(0, User::count());
    }

    /**
     * 3. Unauthenticated requests are rejected with 401 across all protected routes.
     */
    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/cards')->assertStatus(401);
        $this->postJson('/api/cards', ['name' => 'Test Card'])->assertStatus(401);
        $this->getJson('/api/cards/1')->assertStatus(401);
        $this->putJson('/api/cards/1', ['name' => 'Updated Card'])->assertStatus(401);
        $this->deleteJson('/api/cards/1')->assertStatus(401);
        $this->postJson('/api/scan', [])->assertStatus(401);
        $this->getJson('/api/auth/user')->assertStatus(401);
    }

    /**
     * 4. Strict Bearer authentication: No session fallback permitted on API routes.
     */
    public function test_strict_bearer_authentication_no_session_fallback(): void
    {
        $data = $this->createWorkspaceUser('Session Tester', 'session@example.com');
        $user = $data['user'];

        // Even if session authentication is active via actingAs, API route MUST reject if Bearer header is missing
        $this->actingAs($user)
            ->getJson('/api/cards')
            ->assertStatus(401);

        // Providing valid Bearer token succeeds
        $this->withHeader('Authorization', 'Bearer '.$data['token'])
            ->getJson('/api/cards')
            ->assertStatus(200);
    }

    /**
     * 5. Token regression: Missing, invalid, expired, and revoked tokens all fail with 401.
     */
    public function test_token_regression_missing_invalid_expired_and_revoked(): void
    {
        $data = $this->createWorkspaceUser('Token Tester', 'token_reg@example.com');
        $user = $data['user'];
        $validToken = $data['token'];

        // Missing token
        $this->getJson('/api/cards')->assertStatus(401);

        // Invalid token
        $this->withHeader('Authorization', 'Bearer invalid_bogus_token_12345')
            ->getJson('/api/cards')
            ->assertStatus(401);

        // Expired token
        $expiredToken = $user->createToken('expired', now()->subMinutes(10));
        $this->withHeader('Authorization', 'Bearer '.$expiredToken['plain_token'])
            ->getJson('/api/cards')
            ->assertStatus(401);

        // Revoked token (after deletion)
        $data['token_model']->delete();
        $this->withHeader('Authorization', 'Bearer '.$validToken)
            ->getJson('/api/cards')
            ->assertStatus(401);
    }

    /**
     * 6. Query-string tokens and X-Api-Token headers are strictly rejected; only Bearer header works.
     */
    public function test_query_string_and_custom_header_tokens_are_rejected(): void
    {
        $data = $this->createWorkspaceUser('Token Security Tester', 'tokensec@example.com');
        $plainToken = $data['token'];

        // Query string token must fail with 401
        $this->getJson("/api/cards?token={$plainToken}")->assertStatus(401);
        $this->getJson("/api/auth/user?token={$plainToken}")->assertStatus(401);

        // X-Api-Token header must fail with 401
        $this->withHeader('X-Api-Token', $plainToken)
            ->getJson('/api/cards')
            ->assertStatus(401);

        // Standard Authorization: Bearer must succeed with 200
        $this->withHeader('Authorization', "Bearer {$plainToken}")
            ->getJson('/api/cards')
            ->assertStatus(200);
    }

    /**
     * 7. Registration creates user, workspace, membership and token inside a database transaction.
     */
    public function test_user_registration_creates_workspace_atomically(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Ketan Patel',
            'email' => 'ketan@ceramix.com',
            'password' => 'secretPass123',
            'workspace_name' => 'Ceramix Export Team',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'user' => [
                    'name' => 'Ketan Patel',
                    'email' => 'ketan@ceramix.com',
                ],
                'workspace' => [
                    'name' => 'Ceramix Export Team',
                    'role' => 'owner',
                ],
            ]);

        $this->assertNotEmpty($response->json('token'));
        $this->assertDatabaseHas('workspaces', ['name' => 'Ceramix Export Team']);
        $this->assertDatabaseHas('workspace_user', ['role' => 'owner']);
    }

    /**
     * 8. User login uses generic failure response to prevent user enumeration.
     */
    public function test_login_uses_generic_failure_response(): void
    {
        $this->createWorkspaceUser('Login User', 'login@example.com');

        // Invalid password returns generic message
        $response = $this->postJson('/api/auth/login', [
            'email' => 'login@example.com',
            'password' => 'wrongpass',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid credentials.',
            ]);

        // Non-existent email returns identical generic message
        $responseUnknown = $this->postJson('/api/auth/login', [
            'email' => 'nobody@example.com',
            'password' => 'wrongpass',
        ]);

        $responseUnknown->assertStatus(401)
            ->assertJson([
                'success' => false,
                'message' => 'Invalid credentials.',
            ]);
    }

    /**
     * 9. Rate limiting protects login and registration endpoints against brute-force attacks.
     */
    public function test_login_and_registration_rate_limiting(): void
    {
        $this->createWorkspaceUser('Throttled User', 'throttle@example.com');

        // 5 allowed login attempts per minute; 6th must return 429
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', [
                'email' => 'throttle@example.com',
                'password' => 'wrongpass',
            ])->assertStatus(401);
        }

        $throttledResponse = $this->postJson('/api/auth/login', [
            'email' => 'throttle@example.com',
            'password' => 'wrongpass',
        ]);
        $throttledResponse->assertStatus(429);
    }

    /**
     * 10. Token lifecycle: logout revokes exclusively the current token.
     */
    public function test_logout_revokes_only_the_current_token(): void
    {
        $data = $this->createWorkspaceUser('Multi Token User', 'multitoken@example.com');
        $user = $data['user'];

        $token1 = $data['token'];
        $token2Data = $user->createToken('second_device_token');
        $token2 = $token2Data['plain_token'];

        // Both tokens work initially
        $this->withHeader('Authorization', "Bearer {$token1}")->getJson('/api/auth/user')->assertStatus(200);
        $this->withHeader('Authorization', "Bearer {$token2}")->getJson('/api/auth/user')->assertStatus(200);

        // Logout using Token 1
        $this->withHeader('Authorization', "Bearer {$token1}")
            ->postJson('/api/auth/logout')
            ->assertStatus(200);

        // Token 1 is revoked and now receives 401
        $this->withHeader('Authorization', "Bearer {$token1}")->getJson('/api/auth/user')->assertStatus(401);

        // Token 2 remains valid and active
        $this->withHeader('Authorization', "Bearer {$token2}")->getJson('/api/auth/user')->assertStatus(200);
    }

    /**
     * 11. Persistent workspace selection: switching workspace persists per user and scopes all subsequent requests.
     */
    public function test_persistent_workspace_selection_and_switching(): void
    {
        $data = $this->createWorkspaceUser('Multi WS User', 'multiws@example.com', 'owner');
        $user = $data['user'];
        $headers = ['Authorization' => 'Bearer '.$data['token']];
        $ws1 = $data['workspace'];

        // Create a second workspace and attach the user as member
        $ws2 = Workspace::create([
            'name' => 'Second Exhibition Workspace',
            'slug' => 'ws-2-'.uniqid(),
            'owner_id' => $user->id,
        ]);
        $ws2->users()->attach($user->id, ['role' => 'admin']);

        // 1. Initially active in WS1 -> save Card 1
        $this->postJson('/api/cards', [
            'name' => 'Card In WS 1',
            'company' => 'Ceramics One',
        ], $headers)->assertStatus(201);

        $res1 = $this->getJson('/api/cards', $headers)->assertStatus(200);
        $this->assertCount(1, $res1->json('cards'));
        $this->assertEquals('Card In WS 1', $res1->json('cards.0.name'));

        // 2. Switch workspace to WS2
        $switchRes = $this->postJson('/api/auth/switch-workspace', [
            'workspace_id' => $ws2->id,
        ], $headers);

        $switchRes->assertStatus(200)
            ->assertJsonPath('current_workspace.id', $ws2->id);

        // Verify selection persisted in database
        $this->assertEquals($ws2->id, $user->fresh()->current_workspace_id);

        // 3. Subsequent requests without headers now use WS2 automatically
        $res2 = $this->getJson('/api/cards', $headers)->assertStatus(200);
        $this->assertCount(0, $res2->json('cards')); // WS2 has no cards yet

        // Save Card 2 in WS2
        $this->postJson('/api/cards', [
            'name' => 'Card In WS 2',
            'company' => 'Tiles Two',
        ], $headers)->assertStatus(201);

        $res2Updated = $this->getJson('/api/cards', $headers)->assertStatus(200);
        $this->assertCount(1, $res2Updated->json('cards'));
        $this->assertEquals('Card In WS 2', $res2Updated->json('cards.0.name'));

        // 4. Switch back to WS1
        $this->postJson('/api/auth/switch-workspace', ['workspace_id' => $ws1->id], $headers)->assertStatus(200);

        // Subsequent requests now return only WS1 cards
        $res1Back = $this->getJson('/api/cards', $headers)->assertStatus(200);
        $this->assertCount(1, $res1Back->json('cards'));
        $this->assertEquals('Card In WS 1', $res1Back->json('cards.0.name'));
    }

    /**
     * 12. Membership validation: users cannot switch to a workspace they do not belong to.
     */
    public function test_user_cannot_switch_to_unauthorized_workspace(): void
    {
        $userA = $this->createWorkspaceUser('User A', 'usera_switch@example.com');
        $userB = $this->createWorkspaceUser('User B', 'userb_switch@example.com');

        $headersA = ['Authorization' => 'Bearer '.$userA['token']];

        // User A attempts to switch to User B's workspace
        $response = $this->postJson('/api/auth/switch-workspace', [
            'workspace_id' => $userB['workspace']['id'],
        ], $headersA);

        $response->assertStatus(403)
            ->assertJson([
                'success' => false,
                'message' => 'You do not have access to this workspace.',
            ]);

        // Current workspace remains unchanged
        $this->assertEquals($userA['workspace']['id'], $userA['user']->fresh()->current_workspace_id);
    }

    /**
     * 13. Workspace Isolation: Workspace A cannot view, access, or delete Workspace B records.
     */
    public function test_workspace_isolation(): void
    {
        $wsA = $this->createWorkspaceUser('User A', 'user_a@example.com');
        $wsB = $this->createWorkspaceUser('User B', 'user_b@example.com');

        // User A saves a card in Workspace A
        $cardA = Card::create([
            'workspace_id' => $wsA['workspace']['id'],
            'user_id' => $wsA['user']['id'],
            'name' => 'Secret VIP Contact',
            'company' => 'Titanium Exports',
            'phone' => ['9825000001'],
        ]);

        // User B saves a card in Workspace B
        $cardB = Card::create([
            'workspace_id' => $wsB['workspace']['id'],
            'user_id' => $wsB['user']['id'],
            'name' => 'User B Contact',
            'company' => 'Emerald Granito',
            'phone' => ['9825000002'],
        ]);

        $headersA = ['Authorization' => 'Bearer '.$wsA['token']];
        $headersB = ['Authorization' => 'Bearer '.$wsB['token']];

        // 1. User B's list ONLY contains Card B, never Card A
        $listResponseB = $this->getJson('/api/cards', $headersB)->assertStatus(200);
        $cardsB = $listResponseB->json('cards');
        $this->assertCount(1, $cardsB);
        $this->assertEquals('User B Contact', $cardsB[0]['name']);

        // 2. User B cannot show Card A (returns 404)
        $this->getJson("/api/cards/{$cardA->id}", $headersB)->assertStatus(404);

        // 3. User B cannot update Card A (returns 404)
        $this->putJson("/api/cards/{$cardA->id}", ['name' => 'Hacked Name'], $headersB)->assertStatus(404);

        // 4. User B cannot delete Card A
        $this->deleteJson("/api/cards/{$cardA->id}", [], $headersB)->assertStatus(404);
        $this->assertDatabaseHas('cards', ['id' => $cardA->id]);

        // 5. User A can show and update their own card
        $this->getJson("/api/cards/{$cardA->id}", $headersA)->assertStatus(200)
            ->assertJsonPath('card.name', 'Secret VIP Contact');

        $this->putJson("/api/cards/{$cardA->id}", ['name' => 'Updated VIP Contact'], $headersA)
            ->assertStatus(200)
            ->assertJsonPath('card.name', 'Updated VIP Contact');
    }

    /**
     * 14. Workspace Role Authorization: Members cannot delete cards or modify workspace settings.
     */
    public function test_role_authorization_enforcement(): void
    {
        $ownerData = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $workspace = $ownerData['workspace'];

        // Add a Member to the same workspace
        $member = User::create([
            'name' => 'Member User',
            'email' => 'member@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $workspace->id,
        ]);
        $workspace->users()->attach($member->id, ['role' => 'member']);
        $memberToken = $member->createToken('member_token')['plain_token'];

        // Add an Admin to the same workspace
        $admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
            'current_workspace_id' => $workspace->id,
        ]);
        $workspace->users()->attach($admin->id, ['role' => 'admin']);
        $adminToken = $admin->createToken('admin_token')['plain_token'];

        // Create card in this workspace
        $card = Card::create([
            'workspace_id' => $workspace->id,
            'name' => 'Target Card',
            'company' => 'Delete Target Co',
        ]);

        $memberHeaders = ['Authorization' => 'Bearer '.$memberToken];
        $adminHeaders = ['Authorization' => 'Bearer '.$adminToken];

        // 1. Member CANNOT delete card (403 Forbidden)
        $this->deleteJson("/api/cards/{$card->id}", [], $memberHeaders)
            ->assertStatus(403)
            ->assertJson(['success' => false]);
        $this->assertDatabaseHas('cards', ['id' => $card->id]);

        // 2. Member CANNOT modify workspace settings (403 Forbidden)
        $this->putJson("/api/auth/workspaces/{$workspace->id}", ['name' => 'Member Renamed'], $memberHeaders)
            ->assertStatus(403)
            ->assertJson(['success' => false]);

        // 3. Admin CAN modify workspace settings (200 OK)
        $this->putJson("/api/auth/workspaces/{$workspace->id}", ['name' => 'Admin Renamed WS'], $adminHeaders)
            ->assertStatus(200)
            ->assertJsonPath('workspace.name', 'Admin Renamed WS');

        // 4. Admin CAN delete card (200 OK)
        $this->deleteJson("/api/cards/{$card->id}", [], $adminHeaders)
            ->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertDatabaseMissing('cards', ['id' => $card->id]);
    }

    /**
     * 15. Image validation strictly rejects invalid MIME types and fake files.
     */
    public function test_image_validation_rejects_invalid_files(): void
    {
        $data = $this->createWorkspaceUser('Image Tester', 'img_test@example.com');
        $headers = ['Authorization' => 'Bearer '.$data['token']];

        // Reject non-image text file masquerading as image
        $fakeFile = UploadedFile::fake()->createWithContent('malicious.php', '<?php phpinfo(); ?>');

        $this->postJson('/api/scan', ['image' => $fakeFile], $headers)
            ->assertStatus(422)
            ->assertJson(['success' => false]);

        // Reject invalid base64 data
        $this->postJson('/api/scan', ['image_base64' => 'not-valid-base64-data'], $headers)
            ->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    /**
     * 16. Private image storage requires Bearer authentication and rejects query-string tokens.
     */
    public function test_private_image_storage_controlled_access_via_bearer_only(): void
    {
        Storage::fake('local');

        $wsA = $this->createWorkspaceUser('User A', 'user_a_img@example.com');
        $wsB = $this->createWorkspaceUser('User B', 'user_b_img@example.com');

        $fakeJpgBytes = base64_decode('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=');
        $imagePath = 'cards/test-card-private.jpg';
        Storage::disk('local')->put($imagePath, $fakeJpgBytes);

        $card = Card::create([
            'workspace_id' => $wsA['workspace']['id'],
            'name' => 'Card With Private Image',
            'image_path' => $imagePath,
        ]);

        $headersA = ['Authorization' => 'Bearer '.$wsA['token']];
        $headersB = ['Authorization' => 'Bearer '.$wsB['token']];

        // 1. Query parameter token must be rejected with 401
        $this->get("/api/cards/{$card->id}/image?token=".$wsA['token'])->assertStatus(401);

        // 2. Workspace B with Bearer header cannot access Workspace A's card image (404)
        $this->getJson("/api/cards/{$card->id}/image", $headersB)->assertStatus(404);

        // 3. Workspace A with Bearer header can access securely
        $response = $this->get("/api/cards/{$card->id}/image", $headersA);
        $response->assertStatus(200);
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
    }

    /**
     * 17. Gemini Configuration is accessible via config() and not directly via env().
     */
    public function test_gemini_configuration_is_present_in_services_config(): void
    {
        $this->assertNotEmpty(config('services.gemini.model'));
        $this->assertIsArray(config('services.gemini.models'));
        $this->assertContains('gemini-2.5-flash', config('services.gemini.models'));
    }
}
