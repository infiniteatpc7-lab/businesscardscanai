<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CardController;
use App\Http\Controllers\ExhibitionController;
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
    Route::post('/cards/upload-image', [CardController::class, 'uploadImage'])->middleware('throttle:30,1');
    Route::get('/cards', [CardController::class, 'index']);
    Route::post('/cards', [CardController::class, 'store']);
    Route::get('/cards/{id}', [CardController::class, 'show']);
    Route::put('/cards/{id}', [CardController::class, 'update']);
    Route::delete('/cards/{id}', [CardController::class, 'destroy']);
    Route::get('/cards/{id}/image', [CardController::class, 'image']);
});
