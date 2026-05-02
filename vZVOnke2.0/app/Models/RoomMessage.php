<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoomMessage extends Model
{
    protected $fillable = [
        'room_id',
        'user_id',
        'display_name',
        'message',
        'attachment_name',
        'attachment_url',
        'attachment_mime',
        'attachment_size',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
