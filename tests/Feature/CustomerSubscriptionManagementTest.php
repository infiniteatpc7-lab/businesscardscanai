<?php

namespace Tests\Feature;

use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\User;
use App\Models\Workspace;
use App\Services\WorkspaceSubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CustomerSubscriptionManagementTest extends TestCase
{
    use RefreshDatabase;

    private function createPlatformAdmin(): array
    {
        $admin = PlatformAdmin::create([
            'name' => 'Platform Super Admin',
            'email' => 'admin@platform.com',
            'password' => Hash::make('AdminPass123!'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin);

        return [
            'admin' => $admin,
            'token' => $tokenResult['token'],
        ];
    }

    private function createCustomer(string $email = 'customer@test.com'): User
    {
        return User::create([
            'name' => 'Test Customer',
            'email' => $email,
            'password' => Hash::make('Password123!'),
            'status' => 'active',
        ]);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->getJson('/api/platform-admin/customers')->assertStatus(401);
        $this->getJson('/api/platform-admin/customers/1')->assertStatus(401);
        $this->getJson('/api/platform-admin/payment-transactions')->assertStatus(401);
        $this->getJson('/api/platform-admin/workspaces/1/subscription-history')->assertStatus(401);
    }

    public function test_customer_list_returns_workspace_wise_plans_and_handles_multiple_workspaces(): void
    {
        $auth = $this->createPlatformAdmin();
        $customer = $this->createCustomer('multi_ws@test.com');

        $freePlan = Plan::firstOrCreate(
            ['slug' => 'free'],
            [
                'name' => 'Free Tier',
                'price' => 0.00,
                'currency' => 'INR',
                'monthly_scan_allowance' => 50,
                'is_active' => true,
                'is_default' => true,
            ]
        );

        $proPlan = Plan::firstOrCreate(
            ['slug' => 'pro-growth'],
            [
                'name' => 'Pro Growth',
                'price' => 1499.00,
                'currency' => 'INR',
                'monthly_scan_allowance' => 500,
                'is_active' => true,
                'is_default' => false,
            ]
        );

        // Workspace 1 on Free Plan
        $ws1 = Workspace::create([
            'name' => 'Workspace Alpha',
            'slug' => 'ws-alpha-'.uniqid(),
            'owner_id' => $customer->id,
            'status' => 'active',
        ]);
        $ws1->users()->attach($customer->id, ['role' => 'owner']);

        // Workspace 2 on Pro Plan
        $ws2 = Workspace::create([
            'name' => 'Workspace Beta',
            'slug' => 'ws-beta-'.uniqid(),
            'owner_id' => $customer->id,
            'status' => 'active',
        ]);
        $ws2->users()->attach($customer->id, ['role' => 'owner']);

        app(WorkspaceSubscriptionService::class)->changePlan($ws2, $proPlan, [
            'source' => 'admin_assigned',
            'admin' => $auth['admin'],
            'reason' => 'Customer upgraded business unit',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/customers');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $customers = $response->json('customers');
        $target = collect($customers)->firstWhere('id', $customer->id);

        $this->assertNotNull($target);
        $this->assertCount(2, $target['workspaces']);

        $ws1Data = collect($target['workspaces'])->firstWhere('id', $ws1->id);
        $this->assertEquals($ws1->currentPlan()->name, $ws1Data['plan']['name']);
        $this->assertEquals(0, $ws1Data['plan']['price']);
        $this->assertTrue($ws1Data['plan']['is_free']);

        $ws2Data = collect($target['workspaces'])->firstWhere('id', $ws2->id);
        $this->assertEquals('Pro Growth', $ws2Data['plan']['name']);
        $this->assertEquals(1499.0, $ws2Data['plan']['price']);
        $this->assertFalse($ws2Data['plan']['is_free']);
    }

    public function test_customer_detail_returns_detailed_subscriptions_and_quota_for_all_workspaces(): void
    {
        $auth = $this->createPlatformAdmin();
        $customer = $this->createCustomer('detail_test@test.com');

        $ws = Workspace::create([
            'name' => 'Detailed Workspace',
            'slug' => 'detailed-ws-'.uniqid(),
            'owner_id' => $customer->id,
            'status' => 'active',
        ]);
        $ws->users()->attach($customer->id, ['role' => 'owner']);

        $response = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/customers/'.$customer->id);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('customer.id', $customer->id)
            ->assertJsonStructure([
                'customer' => [
                    'id',
                    'name',
                    'email',
                    'workspaces' => [
                        '*' => [
                            'id',
                            'name',
                            'subscription' => [
                                'id',
                                'status',
                                'current_period_starts_at',
                                'current_period_ends_at',
                            ],
                            'plan' => [
                                'id',
                                'name',
                                'price',
                                'currency',
                                'monthly_scan_allowance',
                            ],
                            'quota' => [
                                'monthly_allowance',
                                'used_credits',
                                'remaining_credits',
                                'period_starts_at',
                                'period_ends_at',
                            ],
                        ],
                    ],
                ],
            ]);
    }

    public function test_workspace_subscription_history_endpoint_returns_immutable_records(): void
    {
        $auth = $this->createPlatformAdmin();
        $customer = $this->createCustomer('history_test@test.com');

        $ws = Workspace::create([
            'name' => 'History Workspace',
            'slug' => 'hist-ws-'.uniqid(),
            'owner_id' => $customer->id,
            'status' => 'active',
        ]);
        $ws->users()->attach($customer->id, ['role' => 'owner']);

        $proPlan = Plan::create([
            'name' => 'Pro Tier',
            'slug' => 'pro-tier-'.uniqid(),
            'price' => 999.00,
            'currency' => 'INR',
            'monthly_scan_allowance' => 300,
            'is_active' => true,
        ]);

        // Change plan via Admin API
        $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->postJson('/api/platform-admin/workspaces/'.$ws->id.'/change-plan', [
                'plan_id' => $proPlan->id,
                'reason' => 'Manual enterprise upgrade',
            ])->assertOk();

        // Retrieve subscription history
        $response = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/workspaces/'.$ws->id.'/subscription-history');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('workspace_id', $ws->id);

        $history = $response->json('history');
        $this->assertNotEmpty($history);
        $latest = $history[0];

        $this->assertEquals('Pro Tier', $latest['plan_name']);
        $this->assertEquals('admin_assigned', $latest['assignment_source']);
        $this->assertEquals('Manual enterprise upgrade', $latest['reason']);
        $this->assertEquals($auth['admin']->name, $latest['assigned_by_admin']['name']);
    }

    public function test_payment_transactions_api_supports_customer_and_workspace_filtering_and_pagination(): void
    {
        $auth = $this->createPlatformAdmin();
        $customerA = $this->createCustomer('customer_a@test.com');
        $customerB = $this->createCustomer('customer_b@test.com');

        $wsA = Workspace::create([
            'name' => 'Workspace A',
            'slug' => 'ws-a-'.uniqid(),
            'owner_id' => $customerA->id,
            'status' => 'active',
        ]);
        $wsB = Workspace::create([
            'name' => 'Workspace B',
            'slug' => 'ws-b-'.uniqid(),
            'owner_id' => $customerB->id,
            'status' => 'active',
        ]);

        PaymentTransaction::create([
            'workspace_id' => $wsA->id,
            'user_id' => $customerA->id,
            'amount' => 999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_a_1',
            'gateway_payment_id' => 'pay_a_1',
            'status' => 'successful',
            'paid_at' => now(),
        ]);

        PaymentTransaction::create([
            'workspace_id' => $wsA->id,
            'user_id' => $customerA->id,
            'amount' => 1999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_a_2',
            'gateway_payment_id' => 'pay_a_2',
            'status' => 'pending',
        ]);

        PaymentTransaction::create([
            'workspace_id' => $wsB->id,
            'user_id' => $customerB->id,
            'amount' => 499.00,
            'currency' => 'INR',
            'gateway' => 'stripe',
            'gateway_order_id' => 'order_b_1',
            'gateway_payment_id' => 'pay_b_1',
            'status' => 'failed',
            'error_message' => 'Card declined',
        ]);

        // Filter by customer A
        $resCustomerA = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/payment-transactions?customer_id='.$customerA->id);

        $resCustomerA->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'transactions');

        // Filter by status 'successful'
        $resSuccessful = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/payment-transactions?status=successful');

        $resSuccessful->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'transactions')
            ->assertJsonPath('transactions.0.gateway_payment_id', 'pay_a_1');

        // Filter by workspace B
        $resWsB = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/payment-transactions?workspace_id='.$wsB->id);

        $resWsB->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'transactions')
            ->assertJsonPath('transactions.0.gateway_payment_id', 'pay_b_1');
    }

    public function test_payment_transactions_api_never_exposes_sensitive_gateway_data(): void
    {
        $auth = $this->createPlatformAdmin();
        $customer = $this->createCustomer('security_pay@test.com');
        $ws = Workspace::create([
            'name' => 'Sec Workspace',
            'slug' => 'sec-ws-'.uniqid(),
            'owner_id' => $customer->id,
            'status' => 'active',
        ]);

        PaymentTransaction::create([
            'workspace_id' => $ws->id,
            'user_id' => $customer->id,
            'amount' => 2499.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_payment_id' => 'pay_secret_check',
            'gateway_signature' => 'secret_hmac_signature_hash_99999',
            'status' => 'successful',
            'gateway_response' => [
                'card_last4' => '4242',
                'card_network' => 'Visa',
                'method' => 'card',
                'card_number' => '4242424242424242', // forbidden sensitive key
                'cvv' => '123',                       // forbidden sensitive key
                'access_token' => 'sk_live_xyz',      // forbidden sensitive key
            ],
            'paid_at' => now(),
        ]);

        $res = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/payment-transactions?search=pay_secret_check');

        $res->assertOk();
        $rawContent = $res->getContent();

        $this->assertStringNotContainsString('secret_hmac_signature_hash_99999', $rawContent);
        $this->assertStringNotContainsString('4242424242424242', $rawContent);
        $this->assertStringNotContainsString('sk_live_xyz', $rawContent);
        $this->assertStringNotContainsString('cvv', $rawContent);

        $tx = $res->json('transactions.0');
        $this->assertArrayNotHasKey('gateway_signature', $tx);
        $this->assertEquals('4242', $tx['safe_metadata']['card_last4']);
    }

    public function test_payment_transactions_api_returns_clean_empty_state_when_no_records_exist(): void
    {
        $auth = $this->createPlatformAdmin();

        $res = $this->withHeader('Authorization', 'Bearer '.$auth['token'])
            ->getJson('/api/platform-admin/payment-transactions?customer_id=99999');

        $res->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('transactions', [])
            ->assertJsonPath('pagination.total', 0);
    }
}
