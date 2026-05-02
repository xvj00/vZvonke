<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyMediasoupInternalSecret
{
    /**
     * Проверка заголовка X-Mediasoup-Secret (только если MEDIASOUP_INTERNAL_SECRET задан в .env).
     */
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('mediasoup.internal_secret');

        if ($secret === null || $secret === '') {
            return $next($request);
        }

        $sent = $request->header('X-Mediasoup-Secret');
        if (! is_string($sent) || ! hash_equals($secret, $sent)) {
            abort(Response::HTTP_FORBIDDEN, 'Invalid mediasoup secret');
        }

        return $next($request);
    }
}
