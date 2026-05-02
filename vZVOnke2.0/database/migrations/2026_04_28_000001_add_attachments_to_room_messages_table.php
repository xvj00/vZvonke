<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('room_messages', function (Blueprint $table) {
            $table->string('attachment_name')->nullable()->after('message');
            $table->string('attachment_url')->nullable()->after('attachment_name');
            $table->string('attachment_mime')->nullable()->after('attachment_url');
            $table->unsignedBigInteger('attachment_size')->nullable()->after('attachment_mime');
        });
    }

    public function down(): void
    {
        Schema::table('room_messages', function (Blueprint $table) {
            $table->dropColumn(['attachment_name', 'attachment_url', 'attachment_mime', 'attachment_size']);
        });
    }
};

