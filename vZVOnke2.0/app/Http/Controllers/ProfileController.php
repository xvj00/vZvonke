<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class ProfileController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        return response()->json($user);
    }

    public function update(Request $request)
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255|unique:users,email,' . $user->id,
            'login' => 'sometimes|string|max:255|unique:users,login,' . $user->id,
            'avatar' => 'nullable|image|mimes:jpg,jpeg,png,webp,gif|max:10240',
        ], [
            'avatar.image' => 'Файл аватара должен быть изображением.',
            'avatar.mimes' => 'Аватар должен быть в формате: jpg, jpeg, png, webp, gif.',
            'avatar.max' => 'Размер аватара не должен превышать 10 МБ.',
            'avatar.uploaded' => 'Не удалось загрузить аватар. Попробуйте другой файл.',
        ]);

        if ($request->hasFile('avatar')) {
            if ($user->avatar_path) {
                Storage::disk('public')->delete($user->avatar_path);
            }
            $validated['avatar_path'] = $request->file('avatar')->store('avatars', 'public');
        }

        unset($validated['avatar']);
        $user->update($validated);
        $user->refresh();

        return response()->json($user);
    }
}
