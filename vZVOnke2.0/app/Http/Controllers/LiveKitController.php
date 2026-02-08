<?php

namespace App\Http\Controllers;

use Agence104\LiveKit\AccessToken;
use Agence104\LiveKit\AccessTokenOptions;
use Agence104\LiveKit\VideoGrant;
use App\Models\Meeting;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LiveKitController extends Controller
{
    public function generateToken(Request $request)
    {
        $data = $request->validate([
            'room_name' => 'required_without:room_uuid|string',
            'room_uuid'  => 'nullable|uuid|exists:meetings,uuid',
            'user_name' => 'required|string',
        ]);

        if (!empty($data['room_uuid'])) {
            $meet = Meeting::findOrFail($data['room_uuid']);
        } else {
            $meet = Meeting::create([
                'uuid'    => (string) Str::uuid(),
                'title'   => $data['room_name'],
                'user_id' => auth()->check() ? auth()->id() : null,
            ]);
        }

        $apiKey = env('LIVEKIT_API_KEY');
        $apiSecret = env('LIVEKIT_API_SECRET');

        $tokenOptions = new AccessTokenOptions();
        $tokenOptions->setIdentity(auth()->user() ? auth()->user()->name : $data['user_name']);

        $token = new AccessToken($apiKey, $apiSecret, $tokenOptions);

        $grant = new VideoGrant();
        $grant->setRoomJoin(true);
        $grant->setRoomName($meet->uuid);
        $token->setGrant($grant);

        $jwt = $token->toJwt();
        return response()->json(['token' => $jwt, 'room_uuid' => $meet->uuid]);
    }
}
