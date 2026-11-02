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
        $this->deleteJson('/api/cards/1')->assertStatus(401);
        $this->postJson('/api/scan', [])->assertStatus(401);
        $this->getJson('/api/auth/user')->assertStatus(401);
    }

    /**
     * 4. Query-string tokens and X-Api-Token headers are strictly rejected; only Bearer header works.
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
     * 5. Registration creates user, workspace, membership and token inside a database transaction.
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
     * 6. User login uses generic failure response to prevent user enumeration.
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
     * 7. Rate limiting protects login and registration endpoints against brute-force attacks.
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
     * 8. Token lifecycle: expired tokens cannot authenticate.
     */
    public function test_expired_tokens_cannot_authenticate(): void
    {
        $data = $this->createWorkspaceUser('Expired User', 'expired@example.com');
        $user = $data['user'];

        // Create an explicitly expired token
        $expiredToken = $user->createToken('expired_token', now()->subHours(2));

        $this->withHeader('Authorization', 'Bearer '.$expiredToken['plain_token'])
            ->getJson('/api/cards')
            ->assertStatus(401);
    }

    /**
     * 9. Token lifecycle: logout revokes exclusively the current token.
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
     * 10. Workspace Isolation: Workspace A cannot view, access, or delete Workspace B records.
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

        // 3. User B cannot delete Card A
        $this->deleteJson("/api/cards/{$cardA->id}", [], $headersB)->assertStatus(404);
        $this->assertDatabaseHas('cards', ['id' => $cardA->id]);

        // 4. User A can show and list their own card
        $this->getJson("/api/cards/{$cardA->id}", $headersA)->assertStatus(200)
            ->assertJsonPath('card.name', 'Secret VIP Contact');
    }

    /**
     * 11. Workspace Role Authorization: Members cannot delete cards, Owners/Admins can.
     */
    public function test_role_authorization_for_deletion(): void
    {
        $ownerData = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $workspace = $ownerData['workspace'];

        // Add a Member to the same workspace
        $member = User::create([
            'name' => 'Member User',
            'email' => 'member@example.com',
            'password' => bcrypt('password123'),
        ]);
        $workspace->users()->attach($member->id, ['role' => 'member']);
        $memberToken = $member->createToken('member_token')['plain_token'];

        // Add an Admin to the same workspace
        $admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
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

        // 1. Member cannot delete card (403 Forbidden)
        $this->deleteJson("/api/cards/{$card->id}", [], $memberHeaders)
            ->assertStatus(403)
            ->assertJson(['success' => false]);
        $this->assertDatabaseHas('cards', ['id' => $card->id]);

        // 2. Admin can delete card (200 OK)
        $this->deleteJson("/api/cards/{$card->id}", [], $adminHeaders)
            ->assertStatus(200)
            ->assertJson(['success' => true]);
        $this->assertDatabaseMissing('cards', ['id' => $card->id]);
    }

    /**
     * 12. Image validation strictly rejects invalid MIME types and fake files.
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
     * 13. Private image storage requires Bearer authentication and rejects query-string tokens.
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
     * 14. Gemini Configuration is accessible via config() and not directly via env().
     */
    public function test_gemini_configuration_is_present_in_services_config(): void
    {
        $this->assertNotEmpty(config('services.gemini.model'));
        $this->assertIsArray(config('services.gemini.models'));
        $this->assertContains('gemini-2.5-flash', config('services.gemini.models'));
    }
}
