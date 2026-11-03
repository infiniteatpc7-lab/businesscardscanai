<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\CardScan;
use App\Models\Exhibition;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ExhibitionManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createWorkspaceUser(string $name, string $email, string $role = 'owner', ?Workspace $existingWorkspace = null): array
    {
        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => bcrypt('password123'),
        ]);

        if (! $existingWorkspace) {
            $workspace = Workspace::create([
                'name' => "{$name}'s Workspace",
                'slug' => "ws-{$user->id}-".uniqid(),
                'owner_id' => $role === 'owner' ? $user->id : null,
            ]);
        } else {
            $workspace = $existingWorkspace;
        }

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
     * 1. Owner and Admin can create and update exhibitions.
     */
    public function test_owner_and_admin_can_create_and_update_exhibitions(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $admin = $this->createWorkspaceUser('Admin User', 'admin@example.com', 'admin', $owner['workspace']);

        // Owner creates exhibition
        $resOwner = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/exhibitions', [
            'name' => 'Morbi Ceramics Expo 2026',
            'organizer' => 'Ceramic Association',
            'venue' => 'Hall 2',
            'city' => 'Morbi',
            'start_date' => '2026-12-01',
            'end_date' => '2026-12-05',
            'status' => 'active',
        ]);

        $resOwner->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('exhibition.name', 'Morbi Ceramics Expo 2026');

        $exhibitionId = $resOwner->json('exhibition.id');

        // Admin updates exhibition
        $resAdmin = $this->withHeaders([
            'Authorization' => 'Bearer '.$admin['token'],
        ])->putJson("/api/exhibitions/{$exhibitionId}", [
            'name' => 'Morbi Ceramics Global Expo 2026',
            'organizer' => 'Ceramic Association',
            'venue' => 'Hall 2 & 3',
            'city' => 'Morbi',
            'start_date' => '2026-12-01',
            'end_date' => '2026-12-06',
            'status' => 'active',
        ]);

        $resAdmin->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('exhibition.name', 'Morbi Ceramics Global Expo 2026')
            ->assertJsonPath('exhibition.venue', 'Hall 2 & 3');

        $this->assertDatabaseHas('exhibitions', [
            'id' => $exhibitionId,
            'name' => 'Morbi Ceramics Global Expo 2026',
            'workspace_id' => $owner['workspace']->id,
        ]);
    }

    /**
     * 2. Members cannot create, update, or archive exhibitions.
     */
    public function test_members_cannot_create_update_or_archive_exhibitions(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $member = $this->createWorkspaceUser('Member User', 'member@example.com', 'member', $owner['workspace']);

        // Create exhibition as owner
        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Textile Fair 2026',
            'status' => 'active',
        ]);

        // Member tries to create -> 403
        $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->postJson('/api/exhibitions', [
            'name' => 'Unauthorized Fair',
        ])->assertStatus(403);

        // Member tries to update -> 403
        $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->putJson("/api/exhibitions/{$exhibition->id}", [
            'name' => 'Hacked Fair',
            'status' => 'active',
        ])->assertStatus(403);

        // Member tries to delete/archive -> 403
        $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->deleteJson("/api/exhibitions/{$exhibition->id}")
            ->assertStatus(403);
    }

    /**
     * 3. Members can view and select exhibitions.
     */
    public function test_members_can_view_and_select_exhibitions(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $member = $this->createWorkspaceUser('Member User', 'member@example.com', 'member', $owner['workspace']);

        $ex1 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Expo One',
            'status' => 'active',
        ]);

        $ex2 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Expo Two',
            'status' => 'active',
        ]);

        // Member lists exhibitions
        $listRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->getJson('/api/exhibitions');

        $listRes->assertStatus(200)
            ->assertJsonPath('success', true);
        $this->assertCount(2, $listRes->json('exhibitions'));

        // Member selects Expo Two
        $selectRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->postJson('/api/exhibitions/current', [
            'exhibition_id' => $ex2->id,
        ]);

        $selectRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('exhibition.id', $ex2->id);

        // Verify per-user persistence
        $currentRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$member['token'],
        ])->getJson('/api/exhibitions/current');

        $currentRes->assertStatus(200)
            ->assertJsonPath('exhibition.id', $ex2->id);

        $this->assertDatabaseHas('user_selected_exhibitions', [
            'user_id' => $member['user']->id,
            'workspace_id' => $owner['workspace']->id,
            'exhibition_id' => $ex2->id,
        ]);
    }

    /**
     * 4. Exhibitions are strictly workspace-isolated.
     */
    public function test_exhibitions_are_strictly_workspace_isolated(): void
    {
        $userA = $this->createWorkspaceUser('User A', 'userA@example.com', 'owner');
        $userB = $this->createWorkspaceUser('User B', 'userB@example.com', 'owner');

        $exA = Exhibition::create([
            'workspace_id' => $userA['workspace']->id,
            'created_by_user_id' => $userA['user']->id,
            'name' => 'Private Workspace A Expo',
            'status' => 'active',
        ]);

        // User B cannot view Workspace A expo in list
        $listB = $this->withHeaders([
            'Authorization' => 'Bearer '.$userB['token'],
        ])->getJson('/api/exhibitions');

        $this->assertEmpty($listB->json('exhibitions'));

        // User B cannot get details of Workspace A expo -> 404
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userB['token'],
        ])->getJson("/api/exhibitions/{$exA->id}")
            ->assertStatus(404);

        // User B cannot select Workspace A expo -> 404
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userB['token'],
        ])->postJson('/api/exhibitions/current', [
            'exhibition_id' => $exA->id,
        ])->assertStatus(404);

        // User B cannot update Workspace A expo -> 404
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userB['token'],
        ])->putJson("/api/exhibitions/{$exA->id}", [
            'name' => 'Attempted Cross-tenant Overwrite',
            'status' => 'active',
        ])->assertStatus(404);

        // User B cannot delete Workspace A expo -> 404
        $this->withHeaders([
            'Authorization' => 'Bearer '.$userB['token'],
        ])->deleteJson("/api/exhibitions/{$exA->id}")
            ->assertStatus(404);
    }

    /**
     * 5. Invalid date ranges are rejected.
     */
    public function test_invalid_date_ranges_are_rejected(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/exhibitions', [
            'name' => 'Invalid Date Expo',
            'start_date' => '2026-11-10',
            'end_date' => '2026-11-05', // earlier than start date
            'status' => 'active',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['end_date']);
    }

    /**
     * 6. User remembers last selected exhibition per workspace.
     */
    public function test_user_remembers_last_selected_exhibition_per_workspace(): void
    {
        $user = User::create([
            'name' => 'Multi-Workspace User',
            'email' => 'multi@example.com',
            'password' => bcrypt('password123'),
        ]);

        $ws1 = Workspace::create([
            'name' => 'Workspace One',
            'slug' => 'ws-1-'.uniqid(),
            'owner_id' => $user->id,
        ]);
        $ws1->users()->attach($user->id, ['role' => 'owner']);

        $ws2 = Workspace::create([
            'name' => 'Workspace Two',
            'slug' => 'ws-2-'.uniqid(),
            'owner_id' => $user->id,
        ]);
        $ws2->users()->attach($user->id, ['role' => 'owner']);

        $ex1 = Exhibition::create([
            'workspace_id' => $ws1->id,
            'name' => 'Expo In WS1',
            'status' => 'active',
        ]);

        $ex2 = Exhibition::create([
            'workspace_id' => $ws2->id,
            'name' => 'Expo In WS2',
            'status' => 'active',
        ]);

        $tokenData = $user->createToken('test_token');
        $token = $tokenData['plain_token'];

        // Select ex1 in ws1
        $user->forceFill(['current_workspace_id' => $ws1->id])->save();
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/exhibitions/current', ['exhibition_id' => $ex1->id])
            ->assertStatus(200);

        // Switch to ws2 and select ex2
        $user->forceFill(['current_workspace_id' => $ws2->id])->save();
        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/exhibitions/current', ['exhibition_id' => $ex2->id])
            ->assertStatus(200);

        // Check ws2 selection
        $resWS2 = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/exhibitions/current');
        $resWS2->assertJsonPath('exhibition.id', $ex2->id);

        // Switch back to ws1: should still remember ex1
        $user->forceFill(['current_workspace_id' => $ws1->id])->save();
        $resWS1 = $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/exhibitions/current');
        $resWS1->assertJsonPath('exhibition.id', $ex1->id);
    }

    /**
     * 7. Scan requires and records selected exhibition atomically.
     */
    public function test_scan_requires_and_records_selected_exhibition_atomically(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Automated Trade Show',
            'status' => 'active',
        ]);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/cards', [
            'company' => 'Gujarat Ceramics Ltd',
            'name' => 'Rajesh Patel',
            'phone' => ['9876543210'],
            'email' => 'rajesh@gujaratceramics.com',
            'exhibition_id' => $exhibition->id,
            'image_path' => 'cards/front_test.jpg',
            'back_image_path' => 'cards/back_test.jpg',
            'accuracy_score' => 95,
            'scan_notes' => 'Met at booth 45. Interested in vitrified tiles.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $cardId = $response->json('card.id');

        // Verify Card created
        $this->assertDatabaseHas('cards', [
            'id' => $cardId,
            'workspace_id' => $owner['workspace']->id,
            'company' => 'Gujarat Ceramics Ltd',
            'back_image_path' => 'cards/back_test.jpg',
        ]);

        // Verify atomic card_exhibitions pivot
        $this->assertDatabaseHas('card_exhibitions', [
            'card_id' => $cardId,
            'exhibition_id' => $exhibition->id,
        ]);

        // Verify atomic card_scans individual scan history
        $this->assertDatabaseHas('card_scans', [
            'card_id' => $cardId,
            'exhibition_id' => $exhibition->id,
            'workspace_id' => $owner['workspace']->id,
            'user_id' => $owner['user']->id,
            'front_image_path' => 'cards/front_test.jpg',
            'back_image_path' => 'cards/back_test.jpg',
            'accuracy_score' => 95,
            'notes' => 'Met at booth 45. Interested in vitrified tiles.',
        ]);
    }

    /**
     * 8. Contact scanned at second exhibition reuses card and creates new scan history.
     */
    public function test_contact_scanned_at_second_exhibition_reuses_card_and_creates_new_scan_history(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');
        $staff = $this->createWorkspaceUser('Booth Staff', 'staff@example.com', 'member', $owner['workspace']);

        $expo1 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Morbi Expo',
            'status' => 'active',
        ]);

        $expo2 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Ahmedabad Buildcon',
            'status' => 'active',
        ]);

        // First scan at Morbi Expo by Owner
        $card1Res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/cards', [
            'company' => 'Somani Industries',
            'name' => 'Deepak Somani',
            'phone' => ['9825012345'],
            'email' => 'deepak@somani.in',
            'exhibition_id' => $expo1->id,
            'image_path' => 'cards/morbi_deepak.jpg',
        ]);
        $card1Res->assertStatus(201);
        $cardId = $card1Res->json('card.id');

        // Second encounter at Ahmedabad Buildcon by Staff:
        // Attempting to save without override detects duplicate and indicates not yet in Ahmedabad Buildcon
        $dupRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$staff['token'],
        ])->postJson('/api/cards', [
            'company' => 'Somani Industries',
            'name' => 'Deepak Somani',
            'phone' => ['9825012345'],
            'exhibition_id' => $expo2->id,
        ]);

        $dupRes->assertStatus(409)
            ->assertJsonPath('duplicate', true)
            ->assertJsonPath('already_in_exhibition', false);

        // Staff chooses to link existing canonical card to new exhibition
        $linkRes = $this->withHeaders([
            'Authorization' => 'Bearer '.$staff['token'],
        ])->postJson('/api/cards', [
            'link_existing_card_id' => $cardId,
            'exhibition_id' => $expo2->id,
            'image_path' => 'cards/ahmedabad_deepak_front.jpg',
            'back_image_path' => 'cards/ahmedabad_deepak_back.jpg',
            'scan_notes' => 'Follow up on Morbi booth discussion. Ready for quote.',
        ]);

        $linkRes->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('linked', true);

        // Verify only 1 card exists (reused canonical contact)
        $this->assertEquals(1, Card::where('workspace_id', $owner['workspace']->id)->count());

        // Verify card is now linked to BOTH exhibitions
        $this->assertDatabaseHas('card_exhibitions', [
            'card_id' => $cardId,
            'exhibition_id' => $expo1->id,
        ]);
        $this->assertDatabaseHas('card_exhibitions', [
            'card_id' => $cardId,
            'exhibition_id' => $expo2->id,
        ]);

        // Verify distinct scan events with their respective staff and capture images
        $this->assertEquals(2, CardScan::where('card_id', $cardId)->count());

        $this->assertDatabaseHas('card_scans', [
            'card_id' => $cardId,
            'exhibition_id' => $expo1->id,
            'user_id' => $owner['user']->id,
            'front_image_path' => 'cards/morbi_deepak.jpg',
        ]);

        $this->assertDatabaseHas('card_scans', [
            'card_id' => $cardId,
            'exhibition_id' => $expo2->id,
            'user_id' => $staff['user']->id,
            'front_image_path' => 'cards/ahmedabad_deepak_front.jpg',
            'back_image_path' => 'cards/ahmedabad_deepak_back.jpg',
            'notes' => 'Follow up on Morbi booth discussion. Ready for quote.',
        ]);
    }

    /**
     * 9. Cannot select or add cards to an archived exhibition.
     */
    public function test_cannot_select_or_add_cards_to_archived_exhibition(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $archivedExpo = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Concluded 2024 Fair',
            'status' => 'archived',
        ]);

        // Cannot select archived expo
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/exhibitions/current', [
            'exhibition_id' => $archivedExpo->id,
        ])->assertStatus(422)
            ->assertJsonPath('message', 'Cannot select an archived exhibition.');

        // Cannot add cards to archived expo
        $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->postJson('/api/cards', [
            'company' => 'Some Company',
            'exhibition_id' => $archivedExpo->id,
        ])->assertStatus(422);
    }

    /**
     * 10. Exhibition with cards or scans cannot be hard deleted and is safely archived.
     */
    public function test_exhibition_with_cards_or_scans_cannot_be_hard_deleted_and_is_archived(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $expo = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Active Expo With Contacts',
            'status' => 'active',
        ]);

        // Attach a card
        $card = Card::create([
            'workspace_id' => $owner['workspace']->id,
            'company' => 'Preserved Contact',
        ]);
        $expo->cards()->attach($card->id, ['created_at' => now()]);

        // Attempting to delete archives it instead of removing
        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->deleteJson("/api/exhibitions/{$expo->id}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('archived', true);

        // Record still exists in database with status 'archived'
        $this->assertDatabaseHas('exhibitions', [
            'id' => $expo->id,
            'status' => 'archived',
        ]);

        // Contacts are preserved
        $this->assertDatabaseHas('cards', [
            'id' => $card->id,
        ]);
    }

    /**
     * 11. Empty exhibition can be deleted cleanly.
     */
    public function test_empty_exhibition_can_be_deleted(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $emptyExpo = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Empty Expo',
            'status' => 'active',
        ]);

        $res = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->deleteJson("/api/exhibitions/{$emptyExpo->id}");

        $res->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('archived', false);

        $this->assertDatabaseMissing('exhibitions', [
            'id' => $emptyExpo->id,
        ]);
    }

    /**
     * 12. Cards can be filtered by exhibition_id.
     */
    public function test_cards_can_be_filtered_by_exhibition_id(): void
    {
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        $expoA = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Expo A',
            'status' => 'active',
        ]);

        $expoB = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'name' => 'Expo B',
            'status' => 'active',
        ]);

        $cardA = Card::create([
            'workspace_id' => $owner['workspace']->id,
            'company' => 'Company A Only',
        ]);
        $expoA->cards()->attach($cardA->id, ['created_at' => now()]);

        $cardB = Card::create([
            'workspace_id' => $owner['workspace']->id,
            'company' => 'Company B Only',
        ]);
        $expoB->cards()->attach($cardB->id, ['created_at' => now()]);

        // Filter by Expo A
        $resA = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->getJson("/api/cards?exhibition_id={$expoA->id}");

        $resA->assertStatus(200);
        $cardsA = $resA->json('cards');
        $this->assertCount(1, $cardsA);
        $this->assertEquals('Company A Only', $cardsA[0]['company']);

        // Filter by Expo B
        $resB = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->getJson("/api/cards?exhibition_id={$expoB->id}");

        $resB->assertStatus(200);
        $cardsB = $resB->json('cards');
        $this->assertCount(1, $cardsB);
        $this->assertEquals('Company B Only', $cardsB[0]['company']);

        // All cards
        $resAll = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->getJson('/api/cards');

        $resAll->assertStatus(200);
        $this->assertCount(2, $resAll->json('cards'));
    }

    /**
     * 13. Front and back image paths are securely preserved and accessible.
     */
    public function test_front_and_back_image_paths_preserved_in_scan_history_and_cards(): void
    {
        Storage::fake('local');
        $owner = $this->createWorkspaceUser('Owner User', 'owner@example.com', 'owner');

        Storage::disk('local')->put('cards/front.jpg', 'front_bytes');
        Storage::disk('local')->put('cards/back.jpg', 'back_bytes');

        $card = Card::create([
            'workspace_id' => $owner['workspace']->id,
            'company' => 'Dual Photo Card',
            'image_path' => 'cards/front.jpg',
            'back_image_path' => 'cards/back.jpg',
        ]);

        // Front image
        $frontResp = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->get("/api/cards/{$card->id}/image");
        $frontResp->assertStatus(200);

        // Back image
        $backResp = $this->withHeaders([
            'Authorization' => 'Bearer '.$owner['token'],
        ])->get("/api/cards/{$card->id}/image?type=back");
        $backResp->assertStatus(200);
    }
}
