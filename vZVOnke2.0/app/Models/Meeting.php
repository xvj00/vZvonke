<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Meeting extends Model
{
    use HasUuids;
// 1. Указываем, что первичный ключ - это 'id' (он и так по умолчанию id, но для ясности оставим)
    protected $primaryKey = 'uuid';

    // 2. САМОЕ ВАЖНОЕ: Отключаем авто-инкремент (цифры больше не растут сами)
    public $incrementing = false;

    // 3. Указываем, что тип ключа - строка, а не число
    protected $keyType = 'string';
    protected $guarded = [];
}
