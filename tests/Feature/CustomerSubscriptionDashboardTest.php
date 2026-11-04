<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceSubscription;
use App\Models\WorkspaceSubscriptionHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerSubscriptionDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function createCustomer(string $email = 'customer@example.com', string $role = 'owner'): array
    {
        $user = User::create([
            'name' => 'Demo Customer',
            'email' => $email,
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);

        $workspace = Workspace::create([
            'name' => 'Ceramix Studio',
            'slug' => 'ceramix-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => $role]);
        $user->update(['current_workspace_id' => $workspace->id]);

        $tokenResult = ApiToken::createTokenForUser($user);

        // Find existing free plan or create if not present
        $freePlan = Plan::where('slug', 'free')->first();
        if (! $freePlan) {
            $freePlan = Plan::create([
                'name' => 'Free',
                'slug' => 'free',
                'description' => 'Default starter plan',
                'price' => 0.00,
                'monthly_scan_allowance' => 50,
                'features' => ['vcard_export', 'csv_export'],
                'is_active' => true,
                'is_default' => true,
            ]);
        }

        $subscription = WorkspaceSubscription::firstOrCreate(
            ['workspace_id' => $workspace->id],
            [
                'plan_id' => $freePlan->id,
                'status' => 'active',
                'started_at' => now(),
                'current_period_starts_at' => now()->startOfMonth(),
                'current_period_ends_at' => now()->endOfMonth(),
            ]
        );

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
            'subscription' => $subscription,
            'plan' => $freePlan,
        ];
    }

    public function test_customer_can_retrieve_current_subscription_with_enriched_workspace_and_summary(): void
    {
        $setup = $this->createCustomer();

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/current');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('currency', 'INR')
            ->assertJsonPath('currency_symbol', '₹')
            ->assertJsonPath('workspace.id', $setup['workspace']->id)
            ->assertJsonPath('workspace.name', 'Ceramix Studio')
            ->assertJsonPath('user_role', 'owner')
            ->assertJsonPath('can_manage_billing', true)
            ->assertJsonPath('plan.name', $setup['plan']->name)
            ->assertJsonPath('quota.monthly_allowance', (int) $setup['plan']->monthly_scan_allowance)
            ->assertJsonPath('quota.used_credits', 0)
            ->assertJsonPath('quota.remaining_credits', (int) $setup['plan']->monthly_scan_allowance);

        $this->assertNotEmpty($response->json('workspaces_summary'));
        $this->assertEquals($setup['workspace']->id, $response->json('workspaces_summary.0.id'));
    }

    public function test_member_role_has_read_only_quota_access_but_forbidden_from_billing_management(): void
    {
        $ownerSetup = $this->createCustomer('owner@example.com', 'owner');

        // Create a member user in the same workspace
        $member = User::create([
            'name' => 'Booth Member',
            'email' => 'member@example.com',
            'password' => Hash::make('password123'),
            'status' => 'active',
            'current_workspace_id' => $ownerSetup['workspace']->id,
        ]);
        $ownerSetup['workspace']->users()->attach($member->id, ['role' => 'member']);
        $memberToken = ApiToken::createTokenForUser($member)['plain_token'];

        // 1. Current endpoint should succeed for member, with can_manage_billing = false
        $currResponse = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/subscription/current');

        $currResponse->assertOk()
            ->assertJsonPath('user_role', 'member')
            ->assertJsonPath('can_manage_billing', false);

        // 2. Billing management endpoints must return 403 BILLING_ACCESS_DENIED
        $ledgerRes = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/subscription/usage-ledger');
        $ledgerRes->assertStatus(403)
            ->assertJsonPath('error_code', 'BILLING_ACCESS_DENIED');

        $historyRes = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/subscription/history');
        $historyRes->assertStatus(403)
            ->assertJsonPath('error_code', 'BILLING_ACCESS_DENIED');

        $paymentRes = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/subscription/payments');
        $paymentRes->assertStatus(403)
            ->assertJsonPath('error_code', 'BILLING_ACCESS_DENIED');

        $plansRes = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->getJson('/api/subscription/plans');
        $plansRes->assertStatus(403)
            ->assertJsonPath('error_code', 'BILLING_ACCESS_DENIED');

        $upgradeRes = $this->withHeader('Authorization', 'Bearer '.$memberToken)
            ->postJson('/api/subscription/request-upgrade', ['plan_id' => $ownerSetup['plan']->id]);
        $upgradeRes->assertStatus(403)
            ->assertJsonPath('error_code', 'BILLING_ACCESS_DENIED');
    }

    public function test_owner_can_view_usage_ledger_with_pagination(): void
    {
        $setup = $this->createCustomer();

        // Seed some ledger entries
        ScanUsageLedger::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'operation_type' => 'scan_confirmed',
            'quantity' => 1,
            'idempotency_key' => Str::uuid()->toString(),
            'status' => 'confirmed',
            'reserved_at' => now(),
            'billing_period_starts_at' => now()->startOfMonth(),
            'billing_period_ends_at' => now()->endOfMonth(),
            'reason' => 'Business card extraction saved',
            'confirmed_at' => now(),
        ]);

        ScanUsageLedger::create([
            'workspace_id' => $setup['workspace']->id,
            'user_id' => $setup['user']->id,
            'operation_type' => 'scan_confirmed',
            'quantity' => 2,
            'idempotency_key' => Str::uuid()->toString(),
            'status' => 'confirmed',
            'reserved_at' => now(),
            'billing_period_starts_at' => now()->startOfMonth(),
            'billing_period_ends_at' => now()->endOfMonth(),
            'reason' => 'Bulk batch card extraction saved',
            'confirmed_at' => now(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/usage-ledger?per_page=10');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('pagination.total', 2)
            ->assertJsonCount(2, 'ledger')
            ->assertJsonPath('ledger.0.operation_type', 'scan_confirmed');
    }

    public function test_owner_can_view_workspace_subscription_history(): void
    {
        $setup = $this->createCustomer();

        $proPlan = Plan::create([
            'name' => 'Growth Pro',
            'slug' => 'growth-pro-'.uniqid(),
            'price' => 1999.00,
            'monthly_scan_allowance' => 500,
            'features' => ['vcard_export', 'csv_export', 'bulk_import'],
            'is_active' => true,
        ]);

        WorkspaceSubscriptionHistory::create([
            'workspace_id' => $setup['workspace']->id,
            'subscription_id' => $setup['subscription']->id,
            'previous_plan_id' => $setup['plan']->id,
            'plan_id' => $proPlan->id,
            'plan_name' => 'Growth Pro',
            'previous_plan_name' => $setup['plan']->name,
            'previous_status' => 'active',
            'status' => 'active',
            'assignment_source' => 'admin_assigned',
            'period_starts_at' => now(),
            'period_ends_at' => now()->addMonth(),
            'reason' => 'Customer requested upgrade for expo booth',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/history');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('history.0.plan_name', 'Growth Pro')
            ->assertJsonPath('history.0.assignment_source', 'admin_assigned')
            ->assertJsonPath('history.0.reason', 'Customer requested upgrade for expo booth');
    }

    public function test_owner_can_view_payment_transactions_with_status_filter_and_safe_data(): void
    {
        $setup = $this->createCustomer();

        // Seed payments
        PaymentTransaction::create([
            'workspace_id' => $setup['workspace']->id,
            'subscription_id' => $setup['subscription']->id,
            'plan_id' => $setup['plan']->id,
            'plan_name' => $setup['plan']->name,
            'user_id' => $setup['user']->id,
            'amount' => 1499.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_123',
            'gateway_payment_id' => 'pay_test_123456',
            'gateway_signature' => 'secret_sig_do_not_leak',
            'status' => 'successful',
            'paid_at' => now(),
        ]);

        PaymentTransaction::create([
            'workspace_id' => $setup['workspace']->id,
            'subscription_id' => $setup['subscription']->id,
            'plan_id' => $setup['plan']->id,
            'plan_name' => $setup['plan']->name,
            'user_id' => $setup['user']->id,
            'amount' => 1499.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_pending_123',
            'gateway_payment_id' => 'pay_test_pending',
            'status' => 'pending',
        ]);

        // Filter: successful
        $successResponse = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/payments?status=successful');

        $successResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('pagination.total', 1)
            ->assertJsonPath('transactions.0.gateway_payment_id', 'pay_test_123456')
            ->assertJsonPath('transactions.0.status', 'successful');

        // Verify sensitive fields are not in the response
        $firstItem = $successResponse->json('transactions.0');
        $this->assertArrayNotHasKey('gateway_signature', $firstItem);
        $this->assertArrayNotHasKey('raw_payload', $firstItem);
        $this->assertArrayNotHasKey('secret', $firstItem);

        // Filter: refunded (empty state)
        $emptyResponse = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/payments?status=refunded');

        $emptyResponse->assertOk()
            ->assertJsonPath('pagination.total', 0)
            ->assertJsonPath('transactions', []);
    }

    public function test_owner_can_list_active_plans_with_current_plan_flag(): void
    {
        $setup = $this->createCustomer();

        $growthPlan = Plan::create([
            'name' => 'Growth Enterprise',
            'slug' => 'growth-ent-'.uniqid(),
            'price' => 4999.00,
            'monthly_scan_allowance' => 2000,
            'features' => ['all_features'],
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/plans');

        $response->assertOk()
            ->assertJsonPath('success', true);

        $plans = $response->json('plans');
        $this->assertNotEmpty($plans);

        // Current free plan must have is_current = true
        $currentPlan = collect($plans)->firstWhere('id', $setup['plan']->id);
        $this->assertNotNull($currentPlan);
        $this->assertTrue($currentPlan['is_current']);

        // Growth plan must have is_current = false
        $otherPlan = collect($plans)->firstWhere('id', $growthPlan->id);
        $this->assertNotNull($otherPlan);
        $this->assertFalse($otherPlan['is_current']);
    }

    public function test_owner_can_request_plan_upgrade_with_sales_contact_link(): void
    {
        $setup = $this->createCustomer();

        $targetPlan = Plan::create([
            'name' => 'Mega Expo Plan',
            'slug' => 'mega-expo-'.uniqid(),
            'price' => 2999.00,
            'monthly_scan_allowance' => 1000,
            'features' => ['vcard_export', 'csv_export', 'bulk_import'],
            'is_active' => true,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->postJson('/api/subscription/request-upgrade', [
                'plan_id' => $targetPlan->id,
                'phone' => '+91 9876543210',
                'note' => 'Need higher quota for Morbi trade show next week',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('target_plan.id', $targetPlan->id)
            ->assertJsonPath('target_plan.name', 'Mega Expo Plan');

        $this->assertStringContainsString('wa.me', $response->json('support.whatsapp'));
        $this->assertStringContainsString('9727509762', $response->json('support.whatsapp'));
        $this->assertStringContainsString('Mega+Expo+Plan', $response->json('support.whatsapp'));
        $this->assertEquals('+91 97275 09762', $response->json('support.phone'));
    }

    public function test_multi_workspace_customer_receives_separate_workspace_summaries(): void
    {
        $setup = $this->createCustomer();
        $user = $setup['user'];

        // Create second workspace for same customer
        $workspace2 = Workspace::create([
            'name' => 'Morbi Tile Expo',
            'slug' => 'morbi-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);
        $workspace2->users()->attach($user->id, ['role' => 'owner']);

        $proPlan = Plan::create([
            'name' => 'Pro Unlimited',
            'slug' => 'pro-unlimited-'.uniqid(),
            'price' => 3999.00,
            'monthly_scan_allowance' => 3000,
            'features' => ['all'],
            'is_active' => true,
        ]);

        WorkspaceSubscription::create([
            'workspace_id' => $workspace2->id,
            'plan_id' => $proPlan->id,
            'status' => 'active',
            'started_at' => now(),
            'current_period_starts_at' => now()->startOfMonth(),
            'current_period_ends_at' => now()->endOfMonth(),
        ]);

        $response = $this->withHeader('Authorization', 'Bearer '.$setup['token'])
            ->getJson('/api/subscription/current');

        $response->assertOk();
        $summaries = $response->json('workspaces_summary');
        $this->assertCount(2, $summaries);

        $ws1 = collect($summaries)->firstWhere('id', $setup['workspace']->id);
        $ws2 = collect($summaries)->firstWhere('id', $workspace2->id);

        $this->assertTrue($ws1['is_current_workspace']);
        $this->assertEquals($setup['plan']->name, $ws1['plan_name']);

        $this->assertFalse($ws2['is_current_workspace']);
        $this->assertEquals('Pro Unlimited', $ws2['plan_name']);
        $this->assertEquals(3999.00, $ws2['price']);
    }
}
