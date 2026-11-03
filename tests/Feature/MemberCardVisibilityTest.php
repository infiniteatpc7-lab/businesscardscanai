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

class MemberCardVisibilityTest extends TestCase
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
     * 1 & 2: Member Rahul sees only his scanned cards; Member Amit sees only his scanned cards.
     */
    public function test_member_sees_only_personally_scanned_cards_and_cannot_see_other_members_cards(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Auto Expo 2026',
            'status' => 'active',
        ]);

        // Rahul scans Card A
        $resRahulSave = $this->withHeaders([
            'Authorization' => 'Bearer '.$rahul['token'],
        ])->postJson('/api/cards', [
            'company' => 'Rahul Motors',
            'name' => 'Rahul Sharma',
            'phone' => ['9876543210'],
            'exhibition_id' => $exhibition->id,
        ]);
        $resRahulSave->assertStatus(201);
        $cardAId = $resRahulSave->json('card.id');

        // Amit scans Card B
        $resAmitSave = $this->withHeaders([
            'Authorization' => 'Bearer '.$amit['token'],
        ])->postJson('/api/cards', [
            'company' => 'Amit Textiles',
            'name' => 'Amit Patel',
            'phone' => ['9123456780'],
            'exhibition_id' => $exhibition->id,
        ]);
        $resAmitSave->assertStatus(201);
        $cardBId = $resAmitSave->json('card.id');

        // Rahul requests /api/cards: must see only Card A
        $resRahulIndex = $this->withHeaders([
            'Authorization' => 'Bearer '.$rahul['token'],
        ])->getJson('/api/cards');

        $resRahulIndex->assertStatus(200);
        $rahulCards = collect($resRahulIndex->json('cards'));
        $this->assertTrue($rahulCards->contains('id', $cardAId));
        $this->assertFalse($rahulCards->contains('id', $cardBId));
        $this->assertCount(1, $rahulCards);

        // Amit requests /api/cards: must see only Card B
        $resAmitIndex = $this->withHeaders([
            'Authorization' => 'Bearer '.$amit['token'],
        ])->getJson('/api/cards');

        $resAmitIndex->assertStatus(200);
        $amitCards = collect($resAmitIndex->json('cards'));
        $this->assertTrue($amitCards->contains('id', $cardBId));
        $this->assertFalse($amitCards->contains('id', $cardAId));
        $this->assertCount(1, $amitCards);
    }

    /**
     * 3: Owner and Admin can see all cards scanned by all members with scanner attribution.
     */
    public function test_owner_and_admin_see_all_cards_with_scanner_attribution(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $admin = $this->createWorkspaceUser('Admin', 'admin@example.com', 'admin', $owner['workspace']);
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Tech Expo',
            'status' => 'active',
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Rahul Electronics',
            'name' => 'Rahul',
            'phone' => ['9876543211'],
            'exhibition_id' => $exhibition->id,
        ])->assertStatus(201);

        $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->postJson('/api/cards', [
            'company' => 'Amit Ceramics',
            'name' => 'Amit',
            'phone' => ['9876543212'],
            'exhibition_id' => $exhibition->id,
        ])->assertStatus(201);

        // Owner sees both cards with scanners array containing Rahul and Amit
        $resOwner = $this->withHeaders(['Authorization' => 'Bearer '.$owner['token']])->getJson('/api/cards');
        $resOwner->assertStatus(200);
        $ownerCards = collect($resOwner->json('cards'));
        $this->assertCount(2, $ownerCards);

        $rahulCard = $ownerCards->firstWhere('company', 'Rahul Electronics');
        $this->assertNotNull($rahulCard);
        $this->assertEquals('Rahul', $rahulCard['scanners'][0]['name']);
        $this->assertEquals($rahul['user']->id, $rahulCard['scanners'][0]['id']);

        $amitCard = $ownerCards->firstWhere('company', 'Amit Ceramics');
        $this->assertNotNull($amitCard);
        $this->assertEquals('Amit', $amitCard['scanners'][0]['name']);
        $this->assertEquals($amit['user']->id, $amitCard['scanners'][0]['id']);

        // Admin also sees both cards with attribution
        $resAdmin = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])->getJson('/api/cards');
        $resAdmin->assertStatus(200);
        $this->assertCount(2, $resAdmin->json('cards'));
    }

    /**
     * 4 & 5: Owner and Admin can filter cards by individual team member.
     */
    public function test_owner_and_admin_can_filter_cards_by_team_member(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Pharma Expo',
            'status' => 'active',
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Rahul Biotech',
            'name' => 'Rahul',
            'phone' => ['9876543213'],
            'exhibition_id' => $exhibition->id,
        ])->assertStatus(201);

        $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->postJson('/api/cards', [
            'company' => 'Amit Labs',
            'name' => 'Amit',
            'phone' => ['9876543214'],
            'exhibition_id' => $exhibition->id,
        ])->assertStatus(201);

        // Filter by Rahul
        $resFilterRahul = $this->withHeaders(['Authorization' => 'Bearer '.$owner['token']])
            ->getJson('/api/cards?member_id='.$rahul['user']->id);
        $resFilterRahul->assertStatus(200);
        $cardsRahul = collect($resFilterRahul->json('cards'));
        $this->assertCount(1, $cardsRahul);
        $this->assertEquals('Rahul Biotech', $cardsRahul->first()['company']);

        // Filter by Amit
        $resFilterAmit = $this->withHeaders(['Authorization' => 'Bearer '.$owner['token']])
            ->getJson('/api/cards?member_id='.$amit['user']->id);
        $resFilterAmit->assertStatus(200);
        $cardsAmit = collect($resFilterAmit->json('cards'));
        $this->assertCount(1, $cardsAmit);
        $this->assertEquals('Amit Labs', $cardsAmit->first()['company']);
    }

    /**
     * 6: Shared duplicate contact scanned across exhibitions and members:
     * 1 canonical card, 2 separate scan records, both members see it, private scans isolated.
     */
    public function test_shared_contact_across_members_preserves_single_canonical_card_and_isolated_scans(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exA = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Exhibition A',
            'status' => 'active',
        ]);
        $exB = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Exhibition B',
            'status' => 'active',
        ]);

        // Rahul scans contact at Exhibition A
        $resRahul = $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Apex Solutions',
            'name' => 'Vikas Roy',
            'phone' => ['9998887776'],
            'exhibition_id' => $exA->id,
            'scan_notes' => 'Rahul note from Exhibition A',
        ]);
        $resRahul->assertStatus(201);
        $cardId = $resRahul->json('card.id');

        // Amit scans the same contact at Exhibition B -> duplicate detected (409)
        $resAmitAttempt = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->postJson('/api/cards', [
            'company' => 'Apex Solutions',
            'name' => 'Vikas Roy',
            'phone' => ['9998887776'],
            'exhibition_id' => $exB->id,
            'scan_notes' => 'Amit note from Exhibition B',
        ]);
        $resAmitAttempt->assertStatus(409);
        $this->assertTrue($resAmitAttempt->json('duplicate'));

        // Amit links to the canonical contact with his own scan event
        $resAmitLink = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->postJson('/api/cards', [
            'link_existing_card_id' => $cardId,
            'exhibition_id' => $exB->id,
            'scan_notes' => 'Amit note from Exhibition B',
        ]);
        $resAmitLink->assertStatus(200);

        // Verify database: exactly 1 Card, 2 CardScans
        $this->assertEquals(1, Card::where('workspace_id', $owner['workspace']->id)->count());
        $this->assertEquals(2, CardScan::where('workspace_id', $owner['workspace']->id)->count());

        // Rahul checks /api/cards/{id}: sees only his scan
        $resRahulShow = $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->getJson("/api/cards/{$cardId}");
        $resRahulShow->assertStatus(200);
        $rahulScans = $resRahulShow->json('card.scans');
        $this->assertCount(1, $rahulScans);
        $this->assertEquals($rahul['user']->id, $rahulScans[0]['user']['id']);
        $this->assertEquals('Rahul note from Exhibition A', $rahulScans[0]['notes']);

        // Amit checks /api/cards/{id}: sees only his scan
        $resAmitShow = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->getJson("/api/cards/{$cardId}");
        $resAmitShow->assertStatus(200);
        $amitScans = $resAmitShow->json('card.scans');
        $this->assertCount(1, $amitScans);
        $this->assertEquals($amit['user']->id, $amitScans[0]['user']['id']);
        $this->assertEquals('Amit note from Exhibition B', $amitScans[0]['notes']);

        // Owner checks /api/cards/{id}: sees all scans and both scanners
        $resOwnerShow = $this->withHeaders(['Authorization' => 'Bearer '.$owner['token']])->getJson("/api/cards/{$cardId}");
        $resOwnerShow->assertStatus(200);
        $ownerScans = $resOwnerShow->json('card.scans');
        $this->assertCount(2, $ownerScans);
        $scanners = collect($resOwnerShow->json('card.scanners'));
        $this->assertCount(2, $scanners);
        $this->assertTrue($scanners->contains('name', 'Rahul'));
        $this->assertTrue($scanners->contains('name', 'Amit'));
    }

    /**
     * 7 & 8: Member cannot access another member's card or image directly via ID (IDOR protection returns 404).
     */
    public function test_member_cannot_access_another_members_card_or_image(): void
    {
        Storage::fake('local');

        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Secret Expo',
            'status' => 'active',
        ]);

        // Rahul saves a card with an image
        $imagePath = 'cards/rahul_sample.jpg';
        Storage::disk('local')->put($imagePath, 'fake-jpg-content');

        $resRahul = $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Rahul Private Co',
            'name' => 'Rahul Sharma',
            'phone' => ['9876543299'],
            'image_path' => $imagePath,
            'exhibition_id' => $exhibition->id,
        ]);
        $resRahul->assertStatus(201);
        $cardId = $resRahul->json('card.id');

        // Amit attempts to view Rahul's card via GET /api/cards/{id} -> 404
        $resAmitShow = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->getJson("/api/cards/{$cardId}");
        $resAmitShow->assertStatus(404);

        // Amit attempts to view Rahul's card image via GET /api/cards/{id}/image -> 404
        $resAmitImage = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])->getJson("/api/cards/{$cardId}/image");
        $resAmitImage->assertStatus(404);

        // Rahul can view the card and image successfully
        $resRahulShow = $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->getJson("/api/cards/{$cardId}");
        $resRahulShow->assertStatus(200);

        $resRahulImage = $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->get("/api/cards/{$cardId}/image");
        $resRahulImage->assertStatus(200);
    }

    /**
     * 9: Member query tampering: Member supplying ?member_id= cannot bypass scoping.
     */
    public function test_member_cannot_bypass_scoping_with_member_id_param(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);
        $amit = $this->createWorkspaceUser('Amit', 'amit@example.com', 'member', $owner['workspace']);

        $exhibition = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Sec Expo',
            'status' => 'active',
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Rahul Enterprise',
            'phone' => ['9876543201'],
            'exhibition_id' => $exhibition->id,
        ])->assertStatus(201);

        // Amit tries ?member_id={rahul_id}
        $resAmitTamper = $this->withHeaders(['Authorization' => 'Bearer '.$amit['token']])
            ->getJson('/api/cards?member_id='.$rahul['user']->id);
        $resAmitTamper->assertStatus(200);
        $this->assertCount(0, $resAmitTamper->json('cards'));
    }

    /**
     * 10: Member and Exhibition filters work together.
     */
    public function test_member_and_exhibition_filters_work_together(): void
    {
        $owner = $this->createWorkspaceUser('Owner', 'owner@example.com', 'owner');
        $rahul = $this->createWorkspaceUser('Rahul', 'rahul@example.com', 'member', $owner['workspace']);

        $ex1 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Show 1',
            'status' => 'active',
        ]);
        $ex2 = Exhibition::create([
            'workspace_id' => $owner['workspace']->id,
            'created_by_user_id' => $owner['user']->id,
            'name' => 'Show 2',
            'status' => 'active',
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Card In Show 1',
            'phone' => ['9876543111'],
            'exhibition_id' => $ex1->id,
        ])->assertStatus(201);

        $this->withHeaders(['Authorization' => 'Bearer '.$rahul['token']])->postJson('/api/cards', [
            'company' => 'Card In Show 2',
            'phone' => ['9876543222'],
            'exhibition_id' => $ex2->id,
        ])->assertStatus(201);

        // Owner filters by Rahul AND Show 1
        $res = $this->withHeaders(['Authorization' => 'Bearer '.$owner['token']])
            ->getJson("/api/cards?member_id={$rahul['user']->id}&exhibition_id={$ex1->id}");
        $res->assertStatus(200);
        $cards = collect($res->json('cards'));
        $this->assertCount(1, $cards);
        $this->assertEquals('Card In Show 1', $cards->first()['company']);
    }

    /**
     * 11: Workspace isolation: Users in another workspace cannot view or filter cards.
     */
    public function test_workspace_isolation_is_strictly_maintained(): void
    {
        $wsA = $this->createWorkspaceUser('Owner A', 'ownera@example.com', 'owner');
        $wsB = $this->createWorkspaceUser('Owner B', 'ownerb@example.com', 'owner');

        $exA = Exhibition::create([
            'workspace_id' => $wsA['workspace']->id,
            'created_by_user_id' => $wsA['user']->id,
            'name' => 'Workspace A Expo',
            'status' => 'active',
        ]);

        $res = $this->withHeaders(['Authorization' => 'Bearer '.$wsA['token']])->postJson('/api/cards', [
            'company' => 'Workspace A Card',
            'phone' => ['9876543000'],
            'exhibition_id' => $exA->id,
        ]);
        $cardAId = $res->json('card.id');

        // Owner B tries to access Workspace A's card
        $resB = $this->withHeaders(['Authorization' => 'Bearer '.$wsB['token']])->getJson("/api/cards/{$cardAId}");
        $resB->assertStatus(404);

        // Owner B list cards: gets 0
        $resBList = $this->withHeaders(['Authorization' => 'Bearer '.$wsB['token']])->getJson('/api/cards');
        $resBList->assertStatus(200);
        $this->assertCount(0, $resBList->json('cards'));
    }
}
