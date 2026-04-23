<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller
{
    public  function login(LoginRequest $request)
    {
        $data = $request->validated();
        if (Auth::attempt($data)) {
            $user = Auth::user();
            $token = $user->createToken('main')->plainTextToken;
            return response()->json(['token' => $token, 'user' => $user]);
        }
        return response()->json(['error' => 'Неверный логин или пароль'], 401);
    }

    public function logout(Request $request)
    {
        if(Auth::check()){
            auth()->user()->currentAccessToken()->delete();
            return response()->json(['message' => 'Вы вышли из системы']);
        }
        return response()->json(['message' => 'Вы не авторизованы'],401);

    }

}
