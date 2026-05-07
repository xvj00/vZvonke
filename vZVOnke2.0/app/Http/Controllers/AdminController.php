<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomParticipant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function overview(): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'users_count' => User::count(),
            'rooms_count' => Room::count(),
            'active_rooms_count' => Room::where('status', 'active')->count(),
            'active_participants_count' => RoomParticipant::whereNull('left_at')->count(),
            'latest_users' => User::query()
                ->select(['id', 'login', 'name', 'email', 'role', 'created_at'])
                ->latest()
                ->limit(5)
                ->get(),
            'latest_rooms' => $this->roomQuery()
                ->latest()
                ->limit(5)
                ->get(),
        ]);
    }

    public function users(Request $request): \Illuminate\Http\JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->select(['id', 'login', 'name', 'email', 'role', 'created_at', 'updated_at'])
            ->withCount([
                'ownedRooms',
                'roomParticipations',
            ])
            ->when($search !== '', function (Builder $query) use ($search): void {
                $query->where(function (Builder $query) use ($search): void {
                    $query
                        ->where('login', 'like', "%{$search}%")
                        ->orWhere('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->paginate($this->perPage($request));

        return response()->json($users);
    }

    public function rooms(Request $request): \Illuminate\Http\JsonResponse
    {
        $status = $request->query('status');

        $rooms = $this->roomQuery()
            ->when(in_array($status, ['active', 'closed'], true), function (Builder $query) use ($status): void {
                $query->where('status', $status);
            })
            ->latest()
            ->paginate($this->perPage($request));

        return response()->json($rooms);
    }

    public function activeRooms(Request $request): \Illuminate\Http\JsonResponse
    {
        $rooms = $this->roomQuery()
            ->where('status', 'active')
            ->latest()
            ->paginate($this->perPage($request));

        return response()->json($rooms);
    }

    private function roomQuery(): Builder
    {
        return Room::query()
            ->select(['id', 'uuid', 'title', 'owner_id', 'status', 'created_at', 'updated_at', 'closed_at'])
            ->with([
                'owner:id,login,name,email,role',
            ])
            ->withCount([
                'participants',
                'messages',
                'participants as active_participants_count' => fn (Builder $query) => $query->whereNull('left_at'),
            ]);
    }

    private function perPage(Request $request): int
    {
        return min(max((int) $request->query('per_page', 20), 1), 100);
    }
}
