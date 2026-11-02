<?php

use App\Http\Controllers\CardController;
use Illuminate\Support\Facades\Route;

Route::post('/scan', [CardController::class, 'scan']);
Route::get('/cards', [CardController::class, 'index']);
Route::post('/cards', [CardController::class, 'store']);
Route::get('/cards/{id}', [CardController::class, 'show']);
Route::delete('/cards/{id}', [CardController::class, 'destroy']);

