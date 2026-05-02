<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomMessage;
use App\Models\RoomParticipant;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class RoomController extends Controller
{
    private function findRoomOrFail(string $uuid): Room
    {
        $room = Room::where('uuid', $uuid)->first();
        if (!$room) {
            abort(404, 'Room not found');
        }
        return $room;
    }

    /**
     * Имя для отображения: только имя файла, без пути, без управляющих символов.
     */
    private function attachmentDisplayName(UploadedFile $file): string
    {
        $raw = (string) $file->getClientOriginalName();
        $base = basename(str_replace('\\', '/', $raw));
        $base = preg_replace('/[\x00-\x1F\x7F]/u', '', $base) ?? '';
        $base = trim($base);
        if ($base === '') {
            $ext = $file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin';

            return 'file.'.strtolower($ext);
        }

        return Str::limit($base, 180, '');
    }

    public function ownerRooms(Request $request)
    {
        $user = $request->user();
        $ownedRooms = Room::where('owner_id', $user->id)->get();
        $ownedRooms = $ownedRooms->sortByDesc('created_at');

        if ($ownedRooms->isEmpty()) {
            return response()->json([], 200);
        }

        return response()->json($ownedRooms);
    }

    public function create(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
        ]);

        $user = $request->user();
        $room_uuid = Str::uuid()->toString();

        $room = Room::create([
            'owner_id' => $user->id,
            'uuid' => $room_uuid,
            'title' => $validated['title'],
        ]);
        RoomParticipant::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'role' => 'owner',
            'joined_at' => now(),
        ]);

        return response()->json(['message' => 'Room created successfully', 'room' => $room], 201);
    }

    public function join(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);
        $user = $request->user();

        if ($room->status === 'closed') {
            return response()->json(['message' => 'Room is closed'], 403);
        }

        $participant = RoomParticipant::where('room_id', $room->id)->where('user_id', $user->id)->whereNull('left_at')->first();
        if ($participant) {
            return response()->json($participant, 200);
        }

        $participant = RoomParticipant::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'role' => $room->owner_id === $user->id ? 'owner' : 'member',
            'joined_at' => now(),
        ]);

        return response()->json($participant, 200);
    }

    public function leave(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);
        $user = $request->user();

        $participant = RoomParticipant::where('room_id', $room->id)->where('user_id', $user->id)->whereNull('left_at')->first();
        if (!$participant) {
            return response()->json(['message' => 'Participant not found'], 404);
        }
        $participant->update(['left_at' => now()]);
        return response()->json(['message' => 'Participant left successfully'], 200);
    }

    public function close(Request $request, string $uuid)
    {
        $user = $request->user();
        $room = $this->findRoomOrFail($uuid);

        if ($room->owner_id !== $user->id) {
            return response()->json(['message' => 'You are not the owner of this room'], 403);
        }
        $room->update(['status' => 'closed', 'closed_at' => now()]);

        $participants = RoomParticipant::where('room_id', $room->id)->whereNull('left_at')->get();
        foreach ($participants as $participant) {
            $participant->update(['left_at' => now()]);
        }

        return response()->json(['message' => 'Room closed successfully'], 200);
    }

    public function show(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);

        return response()->json($room);
    }

    public function participants(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);
        $participants = RoomParticipant::where('room_id', $room->id)->whereNull('left_at')->get();

        return response()->json($participants);
    }

    public function listMessages(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);

        $messages = RoomMessage::where('room_id', $room->id)
            ->orderBy('created_at', 'asc')
            ->limit(200)
            ->get();

        return response()->json($messages);
    }

    public function storeMessage(Request $request, string $uuid)
    {
        $room = $this->findRoomOrFail($uuid);
        $user = $request->user();
        $validated = $request->validate([
            'message' => ['nullable', 'string', 'max:2000'],
            'display_name' => ['nullable', 'string', 'max:255'],
            'file' => ['nullable', 'file', 'max:10240'], // up to 10MB
        ]);

        $messageText = trim((string) ($validated['message'] ?? ''));
        $hasFile = $request->hasFile('file');
        if ($messageText === '' && !$hasFile) {
            return response()->json(['message' => 'Message or file is required'], 422);
        }

        $activeParticipant = RoomParticipant::where('room_id', $room->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->first();
        if (!$activeParticipant) {
            return response()->json(['message' => 'Join room before sending messages'], 403);
        }

        $attachment = [
            'attachment_name' => null,
            'attachment_url' => null,
            'attachment_mime' => null,
            'attachment_size' => null,
        ];

        if ($hasFile) {
            $file = $request->file('file');
            $path = $file->store('room_uploads/' . $room->uuid, 'public');
            $mime = $file->getMimeType() ?: $file->getClientMimeType();
            $attachment = [
                'attachment_name' => $this->attachmentDisplayName($file),
                'attachment_url' => asset('storage/'.$path),
                'attachment_mime' => $mime,
                'attachment_size' => $file->getSize(),
            ];
        }

        $message = RoomMessage::create([
            'room_id' => $room->id,
            'user_id' => $user->id,
            'display_name' => $validated['display_name'] ?? ($user->name ?: $user->login),
            'message' => $messageText,
            ...$attachment,
        ]);

        return response()->json($message, 201);
    }

}
