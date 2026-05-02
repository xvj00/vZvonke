FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build
COPY livekit-frontend/package.json livekit-frontend/package-lock.json ./
RUN npm ci

COPY livekit-frontend/ .

ARG VITE_API_URL=/api
ARG VITE_APP_BASE_URL=
ARG VITE_MEDIASOUP_SIGNALING_URL=http://127.0.0.1:4001
ARG VITE_REQUIRE_AUTH_FOR_CALLS=true

ENV VITE_API_URL=$VITE_API_URL \
    VITE_APP_BASE_URL=$VITE_APP_BASE_URL \
    VITE_MEDIASOUP_SIGNALING_URL=$VITE_MEDIASOUP_SIGNALING_URL \
    VITE_REQUIRE_AUTH_FOR_CALLS=$VITE_REQUIRE_AUTH_FOR_CALLS

RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /build/dist /usr/share/nginx/html
