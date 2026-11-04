<?php

namespace Tests\Feature;

use App\Models\PaymentTransaction;
use App\Models\Plan;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\PlatformAuditLog;
use App\Models\ScanUsageLedger;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceSubscriptionHistory;
use App\Services\ScanQuotaService;
use App\Services\WorkspaceSubscriptionService;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;

class SubscriptionHistoryAndPaymentTransactionTest extends TestCase
{
    use RefreshDatabase;

    private function createPlatformAdmin(): array
    {
        $admin = PlatformAdmin::create([
            'name' => 'Super Admin',
            'email' => 'admin_'.uniqid().'@businesscardscan.ai',
            'password' => bcrypt('password123'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin);

        return ['admin' => $admin, 'token' => $tokenResult['token']];
    }

    private function createCustomerWithWorkspace(): array
    {
        $user = User::create([
            'name' => 'Test Customer',
            'email' => 'customer_'.uniqid().'@test.com',
            'password' => bcrypt('password123'),
        ]);

        $workspace = Workspace::create([
            'name' => 'Acme Workspace',
            'slug' => 'acme-'.uniqid(),
            'owner_id' => $user->id,
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->forceFill(['current_workspace_id' => $workspace->id])->save();

        $tokenData = $user->createToken('customer_token');

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenData['plain_token'],
        ];
    }

    public function test_new_workspace_automatically_creates_initial_subscription_history(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        $subscription = $workspace->activeSubscription();
        $this->assertNotNull($subscription);
        $this->assertEquals('system_free', $subscription->assignment_source);

        $histories = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->get();
        $this->assertCount(1, $histories);

        $initial = $histories->first();
        $this->assertNull($initial->previous_plan_id);
        $this->assertNull($initial->previous_status);
        $this->assertEquals($subscription->plan_id, $initial->plan_id);
        $this->assertEquals('active', $initial->status);
        $this->assertEquals('system_free', $initial->assignment_source);
        $this->assertNull($initial->assigned_by_admin_id);
        $this->assertNotNull($initial->period_starts_at);
        $this->assertNotNull($initial->period_ends_at);
        $this->assertStringContainsString('Initial Free Plan', $initial->reason);
    }

    public function test_existing_workspaces_do_not_receive_fabricated_historical_plan_changes(): void
    {
        $data = $this->createCustomerWithWorkspace();
        $workspace = $data['workspace'];

        // Initial creation recorded exactly 1 history entry (the initial assignment)
        $this->assertEquals(1, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());

        // Calling activeSubscription multiple times does not add fake historical records
        $workspace->activeSubscription();
        $workspace->activeSubscription();

        $this->assertEquals(1, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());
    }

    public function test_admin_plan_changes_append_history_instead_of_overwriting_it(): void
    {
        $adminData = $this->createPlatformAdmin();
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];

        $proPlan = Plan::where('slug', 'pro')->firstOrFail();
        $businessPlan = Plan::where('slug', 'business')->firstOrFail();

        // 1st Change: Free -> Pro
        $res1 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Upgrade to Pro requested by customer',
            ]);
        $res1->assertOk()->assertJsonPath('success', true);

        // 2nd Change: Pro -> Business
        $res2 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $businessPlan->id,
                'reason' => 'Scale up to Business tier',
            ]);
        $res2->assertOk()->assertJsonPath('success', true);

        // Assert 3 total immutable entries: Initial Free, Upgrade to Pro, Upgrade to Business
        $histories = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)
            ->orderBy('id', 'asc')
            ->get();

        $this->assertCount(3, $histories);

        // Entry 1: Free
        $this->assertNull($histories[0]->previous_plan_id);
        $this->assertEquals('system_free', $histories[0]->assignment_source);

        // Entry 2: Free -> Pro
        $this->assertEquals($histories[0]->plan_id, $histories[1]->previous_plan_id);
        $this->assertEquals($proPlan->id, $histories[1]->plan_id);
        $this->assertEquals('admin_assigned', $histories[1]->assignment_source);
        $this->assertEquals($adminData['admin']->id, $histories[1]->assigned_by_admin_id);
        $this->assertEquals('Upgrade to Pro requested by customer', $histories[1]->reason);

        // Entry 3: Pro -> Business
        $this->assertEquals($proPlan->id, $histories[2]->previous_plan_id);
        $this->assertEquals($businessPlan->id, $histories[2]->plan_id);
        $this->assertEquals('admin_assigned', $histories[2]->assignment_source);
        $this->assertEquals('Scale up to Business tier', $histories[2]->reason);

        // Platform audit log recorded both administrative changes
        $this->assertEquals(2, PlatformAuditLog::where('action', 'workspace.plan_change')->where('target_id', $workspace->id)->count());
    }

    public function test_repeated_requests_do_not_create_duplicate_history(): void
    {
        $adminData = $this->createPlatformAdmin();
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        // 1st change to Pro
        $res1 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Upgrade to Pro',
            ]);
        $res1->assertOk();

        $countAfterFirst = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count();
        $this->assertEquals(2, $countAfterFirst); // 1 initial + 1 change

        // Repeated change to the same Pro plan
        $res2 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Upgrade to Pro',
            ]);
        $res2->assertOk();

        // History count remains identical: no duplicate entry
        $this->assertEquals(2, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());
    }

    public function test_service_with_idempotency_key_prevents_duplicate_history(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        $service = app(WorkspaceSubscriptionService::class);

        // 1st execution
        $sub1 = $service->changePlan($workspace, $proPlan, [
            'source' => 'checkout',
            'idempotency_key' => 'idem_test_key_999',
            'reason' => 'Online Checkout',
        ]);
        $this->assertEquals($proPlan->id, $sub1->plan_id);

        $count = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count();

        // 2nd execution with identical idempotency key
        $sub2 = $service->changePlan($workspace, $proPlan, [
            'source' => 'checkout',
            'idempotency_key' => 'idem_test_key_999',
            'reason' => 'Online Checkout',
        ]);
        $this->assertEquals($proPlan->id, $sub2->plan_id);

        // Count must not increase
        $this->assertEquals($count, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());
    }

    public function test_failed_transactions_roll_back_both_subscription_changes_and_history(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $freePlanId = $workspace->activeSubscription()->plan_id;
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        $initialHistoryCount = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count();

        // Attempt plan change inside a failing transaction
        try {
            DB::transaction(function () use ($workspace, $proPlan) {
                $sub = $workspace->activeSubscription();
                $sub->update(['plan_id' => $proPlan->id]);

                WorkspaceSubscriptionHistory::create([
                    'workspace_id' => $workspace->id,
                    'subscription_id' => $sub->id,
                    'previous_plan_id' => $sub->plan_id,
                    'plan_id' => $proPlan->id,
                    'period_starts_at' => now(),
                    'assignment_source' => 'admin_assigned',
                ]);

                throw new Exception('Simulated database breakdown');
            });
        } catch (Exception $e) {
            $this->assertEquals('Simulated database breakdown', $e->getMessage());
        }

        // Verify rollback: subscription is still Free, and no new history was stored
        $workspace->refresh();
        $this->assertEquals($freePlanId, $workspace->activeSubscription()->plan_id);
        $this->assertEquals($initialHistoryCount, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());
    }

    public function test_scan_usage_and_quota_reservations_remain_unchanged_after_plan_change(): void
    {
        $adminData = $this->createPlatformAdmin();
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $user = $customerData['user'];
        $subscription = $workspace->activeSubscription();

        $quotaService = app(ScanQuotaService::class);

        // 1. Create 1 confirmed usage entry
        ScanUsageLedger::create([
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'user_id' => $user->id,
            'idempotency_key' => 'scan_ledger_1',
            'operation_type' => 'card_scan',
            'quantity' => 1,
            'status' => 'confirmed',
            'reserved_at' => now(),
            'confirmed_at' => now(),
            'billing_period_starts_at' => $subscription->current_period_starts_at,
            'billing_period_ends_at' => $subscription->current_period_ends_at,
        ]);

        // 2. Create 1 active reservation entry
        ScanUsageLedger::create([
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'user_id' => $user->id,
            'idempotency_key' => 'scan_ledger_2',
            'operation_type' => 'card_scan',
            'quantity' => 1,
            'status' => 'reserved',
            'reserved_at' => now(),
            'billing_period_starts_at' => $subscription->current_period_starts_at,
            'billing_period_ends_at' => $subscription->current_period_ends_at,
        ]);

        $quotaBefore = $quotaService->getWorkspaceQuota($workspace);
        $this->assertEquals(1, $quotaBefore['used_credits']);
        $this->assertEquals(1, $quotaBefore['reserved_credits']);
        $this->assertEquals(48, $quotaBefore['remaining_credits']); // 50 - 2 = 48

        // Admin upgrades workspace to Pro (500 scans)
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();
        $res = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Upgrade to Pro',
            ]);
        $res->assertOk();

        // Ledger entries remain exactly as they were
        $this->assertEquals(2, ScanUsageLedger::where('workspace_id', $workspace->id)->count());

        // Quota reflects new allowance while preserving used & reserved credits
        $quotaAfter = $quotaService->getWorkspaceQuota($workspace->fresh());
        $this->assertEquals(1, $quotaAfter['used_credits']);
        $this->assertEquals(1, $quotaAfter['reserved_credits']);
        $this->assertEquals(500, $quotaAfter['monthly_allowance']);
        $this->assertEquals(498, $quotaAfter['remaining_credits']); // 500 - 2 = 498
    }

    public function test_payment_transaction_records_can_be_created_with_valid_references(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $user = $customerData['user'];
        $subscription = $workspace->activeSubscription();
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        $transaction = PaymentTransaction::create([
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'plan_id' => $proPlan->id,
            'user_id' => $user->id,
            'amount' => 999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_Kj8H9g2F',
            'gateway_payment_id' => 'pay_Kj8H9g2F_1',
            'gateway_signature' => 'dummy_signature_hash',
            'status' => 'successful',
            'paid_at' => now(),
            'gateway_response' => [
                'method' => 'upi',
                'vpa' => 'customer@upi',
                'bank' => null,
            ],
        ]);

        $this->assertDatabaseHas('payment_transactions', [
            'id' => $transaction->id,
            'gateway_payment_id' => 'pay_Kj8H9g2F_1',
            'status' => 'successful',
        ]);

        $this->assertTrue($transaction->isSuccessful());
        $this->assertFalse($transaction->isFailed());
        $this->assertEquals('999.00', $transaction->amount);
        $this->assertEquals('upi', $transaction->gateway_response['method']);

        // Assert relations work
        $this->assertEquals($workspace->id, $transaction->workspace->id);
        $this->assertEquals($subscription->id, $transaction->subscription->id);
        $this->assertEquals($proPlan->id, $transaction->plan->id);
        $this->assertEquals($user->id, $transaction->user->id);

        // Unique constraint on gateway_payment_id prevents duplicates
        $this->expectException(QueryException::class);
        PaymentTransaction::create([
            'workspace_id' => $workspace->id,
            'amount' => 999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_payment_id' => 'pay_Kj8H9g2F_1', // Duplicate
            'status' => 'successful',
        ]);
    }

    public function test_invalid_workspace_subscription_combinations_are_rejected(): void
    {
        $customerA = $this->createCustomerWithWorkspace();
        $customerB = $this->createCustomerWithWorkspace();

        $workspaceA = $customerA['workspace'];
        $workspaceB = $customerB['workspace'];
        $subB = $workspaceB->activeSubscription();
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        // Attempting to attach Workspace B's subscription to Workspace A's history throws InvalidArgumentException
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Subscription does not belong to the specified workspace.');

        WorkspaceSubscriptionHistory::create([
            'workspace_id' => $workspaceA->id,
            'subscription_id' => $subB->id, // Mismatched!
            'plan_id' => $proPlan->id,
            'period_starts_at' => now(),
            'assignment_source' => 'admin_assigned',
        ]);
    }

    public function test_platform_admin_can_retrieve_workspace_subscription_history(): void
    {
        $adminData = $this->createPlatformAdmin();
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        // Change plan once
        $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->postJson("/api/platform-admin/workspaces/{$workspace->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Upgrade to Pro for expo',
            ]);

        // Fetch history
        $response = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->getJson("/api/platform-admin/workspaces/{$workspace->id}/subscription-history");

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('workspace_id', $workspace->id);

        $historyList = $response->json('history');
        $this->assertCount(2, $historyList);
        $this->assertEquals('Upgrade to Pro for expo', $historyList[0]['reason']);
        $this->assertEquals($proPlan->id, $historyList[0]['plan_id']);
    }

    public function test_non_admin_cannot_access_subscription_history(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];

        // Customer token cannot access platform admin endpoint
        $response = $this->withHeader('Authorization', "Bearer {$customerData['token']}")
            ->getJson("/api/platform-admin/workspaces/{$workspace->id}/subscription-history");

        $response->assertStatus(401);
    }

    public function test_workspace_deletion_cannot_erase_financial_history(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $user = $customerData['user'];
        $subscription = $workspace->activeSubscription();
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        // 1. History exists
        $this->assertEquals(1, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());

        // 2. Create a payment transaction for this workspace
        PaymentTransaction::create([
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'plan_id' => $proPlan->id,
            'user_id' => $user->id,
            'amount' => 999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_payment_id' => 'pay_protect_del_1',
            'status' => 'successful',
        ]);

        // Attempting to delete workspace must throw QueryException due to restrictive foreign key
        try {
            $workspace->delete();
            $this->fail('Expected workspace deletion to fail due to restrictive foreign key on financial records.');
        } catch (QueryException $e) {
            $this->assertTrue(true, 'Deletion was blocked as expected.');
        }

        // Verify financial history and payment transactions were preserved
        $this->assertEquals(1, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());
        $this->assertEquals(1, PaymentTransaction::where('workspace_id', $workspace->id)->count());
    }

    public function test_subscription_deletion_preserves_readable_history_with_snapshots(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $subscription = $workspace->activeSubscription();

        $history = WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->firstOrFail();
        $this->assertEquals($workspace->name, $history->workspace_name);
        $this->assertEquals('Free', $history->plan_name);
        $this->assertEquals('0.00', $history->plan_price);

        // Delete the subscription record
        $subscription->delete();

        // History entry still exists
        $this->assertEquals(1, WorkspaceSubscriptionHistory::where('workspace_id', $workspace->id)->count());

        $freshHistory = $history->fresh();
        $this->assertNull($freshHistory->subscription_id);
        $this->assertEquals($workspace->id, $freshHistory->workspace_id);
        $this->assertEquals($workspace->name, $freshHistory->workspace_name);
        $this->assertEquals('Free', $freshHistory->plan_name);
        $this->assertEquals('0.00', $freshHistory->plan_price);
        $this->assertNotNull($freshHistory->period_starts_at);
    }

    public function test_cross_workspace_idempotency_key_collision_is_rejected(): void
    {
        $adminData = $this->createPlatformAdmin();
        $wsA = $this->createCustomerWithWorkspace()['workspace'];
        $wsB = $this->createCustomerWithWorkspace()['workspace'];
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        // 1. Workspace A uses idempotency key
        $resA = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->withHeader('X-Idempotency-Key', 'unique_shared_key_123')
            ->postJson("/api/platform-admin/workspaces/{$wsA->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Ws A Upgrade',
            ]);
        $resA->assertOk();

        // 2. Workspace B tries to reuse the exact same idempotency key
        $resB = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->withHeader('X-Idempotency-Key', 'unique_shared_key_123')
            ->postJson("/api/platform-admin/workspaces/{$wsB->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Ws B Upgrade Collision',
            ]);

        $resB->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'IDEMPOTENCY_CONFLICT');
    }

    public function test_same_workspace_conflicting_operation_idempotency_is_rejected(): void
    {
        $adminData = $this->createPlatformAdmin();
        $ws = $this->createCustomerWithWorkspace()['workspace'];
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();
        $bizPlan = Plan::where('slug', 'business')->firstOrFail();

        // 1. Workspace changes to Pro with key
        $res1 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->withHeader('X-Idempotency-Key', 'conflict_key_456')
            ->postJson("/api/platform-admin/workspaces/{$ws->id}/change-plan", [
                'plan_id' => $proPlan->id,
                'reason' => 'Change to Pro',
            ]);
        $res1->assertOk();

        // 2. Same workspace reuses key for different plan (Business)
        $res2 = $this->withHeader('Authorization', "Bearer {$adminData['token']}")
            ->withHeader('X-Idempotency-Key', 'conflict_key_456')
            ->postJson("/api/platform-admin/workspaces/{$ws->id}/change-plan", [
                'plan_id' => $bizPlan->id,
                'reason' => 'Conflict to Business',
            ]);

        $res2->assertStatus(409)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'IDEMPOTENCY_CONFLICT');
    }

    public function test_payment_data_protection_strips_raw_card_numbers_and_secrets(): void
    {
        $customerData = $this->createCustomerWithWorkspace();
        $workspace = $customerData['workspace'];
        $user = $customerData['user'];
        $subscription = $workspace->activeSubscription();
        $proPlan = Plan::where('slug', 'pro')->firstOrFail();

        $tx = PaymentTransaction::create([
            'workspace_id' => $workspace->id,
            'subscription_id' => $subscription->id,
            'plan_id' => $proPlan->id,
            'user_id' => $user->id,
            'amount' => 999.00,
            'currency' => 'INR',
            'gateway' => 'razorpay',
            'gateway_order_id' => 'order_secure_123',
            'gateway_payment_id' => 'pay_secure_123',
            'gateway_signature' => 'valid_hmac_sha256_hash_digest',
            'status' => 'successful',
            'paid_at' => now(),
            'gateway_response' => [
                'status' => 'captured',
                'method' => 'card',
                'card_last4' => '4242',
                'card_network' => 'visa',
                'card_number' => '4111111111114242', // FORBIDDEN!
                'cvv' => '999',                     // FORBIDDEN!
                'secret' => 'sk_live_supersecret',    // FORBIDDEN!
                'token' => 'access_token_forbidden', // FORBIDDEN!
                'password' => 'supersecretpass',     // FORBIDDEN!
            ],
        ]);

        $fresh = $tx->fresh();
        $response = $fresh->gateway_response;

        // Safe fields preserved
        $this->assertEquals('captured', $response['status']);
        $this->assertEquals('card', $response['method']);
        $this->assertEquals('4242', $response['card_last4']);
        $this->assertEquals('visa', $response['card_network']);

        // Sensitive fields stripped
        $this->assertArrayNotHasKey('card_number', $response);
        $this->assertArrayNotHasKey('cvv', $response);
        $this->assertArrayNotHasKey('secret', $response);
        $this->assertArrayNotHasKey('token', $response);
        $this->assertArrayNotHasKey('password', $response);

        // Verification signature is hidden from serialized array / JSON
        $array = $fresh->toArray();
        $this->assertArrayNotHasKey('gateway_signature', $array);

        // Snapshots were populated
        $this->assertEquals($workspace->name, $fresh->workspace_name);
        $this->assertEquals($proPlan->name, $fresh->plan_name);
        $this->assertEquals($user->email, $fresh->user_email);
    }
}
