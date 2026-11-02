<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CardController;
use Illuminate\Support\Facades\Route;

// Authentication routes (Public)
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/bootstrap', [AuthController::class, 'bootstrap']);

    // Authenticated Auth Actions
    Route::middleware('api.auth')->group(function () {
        Route::get('/user', [AuthController::class, 'user']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/switch-workspace', [AuthController::class, 'switchWorkspace']);
    });
});

// Protected Business Card & AI Scanning Routes
Route::middleware('api.auth')->group(function () {
    Route::post('/scan', [CardController::class, 'scan']);
    Route::get('/cards', [CardController::class, 'index']);
    Route::post('/cards', [CardController::class, 'store']);
    Route::get('/cards/{id}', [CardController::class, 'show']);
    Route::delete('/cards/{id}', [CardController::class, 'destroy']);
    Route::get('/cards/{id}/image', [CardController::class, 'image']);
});
