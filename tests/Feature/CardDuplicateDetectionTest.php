<?php

namespace Tests\Feature;

use App\Models\Card;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardDuplicateDetectionTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Workspace $workspace;

    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Test User',
            'email' => 'tester@example.com',
            'password' => bcrypt('password123'),
        ]);

        $this->workspace = Workspace::create([
            'name' => 'Test Workspace',
            'slug' => 'test-workspace',
            'owner_id' => $this->user->id,
        ]);

        $this->workspace->users()->attach($this->user->id, ['role' => 'owner']);
        $tokenData = $this->user->createToken('test_token');
        $this->token = $tokenData['plain_token'];

        $this->withHeaders([
            'Authorization' => 'Bearer '.$this->token,
        ]);
    }

    /**
     * Test 1: Exact phone duplicate detection.
     */
    public function test_exact_phone_duplicate(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Sahil Mathukiya',
            'company' => 'Italian Door',
            'phone' => ['9876543210'],
            'email' => 'sahil@italiandoor.com',
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Sahil M.',
            'company' => 'Italian Doors LLP',
            'phone' => ['9876543210'],
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'phone',
            ])
            ->assertJsonPath('existing_cards.0.name', 'Sahil Mathukiya');

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 2: Phone duplicate with formatting differences (+91, spaces, dashes, leading zero).
     */
    public function test_phone_duplicate_with_formatting_differences(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Dipak Bhai',
            'company' => 'Morbi Depo',
            'phone' => ['+91 76007 68285'],
        ]);

        // Attempting to save with leading zero and dashes: 076007-68285
        $response = $this->postJson('/api/cards', [
            'name' => 'Dipak Bhai Patel',
            'company' => 'Morbi Tiles',
            'phone' => ['076007-68285'],
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'phone',
            ])
            ->assertJsonPath('existing_cards.0.name', 'Dipak Bhai');

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 3: Email duplicate detection (case-insensitive).
     */
    public function test_email_duplicate(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Rakesh Patel',
            'company' => 'Patel Sanitary',
            'email' => 'rakesh@patelsanitary.com',
            'phone' => ['9825012345'],
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Rakesh Kumar Patel',
            'company' => 'Patel Ceramics',
            'email' => 'RAKESH@PATELSANITARY.COM',
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'email',
            ])
            ->assertJsonPath('existing_cards.0.email', 'rakesh@patelsanitary.com');

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 4: Name + Company combination match.
     */
    public function test_name_and_company_possible_duplicate(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Dipak Soni',
            'name_english' => 'Dipak Soni',
            'company' => 'Parshottamdas Jewellers',
            'company_english' => 'Parshottamdas Jewellers',
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Dipak Soni',
            'company' => 'Parshottamdas Jewellers',
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'name_company',
            ]);

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 5: Different employees from the same company are allowed.
     */
    public function test_same_company_with_different_employees_is_not_duplicate(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Sanjay Mehta',
            'company' => 'Interior World',
            'phone' => ['9825219767'],
            'email' => 'sanjay@interiorworld.com',
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Pooja Mehta',
            'company' => 'Interior World',
            'phone' => ['9825219999'],
            'email' => 'pooja@interiorworld.com',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'duplicate_override' => false,
            ]);

        $this->assertDatabaseCount('cards', 2);
    }

    /**
     * Test 6: Multiple phone numbers array matching.
     */
    public function test_multiple_phone_numbers_duplicate_detection(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Alankar Jewellers',
            'company' => 'Alankar Group',
            'phone' => ['9825113086', '9825113087', '0281 2456789'],
        ]);

        // Incoming card has the 2nd phone number in its list
        $response = $this->postJson('/api/cards', [
            'name' => 'Ritesh Bhogar',
            'company' => 'Alankar & Co',
            'phone' => ['9825113087'],
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'phone',
            ]);

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 7: Force save override with force_duplicate=true.
     */
    public function test_force_save_override(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Haresh Patel',
            'company' => 'Simpolo Vitrified',
            'phone' => ['9825099999'],
        ]);

        // 1. Initial attempt fails with 409
        $failResponse = $this->postJson('/api/cards', [
            'name' => 'Haresh Patel (Branch 2)',
            'company' => 'Simpolo Ceramics',
            'phone' => ['9825099999'],
        ]);
        $failResponse->assertStatus(409);

        // 2. Override attempt with force_duplicate=true succeeds with 201
        $overrideResponse = $this->postJson('/api/cards', [
            'name' => 'Haresh Patel (Branch 2)',
            'company' => 'Simpolo Ceramics',
            'phone' => ['9825099999'],
            'force_duplicate' => true,
        ]);

        $overrideResponse->assertStatus(201)
            ->assertJson([
                'success' => true,
                'duplicate_override' => true,
            ]);

        $this->assertDatabaseCount('cards', 2);
    }

    /**
     * Test 8: Non-duplicate new card saves normally.
     */
    public function test_no_duplicate_normal_successful_save(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Card One',
            'company' => 'Alpha Tiles',
            'phone' => ['9825011111'],
            'email' => 'alpha@tiles.com',
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Card Two',
            'company' => 'Beta Granito',
            'phone' => ['9825022222'],
            'email' => 'beta@granito.com',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'duplicate_override' => false,
            ]);

        $this->assertDatabaseCount('cards', 2);
    }

    /**
     * Test 9: Multiple existing cards matching one scanned card.
     */
    public function test_multiple_duplicate_matches(): void
    {
        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Shared Phone Contact A',
            'company' => 'Company A',
            'phone' => ['9825033333'],
        ]);

        Card::create([
            'workspace_id' => $this->workspace->id,
            'name' => 'Shared Phone Contact B',
            'company' => 'Company B',
            'phone' => ['9825033333'],
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Incoming Contact C',
            'company' => 'Company C',
            'phone' => ['9825033333'],
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
            ]);

        $existingCards = $response->json('existing_cards');
        $this->assertCount(2, $existingCards);
    }
}
