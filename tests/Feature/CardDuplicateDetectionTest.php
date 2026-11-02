<?php

namespace Tests\Feature;

use App\Models\Card;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardDuplicateDetectionTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test 1: Exact phone duplicate detection.
     */
    public function test_exact_phone_duplicate(): void
    {
        Card::create([
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
            ]);

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 3: Email duplicate detection (case-insensitive & trimmed).
     */
    public function test_email_duplicate(): void
    {
        Card::create([
            'name' => 'Rajesh Sharma',
            'company' => 'Ceramix Tiles',
            'email' => 'rajesh@ceramix.in',
            'phone' => ['9812345678'],
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'R. Sharma',
            'company' => 'Ceramix Exports',
            'email' => '  RAJESH@CERAMIX.IN  ',
            'phone' => ['9988776655'], // Different phone
        ]);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'duplicate' => true,
                'match_reason' => 'email',
            ])
            ->assertJsonPath('existing_cards.0.company', 'Ceramix Tiles');

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 4: Name + company possible duplicate (when phone/email absent).
     */
    public function test_name_and_company_possible_duplicate(): void
    {
        Card::create([
            'name' => 'Sahil Mathukiya',
            'company' => 'Italian Door',
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'sahil mathukiya',
            'company' => 'italian door',
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
     * Test 5: Same company with different employees must NOT be flagged as duplicate.
     */
    public function test_same_company_with_different_employees_is_not_duplicate(): void
    {
        Card::create([
            'name' => 'Sahil Mathukiya',
            'company' => 'Italian Door',
            'phone' => ['9811111111'],
            'email' => 'sahil@italiandoor.com',
        ]);

        // Different colleague from the same firm
        $response = $this->postJson('/api/cards', [
            'name' => 'Ketan Patel',
            'company' => 'Italian Door',
            'phone' => ['9822222222'],
            'email' => 'ketan@italiandoor.com',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseCount('cards', 2);
    }

    /**
     * Test 6: Multiple phone numbers on card matches if any number intersects.
     */
    public function test_multiple_phone_numbers_duplicate_detection(): void
    {
        Card::create([
            'name' => 'Office Desk',
            'company' => 'Clay Decor',
            'phone' => ['02822240123', '9898989898'],
        ]);

        // Incoming card has mobile and an alternate number
        $response = $this->postJson('/api/cards', [
            'name' => 'Sales Lead',
            'company' => 'Clay Decor Group',
            'phone' => ['9777777777', '+91 98989 89898'],
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
     * Test 7: Force-save override allows saving when user confirms.
     */
    public function test_force_save_override(): void
    {
        Card::create([
            'name' => 'Existing Contact',
            'company' => 'Acme Corp',
            'phone' => ['9876543210'],
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Existing Contact (Branch 2)',
            'company' => 'Acme Corp',
            'phone' => ['9876543210'],
            'force_duplicate' => true,
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'duplicate_override' => true,
            ]);

        $this->assertDatabaseCount('cards', 2);
    }

    /**
     * Test 8: No duplicate normal successful save.
     */
    public function test_no_duplicate_normal_successful_save(): void
    {
        $response = $this->postJson('/api/cards', [
            'name' => 'Unique Contact',
            'company' => 'Unique Industries',
            'phone' => ['9123456789'],
            'email' => 'unique@example.com',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'duplicate_override' => false,
            ]);

        $this->assertDatabaseCount('cards', 1);
    }

    /**
     * Test 9: Multiple existing duplicate matches returned in list.
     */
    public function test_multiple_duplicate_matches(): void
    {
        Card::create([
            'name' => 'Card One',
            'company' => 'Shared Firm',
            'phone' => ['9876543210'],
        ]);

        Card::create([
            'name' => 'Card Two',
            'company' => 'Shared Firm',
            'phone' => ['+91 9876543210'],
            'force_duplicate' => true,
        ]);

        $response = $this->postJson('/api/cards', [
            'name' => 'Card Three',
            'company' => 'Shared Firm',
            'phone' => ['09876543210'],
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
