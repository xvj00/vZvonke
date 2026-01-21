<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/get-token', [App\Http\Controllers\LiveKitController::class, 'generateToken']);
