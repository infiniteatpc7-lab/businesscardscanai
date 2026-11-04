<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BulkImportController;
use App\Http\Controllers\CardController;
use App\Http\Controllers\CustomerSubscriptionController;
use App\Http\Controllers\ExhibitionController;
use App\Http\Controllers\PlatformAdmin\AdminAuditLogController;
use App\Http\Controllers\PlatformAdmin\AdminAuthController;
use App\Http\Controllers\PlatformAdmin\AdminCustomerController;
use App\Http\Controllers\PlatformAdmin\AdminDashboardController;
use App\Http\Controllers\PlatformAdmin\AdminPaymentTransactionController;
use App\Http\Controllers\PlatformAdmin\AdminPlanController;
use App\Http\Controllers\PlatformAdmin\AdminWorkspaceController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

// Authentication routes (Public with rate limiting to prevent brute-force and resource abuse)
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

    // Authenticated Auth Actions
    Route::middleware('api.auth')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/switch-workspace', [AuthController::class, 'switchWorkspace']);
        Route::put('/workspaces/{id}', [AuthController::class, 'updateWorkspace']);
    });
});

// Workspace Management & Invitations
Route::middleware('api.auth')->group(function () {
    Route::get('/workspaces', [WorkspaceController::class, 'index']);
    Route::post('/workspaces', [WorkspaceController::class, 'store']);
    Route::get('/workspaces/{id}/members', [WorkspaceController::class, 'members']);
    Route::post('/workspaces/{id}/invitations', [WorkspaceController::class, 'invite']);
    Route::post('/workspaces/{id}/invitations/{invitationId}/resend', [WorkspaceController::class, 'resendInvitation']);
    Route::delete('/workspaces/{id}/invitations/{invitationId}', [WorkspaceController::class, 'revokeInvitation']);
    Route::patch('/workspaces/{id}/members/{userId}', [WorkspaceController::class, 'updateMemberRole']);
    Route::delete('/workspaces/{id}/members/{userId}', [WorkspaceController::class, 'removeMember']);
    Route::post('/invitations/{token}/accept', [WorkspaceController::class, 'acceptInvitation']);
});

// Workspace Exhibitions & Current Selection
Route::middleware('api.auth')->group(function () {
    Route::get('/exhibitions', [ExhibitionController::class, 'index']);
    Route::post('/exhibitions', [ExhibitionController::class, 'store']);
    Route::get('/exhibitions/current', [ExhibitionController::class, 'current']);
    Route::post('/exhibitions/current', [ExhibitionController::class, 'select']);
    Route::get('/exhibitions/{id}', [ExhibitionController::class, 'show']);
    Route::put('/exhibitions/{id}', [ExhibitionController::class, 'update']);
    Route::delete('/exhibitions/{id}', [ExhibitionController::class, 'destroy']);
});

// Protected Business Card & AI Scanning Routes
Route::middleware('api.auth')->group(function () {
    Route::post('/scan', [CardController::class, 'scan'])->middleware('throttle:20,1');
    Route::post('/scan/release', [CardController::class, 'releaseScanReservation']);
    Route::post('/cards/upload-image', [CardController::class, 'uploadImage'])->middleware('throttle:30,1');
    Route::get('/cards', [CardController::class, 'index']);
    Route::get('/cards/export', [CardController::class, 'export']);
    Route::post('/cards', [CardController::class, 'store']);
    Route::get('/cards/{id}', [CardController::class, 'show']);
    Route::put('/cards/{id}', [CardController::class, 'update']);
    Route::delete('/cards/{id}', [CardController::class, 'destroy']);
    Route::get('/cards/{id}/image', [CardController::class, 'image']);
});

// Bulk Multiple Photo Import Routes
Route::middleware('api.auth')->group(function () {
    Route::get('/bulk-imports', [BulkImportController::class, 'index']);
    Route::post('/bulk-imports', [BulkImportController::class, 'store']);
    Route::get('/bulk-imports/{uuid}', [BulkImportController::class, 'show']);
    Route::post('/bulk-imports/{uuid}/items', [BulkImportController::class, 'uploadItem'])->middleware('throttle:120,1');
    Route::post('/bulk-imports/{uuid}/items/{itemId}/back-image', [BulkImportController::class, 'uploadItemBackImage'])->middleware('throttle:60,1');
    Route::post('/bulk-imports/{uuid}/process', [BulkImportController::class, 'process']);
    Route::post('/bulk-imports/{uuid}/process-next', [BulkImportController::class, 'processNext']);
    Route::get('/bulk-imports/{uuid}/progress', [BulkImportController::class, 'progress']);
    Route::get('/bulk-imports/{uuid}/items', [BulkImportController::class, 'items']);
    Route::get('/bulk-imports/{uuid}/items/{itemId}/image', [BulkImportController::class, 'image']);
    Route::put('/bulk-imports/{uuid}/items/{itemId}', [BulkImportController::class, 'updateItem']);
    Route::post('/bulk-imports/{uuid}/items/{itemId}/retry', [BulkImportController::class, 'retryItem']);
    Route::post('/bulk-imports/{uuid}/commit', [BulkImportController::class, 'commit']);
    Route::post('/bulk-imports/{uuid}/cancel', [BulkImportController::class, 'cancel']);

    // Customer Subscription, Quota & Billing Management
    Route::get('/subscription/current', [CustomerSubscriptionController::class, 'current']);
    Route::get('/subscription/usage-ledger', [CustomerSubscriptionController::class, 'usageLedger']);
    Route::get('/subscription/history', [CustomerSubscriptionController::class, 'history']);
    Route::get('/subscription/payments', [CustomerSubscriptionController::class, 'payments']);
    Route::get('/subscription/plans', [CustomerSubscriptionController::class, 'plans']);
    Route::post('/subscription/request-upgrade', [CustomerSubscriptionController::class, 'requestUpgrade']);
});

// ==========================================
// Platform Admin Routes (Strictly Isolated)
// ==========================================
Route::prefix('platform-admin')->group(function () {
    // Public Admin Auth (Rate limited)
    Route::post('/auth/login', [AdminAuthController::class, 'login'])->middleware('throttle:10,1');

    // Authenticated Admin Routes (Exclusive Platform Admin Token Guard)
    Route::middleware('platform.admin.auth')->group(function () {
        Route::get('/auth/me', [AdminAuthController::class, 'me']);
        Route::post('/auth/logout', [AdminAuthController::class, 'logout']);

        // Dashboard Metrics
        Route::get('/dashboard/stats', [AdminDashboardController::class, 'stats']);

        // Customer Management
        Route::get('/customers', [AdminCustomerController::class, 'index']);
        Route::get('/customers/{id}', [AdminCustomerController::class, 'show']);
        Route::post('/customers/{id}/suspend', [AdminCustomerController::class, 'suspend']);
        Route::post('/customers/{id}/activate', [AdminCustomerController::class, 'activate']);

        // Workspace Management
        Route::get('/workspaces', [AdminWorkspaceController::class, 'index']);
        Route::get('/workspaces/{id}', [AdminWorkspaceController::class, 'show']);
        Route::get('/workspaces/{id}/subscription', [AdminWorkspaceController::class, 'subscription']);
        Route::get('/workspaces/{id}/subscription-history', [AdminWorkspaceController::class, 'subscriptionHistory']);
        Route::post('/workspaces/{id}/change-plan', [AdminWorkspaceController::class, 'changePlan']);
        Route::post('/workspaces/{id}/suspend', [AdminWorkspaceController::class, 'suspend']);
        Route::post('/workspaces/{id}/activate', [AdminWorkspaceController::class, 'activate']);

        // SaaS Plans Management
        Route::get('/plans', [AdminPlanController::class, 'index']);
        Route::get('/plans/features', [AdminPlanController::class, 'features']);
        Route::post('/plans', [AdminPlanController::class, 'store']);
        Route::put('/plans/{id}', [AdminPlanController::class, 'update']);
        Route::post('/plans/{id}/toggle-status', [AdminPlanController::class, 'toggleStatus']);

        // Payment Transactions History
        Route::get('/payment-transactions', [AdminPaymentTransactionController::class, 'index']);

        // Audit Logs
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
    });
});
