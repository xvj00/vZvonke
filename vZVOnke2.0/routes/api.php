<?php

use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\LiveKitController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;



Route::post('/get-token', [LiveKitController::class, 'generateToken']);
Route::post('/register', [RegisterController::class, 'register'])->name('register');
Route::post('/login', [LoginController::class, 'login'])->name('login');
Route::post('/logout', [LoginController::class, 'logout'])->name('logout');
