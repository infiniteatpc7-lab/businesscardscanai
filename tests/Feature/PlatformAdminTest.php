<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\PlatformAdmin;
use App\Models\PlatformAdminToken;
use App\Models\PlatformAuditLog;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PlatformAdminTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Helper to create a platform admin with an active token.
     */
    private function createPlatformAdmin(string $email = 'admin@example.com', string $role = 'super_admin'): array
    {
        $admin = PlatformAdmin::create([
            'name' => 'Test Platform Admin',
            'email' => $email,
            'password' => Hash::make('AdminSecret123!'),
            'role' => $role,
            'status' => 'active',
        ]);

        $tokenResult = PlatformAdminToken::createTokenForAdmin($admin);

        return [
            'admin' => $admin,
            'token' => $tokenResult['token'],
            'token_model' => $tokenResult['model'],
        ];
    }

    /**
     * Helper to create a customer user with workspace and token.
     */
    private function createCustomer(string $email = 'customer@example.com', string $status = 'active'): array
    {
        $user = User::create([
            'name' => 'Test Customer',
            'email' => $email,
            'password' => Hash::make('CustomerPass123!'),
            'status' => $status,
        ]);

        $workspace = Workspace::create([
            'name' => 'Customer Workspace',
            'slug' => 'cust-ws-'.uniqid(),
            'owner_id' => $user->id,
            'status' => 'active',
        ]);

        $workspace->users()->attach($user->id, ['role' => 'owner']);
        $user->update(['current_workspace_id' => $workspace->id]);

        $tokenResult = ApiToken::createTokenForUser($user);

        return [
            'user' => $user,
            'workspace' => $workspace,
            'token' => $tokenResult['plain_token'],
        ];
    }

    /**
     * 1. Admin Login with valid credentials.
     */
    public function test_platform_admin_can_login_with_valid_credentials_and_receive_token(): void
    {
        $admin = PlatformAdmin::create([
            'name' => 'Super Admin',
            'email' => 'login_admin@example.com',
            'password' => Hash::make('SecurePassword!456'),
            'role' => 'super_admin',
            'status' => 'active',
        ]);

        $response = $this->postJson('/api/platform-admin/auth/login', [
            'email' => 'login_admin@example.com',
            'password' => 'SecurePassword!456',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'token',
                'admin' => ['id', 'name', 'email', 'role'],
            ]);

        $this->assertTrue($response->json('success'));
        $this->assertNotEmpty($response->json('token'));
        $this->assertEquals($admin->id, $response->json('admin.id'));

        // Check audit log recorded
        $this->assertDatabaseHas('platform_audit_logs', [
            'platform_admin_id' => $admin->id,
            'action' => 'platform_admin.login',
        ]);
    }

    /**
     * 2. Admin Login failure and audit logging.
     */
    public function test_platform_admin_login_fails_with_invalid_credentials_and_logs_audit(): void
    {
        $response = $this->postJson('/api/platform-admin/auth/login', [
            'email' => 'wrong_admin@example.com',
            'password' => 'WrongPass!',
        ]);

        $response->assertStatus(401)
            ->assertJson(['success' => false]);

        $this->assertDatabaseHas('platform_audit_logs', [
            'action' => 'platform_admin.login_failed',
        ]);
    }

    /**
     * 3. Customer users cannot log in via the platform admin login route.
     */
    public function test_customer_users_cannot_login_to_platform_admin(): void
    {
        $customer = $this->createCustomer('regular_customer@example.com');

        $response = $this->postJson('/api/platform-admin/auth/login', [
            'email' => 'regular_customer@example.com',
            'password' => 'CustomerPass123!',
        ]);

        $response->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    /**
     * 4. Customer API tokens cannot access protected platform admin routes.
     */
    public function test_customer_api_tokens_cannot_access_platform_admin_endpoints(): void
    {
        $customer = $this->createCustomer('blocked_customer@example.com');

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/platform-admin/dashboard/stats');

        $response->assertStatus(401)
            ->assertJson(['success' => false]);
    }

    /**
     * 5. Platform admin tokens cannot access customer API endpoints.
     */
    public function test_platform_admin_tokens_cannot_access_customer_api_endpoints(): void
    {
        $admin = $this->createPlatformAdmin();

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/cards');

        $response->assertStatus(401);
    }

    /**
     * 6. Platform admin can retrieve profile and logout.
     */
    public function test_platform_admin_can_retrieve_me_profile_and_logout(): void
    {
        $admin = $this->createPlatformAdmin('me_admin@example.com');

        $meRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/platform-admin/auth/me');

        $meRes->assertStatus(200)
            ->assertJsonPath('admin.email', 'me_admin@example.com');

        $logoutRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson('/api/platform-admin/auth/logout');

        $logoutRes->assertStatus(200)
            ->assertJson(['success' => true]);

        // Token must now be deleted
        $this->assertDatabaseMissing('platform_admin_tokens', ['id' => $admin['token_model']->id]);
    }

    /**
     * 7. Dashboard returns real database metrics without dummy values.
     */
    public function test_platform_admin_dashboard_returns_real_database_metrics(): void
    {
        $admin = $this->createPlatformAdmin();
        $initialWorkspaces = Workspace::count();

        $this->createCustomer('active1@example.com', 'active');
        $this->createCustomer('active2@example.com', 'active');
        $this->createCustomer('suspended1@example.com', 'suspended');

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/platform-admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('metrics.customers.total', 3)
            ->assertJsonPath('metrics.customers.active', 2)
            ->assertJsonPath('metrics.customers.suspended', 1)
            ->assertJsonPath('metrics.workspaces.total', $initialWorkspaces + 3);
    }

    /**
     * 8. Platform admin can list and search customers.
     */
    public function test_platform_admin_can_list_and_search_customers(): void
    {
        $admin = $this->createPlatformAdmin();
        $this->createCustomer('alice@corp.com');
        $this->createCustomer('bob@enterprise.com');

        // Search for alice
        $searchRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/platform-admin/customers?search=alice');

        $searchRes->assertStatus(200);
        $this->assertCount(1, $searchRes->json('customers'));
        $this->assertEquals('alice@corp.com', $searchRes->json('customers.0.email'));

        // Filter by active
        $filterRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/platform-admin/customers?status=active');

        $filterRes->assertStatus(200);
        $this->assertCount(2, $filterRes->json('customers'));
    }

    /**
     * 9. Platform admin can view customer details with workspaces.
     */
    public function test_platform_admin_can_view_customer_details(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer('charlie@corp.com');

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson("/api/platform-admin/customers/{$customer['user']->id}");

        $response->assertStatus(200)
            ->assertJsonPath('customer.email', 'charlie@corp.com')
            ->assertJsonPath('customer.workspaces.0.id', $customer['workspace']->id);
    }

    /**
     * 10. Platform admin can suspend customer and audit log is recorded.
     */
    public function test_platform_admin_can_suspend_customer_and_audit_log_is_recorded(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer('suspend_me@corp.com');

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson("/api/platform-admin/customers/{$customer['user']->id}/suspend", [
                'reason' => 'Violation of terms of service',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('customer.status', 'suspended');

        $customer['user']->refresh();
        $this->assertEquals('suspended', $customer['user']->status);
        $this->assertEquals('Violation of terms of service', $customer['user']->suspension_reason);

        // Audit log created
        $this->assertDatabaseHas('platform_audit_logs', [
            'platform_admin_id' => $admin['admin']->id,
            'action' => 'customer.suspend',
            'target_id' => $customer['user']->id,
        ]);
    }

    /**
     * 11. Suspended customer is denied protected operations (cards, scanning, bulk imports, workspaces).
     */
    public function test_suspended_customer_is_denied_protected_operations_with_403(): void
    {
        $customer = $this->createCustomer('denied@example.com', 'suspended');
        $customer['user']->update(['suspension_reason' => 'Payment overdue']);

        // 1. Cards access is denied
        $resCards = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/cards');

        $resCards->assertStatus(403)
            ->assertJson([
                'success' => false,
                'error_code' => 'ACCOUNT_SUSPENDED',
                'status' => 'suspended',
            ]);

        // 2. Scan is denied
        $resScan = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->postJson('/api/scan', []);

        $resScan->assertStatus(403)
            ->assertJson(['error_code' => 'ACCOUNT_SUSPENDED']);

        // 3. Bulk imports is denied
        $resBulk = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/bulk-imports');

        $resBulk->assertStatus(403)
            ->assertJson(['error_code' => 'ACCOUNT_SUSPENDED']);

        // 4. Workspace members is denied
        $resWs = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson("/api/workspaces/{$customer['workspace']->id}/members");

        $resWs->assertStatus(403)
            ->assertJson(['error_code' => 'ACCOUNT_SUSPENDED']);
    }

    /**
     * 12. Suspended customer can still retrieve account recovery info and logout.
     */
    public function test_suspended_customer_can_retrieve_recovery_info_and_logout(): void
    {
        $customer = $this->createCustomer('recovery@example.com', 'suspended');
        $customer['user']->update(['suspension_reason' => 'Billing verification required']);

        // Auth user profile allowed so frontend can display suspension reason & recovery details
        $resUser = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/auth/user');

        $resUser->assertStatus(200)
            ->assertJsonPath('user.status', 'suspended')
            ->assertJsonPath('user.suspension_reason', 'Billing verification required');

        // Logout is allowed
        $resLogout = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->postJson('/api/auth/logout');

        $resLogout->assertStatus(200);
    }

    /**
     * 13. Platform admin can reactivate customer and customer can immediately resume operations.
     */
    public function test_platform_admin_can_activate_suspended_customer(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer('reactivate@example.com', 'suspended');

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson("/api/platform-admin/customers/{$customer['user']->id}/activate");

        $response->assertStatus(200)
            ->assertJsonPath('customer.status', 'active');

        $customer['user']->refresh();
        $this->assertEquals('active', $customer['user']->status);
        $this->assertNull($customer['user']->suspended_at);

        // Customer can now access cards
        $resCards = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/cards');

        $resCards->assertStatus(200);
    }

    /**
     * 14. Platform admin can manage and suspend workspaces.
     */
    public function test_platform_admin_can_suspend_and_activate_workspaces(): void
    {
        $admin = $this->createPlatformAdmin();
        $customer = $this->createCustomer('ws_owner@example.com');

        $suspendRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson("/api/platform-admin/workspaces/{$customer['workspace']->id}/suspend", [
                'reason' => 'Company investigation',
            ]);

        $suspendRes->assertStatus(200);
        $customer['workspace']->refresh();
        $this->assertEquals('suspended', $customer['workspace']->status);

        // Customer operations in this workspace are blocked
        $resCards = $this->withHeaders(['Authorization' => 'Bearer '.$customer['token']])
            ->getJson('/api/cards');

        $resCards->assertStatus(403)
            ->assertJson(['error_code' => 'WORKSPACE_SUSPENDED']);

        // Reactivate workspace
        $actRes = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->postJson("/api/platform-admin/workspaces/{$customer['workspace']->id}/activate");

        $actRes->assertStatus(200);
        $customer['workspace']->refresh();
        $this->assertEquals('active', $customer['workspace']->status);
    }

    /**
     * 15. Audit logs can be retrieved and filtered by platform admin.
     */
    public function test_platform_audit_logs_can_be_retrieved(): void
    {
        $admin = $this->createPlatformAdmin();
        PlatformAuditLog::record($admin['admin'], 'test.manual_event', null, ['foo' => 'bar']);

        $response = $this->withHeaders(['Authorization' => 'Bearer '.$admin['token']])
            ->getJson('/api/platform-admin/audit-logs');

        $response->assertStatus(200)
            ->assertJsonStructure(['logs', 'pagination']);

        $this->assertTrue(collect($response->json('logs'))->contains('action', 'test.manual_event'));
    }
}
