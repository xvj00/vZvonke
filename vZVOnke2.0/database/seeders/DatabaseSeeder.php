<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@vzvonke.ru'],
            [
                'login' => 'admin',
                'name' => 'Администратор',
                'email' => 'admin@vzvonke.ru',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'is_blocked' => false,
            ]
        );

        User::firstOrCreate(
            ['email' => 'user@vzvonke.ru'],
            [
                'login' => 'user',
                'name' => 'Пользователь',
                'email' => 'user@vzvonke.ru',
                'password' => Hash::make('password'),
                'role' => 'user',
                'is_blocked' => false,
            ]
        );
    }
}
