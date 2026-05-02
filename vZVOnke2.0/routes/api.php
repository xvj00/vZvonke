<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RoomController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;



Route::middleware('throttle:auth-strict')->group(function () {
    Route::post('/register', [RegisterController::class, 'register'])->name('register');
    Route::post('/login', [LoginController::class, 'login'])->name('login');
});

Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware(['auth:sanctum', 'throttle:api-rooms'])
    ->name('logout');

Route::middleware(['auth:sanctum', 'throttle:api-rooms'])->group(function () {
    Route::get('/profile', [ProfileController::class, 'index']);
    Route::post('/profile', [ProfileController::class, 'update']);
    Route::get('/owner-rooms', [RoomController::class, 'ownerRooms'])->name('owner-rooms');
    Route::post('/create-room', [RoomController::class, 'create'])->name('create-room');

    Route::post('/rooms/{uuid}/join', [RoomController::class, 'join'])
        ->middleware('mediasoup.secret')
        ->name('room-join');
    Route::post('/rooms/{uuid}/leave', [RoomController::class, 'leave'])
        ->middleware('mediasoup.secret')
        ->name('room-leave');
    Route::post('/rooms/{uuid}/close', [RoomController::class, 'close'])
        ->middleware('mediasoup.secret')
        ->name('room-close');

    Route::get('/rooms/{uuid}', [RoomController::class, 'show'])->name('room-show');
    Route::get('/rooms/{uuid}/participants', [RoomController::class, 'participants'])->name('room-participants');
    Route::get('/rooms/{uuid}/messages', [RoomController::class, 'listMessages'])->name('room-messages');
    Route::post('/rooms/{uuid}/messages', [RoomController::class, 'storeMessage'])->name('room-messages-store');
});
