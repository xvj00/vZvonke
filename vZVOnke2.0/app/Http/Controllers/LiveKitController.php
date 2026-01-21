<?php

namespace App\Http\Controllers;

use Agence104\LiveKit\AccessToken;
use Agence104\LiveKit\AccessTokenOptions;
use Agence104\LiveKit\VideoGrant;
use Illuminate\Http\Request;

class LiveKitController extends Controller
{
    public function generateToken(Request $request)
    {
        $data = $request->validate([
            'room_name' => 'required|string',
            'user_name' => 'required|string',
        ]);
//        берем данные из формы


        $apiKey = env('LIVEKIT_API_KEY');
        $apiSecret = env('LIVEKIT_API_SECRET');


//        создаем настройки токена где идентифицируем пользователя
        $tokenOptions = new AccessTokenOptions();
        $tokenOptions->setIdentity($data['user_name']);

//        создаем сам токен
        $token = new AccessToken($apiKey,$apiSecret, $tokenOptions);

//        создаем доступ к комнате с именем из формы
        $grant = new VideoGrant();
        $grant->setRoomJoin(true);
        $grant->setRoomName($data['room_name']);
//        добавляем доступ к комнате к токену
        $token->setGrant($grant);
//        создаем jwt токен для передачи в livekit
        $jwt = $token->toJwt();
//      возвращаю токен в виде json
        return response()->json(['token' => $jwt]);




    }
}
