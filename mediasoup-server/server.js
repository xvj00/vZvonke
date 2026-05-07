import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import os from "node:os";
import { Server as SocketIOServer } from "socket.io";
import mediasoup from "mediasoup";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

const startedAt = Date.now();

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const rooms = new Map();
const laravelApiUrl = process.env.LARAVEL_API_URL || "http://127.0.0.1:8000/api";
/** В проде держите true: без Bearer join к Laravel не уходит. */
const requireRoomAuth = String(process.env.REQUIRE_ROOM_AUTH ?? "true") === "true";
const mediasoupInternalSecret = (process.env.MEDIASOUP_INTERNAL_SECRET || "").trim();

function laravelFetchHeaders(accessToken, extraHeaders = {}) {
  const headers = {
    Accept: "application/json",
    ...extraHeaders,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (mediasoupInternalSecret) {
    headers["X-Mediasoup-Secret"] = mediasoupInternalSecret;
  }
  return headers;
}
/** Мс: после ухода последнего участника mediasoup-router и запись комнаты удаляются из памяти. */
const _grace = Number(process.env.EMPTY_ROOM_GRACE_MS);
const EMPTY_ROOM_GRACE_MS = Number.isFinite(_grace) && _grace >= 0 ? _grace : 30000;

/** Максимум участников (peer-сессий) в одной mediasoup-комнате. */
const MAX_PEERS_PER_ROOM = Math.min(500, Math.max(1, parsePositiveInt(process.env.MAX_PEERS_PER_ROOM, 20)));

/**
 * Стартовая оценка исходящего битрейта транспорта (бит/с). Для видеозвонков VP8 обычно 500k–2M.
 * 64000 (64 кбит/с) — только как крайний случай (почти только аудио / очень слабый канал).
 */
const MEDIASOUP_INITIAL_OUTGOING_BITRATE = parsePositiveInt(
  process.env.MEDIASOUP_INITIAL_OUTGOING_BITRATE,
  1_000_000
);

const MEDIASOUP_MAX_INCOMING_BITRATE_RAW = process.env.MEDIASOUP_MAX_INCOMING_BITRATE;
const MEDIASOUP_MAX_INCOMING_BITRATE_ENABLED =
  MEDIASOUP_MAX_INCOMING_BITRATE_RAW !== undefined && MEDIASOUP_MAX_INCOMING_BITRATE_RAW !== "";
const MEDIASOUP_MAX_INCOMING_BITRATE_VALUE = MEDIASOUP_MAX_INCOMING_BITRATE_ENABLED
  ? parsePositiveInt(MEDIASOUP_MAX_INCOMING_BITRATE_RAW, MEDIASOUP_INITIAL_OUTGOING_BITRATE)
  : 0;

const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {},
  },
];

const workers = [];
let workerPickSeq = 0;

/** Простой мониторинг: GET /metrics (опционально Authorization: Bearer + METRICS_TOKEN). */
app.get("/metrics", (req, res) => {
  const secret = process.env.METRICS_TOKEN;
  if (secret) {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : "";
    if (bearer !== secret) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  let peersTotal = 0;
  for (const room of rooms.values()) {
    peersTotal += room.peers.size;
  }

  res.json({
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    pid: process.pid,
    workers: workers.length,
    rooms: rooms.size,
    peers: peersTotal,
    maxPeersPerRoom: MAX_PEERS_PER_ROOM,
    initialOutgoingBitrateBps: MEDIASOUP_INITIAL_OUTGOING_BITRATE,
    maxIncomingBitrateBps: MEDIASOUP_MAX_INCOMING_BITRATE_ENABLED ? MEDIASOUP_MAX_INCOMING_BITRATE_VALUE : null,
    memory: process.memoryUsage(),
    cpuLoadAvg: os.loadavg(),
  });
});

async function createWorker() {
  const nextWorker = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.RTC_MIN_PORT || 40000),
    rtcMaxPort: Number(process.env.RTC_MAX_PORT || 49999),
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
  });

  nextWorker.on("died", () => {
    console.error("mediasoup worker died, exiting in 2 seconds...");
    setTimeout(() => process.exit(1), 2000);
  });

  return nextWorker;
}

function pickWorker() {
  if (workers.length === 0) {
    throw new Error("No mediasoup workers available");
  }
  const idx = workerPickSeq % workers.length;
  workerPickSeq += 1;
  return workers[idx];
}

async function getOrCreateRoom(roomId) {
  if (rooms.has(roomId)) return rooms.get(roomId);

  const nextWorker = pickWorker();
  const router = await nextWorker.createRouter({ mediaCodecs });
  const room = {
    router,
    peers: new Map(),
    producers: new Map(),
    ownerPeerId: null,
    ownerParticipantId: null,
    emptyRoomTimer: null,
  };
  rooms.set(roomId, room);
  return room;
}

function cancelEmptyRoomDeletion(room) {
  if (!room?.emptyRoomTimer) return;
  clearTimeout(room.emptyRoomTimer);
  room.emptyRoomTimer = null;
}

function scheduleEmptyRoomDeletion(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.peers.size > 0) return;

  cancelEmptyRoomDeletion(room);

  room.emptyRoomTimer = setTimeout(() => {
    room.emptyRoomTimer = null;
    void destroyRoom(roomId);
  }, EMPTY_ROOM_GRACE_MS);
}

async function destroyRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.peers.size > 0) return;

  cancelEmptyRoomDeletion(room);

  try {
    room.router.close();
  } catch (error) {
    console.warn(`router.close(${roomId}):`, error.message);
  }

  rooms.delete(roomId);
  await notifyRoomClosedBecauseEmpty({ roomId });
  console.log(`room destroyed after empty timeout: ${roomId}`);
}

async function validateRoomAccess({ roomId, accessToken }) {
  if (!accessToken) {
    if (requireRoomAuth) {
      throw new Error("Authorization token is required to join this room");
    }
    return null;
  }

  const response = await fetch(`${laravelApiUrl}/rooms/${roomId}/join`, {
    method: "POST",
    headers: laravelFetchHeaders(accessToken),
  });

  if (!response.ok) {
    let message = "Room access denied";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return response.json();
}

async function notifyRoomLeave({ roomId, accessToken }) {
  if (!accessToken) return;

  try {
    await fetch(`${laravelApiUrl}/rooms/${roomId}/leave`, {
      method: "POST",
      headers: laravelFetchHeaders(accessToken),
    });
  } catch (error) {
    console.warn("Failed to sync leave with Laravel:", error.message);
  }
}

async function notifyRoomClosedBecauseEmpty({ roomId }) {
  try {
    const response = await fetch(`${laravelApiUrl}/internal/rooms/${roomId}/close-empty`, {
      method: "POST",
      headers: laravelFetchHeaders(null),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {
        // noop
      }
      console.warn(`Failed to close empty room in Laravel (${roomId}): ${message}`);
    }
  } catch (error) {
    console.warn(`Failed to close empty room in Laravel (${roomId}):`, error.message);
  }
}

async function fetchRoomMessages({ roomId, accessToken }) {
  if (!accessToken) return [];
  const response = await fetch(`${laravelApiUrl}/rooms/${roomId}/messages`, {
    method: "GET",
    headers: laravelFetchHeaders(accessToken),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function saveRoomMessage({ roomId, accessToken, displayName, text }) {
  if (!accessToken) {
    throw new Error("Authorization token is required to send messages");
  }
  const response = await fetch(`${laravelApiUrl}/rooms/${roomId}/messages`, {
    method: "POST",
    headers: laravelFetchHeaders(accessToken, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      display_name: displayName,
      message: text,
    }),
  });

  if (!response.ok) {
    let message = "Unable to save message";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // noop
    }
    throw new Error(message);
  }

  return response.json();
}

io.on("connection", (socket) => {
  console.log(`socket connected: ${socket.id}`);

  socket.on("joinRoom", async ({ roomId, displayName, avatarUrl, accessToken }, cb) => {
    try {
      const participant = await validateRoomAccess({ roomId, accessToken });
      const room = await getOrCreateRoom(roomId);
      if (room.peers.size >= MAX_PEERS_PER_ROOM) {
        throw new Error(`Комната заполнена (не более ${MAX_PEERS_PER_ROOM} участников)`);
      }
      cancelEmptyRoomDeletion(room);
      const isOwner = participant?.role === "owner";
      room.peers.set(socket.id, {
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        displayName: displayName || "Участник",
        avatarUrl: avatarUrl || null,
        cameraEnabled: true,
        handRaised: false,
        accessToken: accessToken || null,
        participantId: participant?.id || null,
        role: participant?.role || null,
      });
      if (isOwner) {
        const hasActiveOwner = room.ownerPeerId && room.peers.has(room.ownerPeerId);
        const sameOwnerRejoined =
          participant?.id &&
          room.ownerParticipantId &&
          participant.id === room.ownerParticipantId;
        if (!hasActiveOwner || sameOwnerRejoined) {
          room.ownerPeerId = socket.id;
          room.ownerParticipantId = participant?.id || room.ownerParticipantId || null;
        }
      }
      socket.join(roomId);

      const producers = [];
      for (const [producerId, entry] of room.producers.entries()) {
        if (entry.peerId === socket.id) continue;
        producers.push({
          producerId,
          peerId: entry.peerId,
          displayName: entry.displayName || "Участник",
          avatarUrl: entry.avatarUrl || null,
          cameraEnabled: entry.cameraEnabled !== false,
          handRaised: entry.handRaised === true,
          kind: entry.producer.kind,
        });
      }

      cb({
        rtpCapabilities: room.router.rtpCapabilities,
        producers,
        isOrganizer: room.ownerPeerId === socket.id,
      });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("broadcastMessage", ({ roomId, message }, cb) => {
    try {
      if (!roomId) throw new Error("Room not found");
      const room = rooms.get(roomId);
      if (!room) throw new Error("Room not found");
      if (!room.peers.has(socket.id)) throw new Error("Peer not found");
      if (!message) throw new Error("Message is required");
      // Do not echo back to sender (client already appended optimistically).
      socket.to(roomId).emit("newMessage", message);
      cb?.({ ok: true });
    } catch (error) {
      cb?.({ error: error.message });
    }
  });

  socket.on("endRoom", async ({ roomId }, cb) => {
    try {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      if (!room || !peer) throw new Error("Room/peer not found");
      if (room.ownerPeerId !== socket.id) throw new Error("Only organizer can end the room");

      // Try to close room in Laravel (optional)
      if (peer.accessToken) {
        try {
          await fetch(`${laravelApiUrl}/rooms/${roomId}/close`, {
            method: "POST",
            headers: laravelFetchHeaders(peer.accessToken),
          });
        } catch {
          // ignore sync errors
        }
      }

      io.to(roomId).emit("roomEnded", { roomId });

      // Disconnect everyone in the room (including organizer)
      const socketsInRoom = await io.in(roomId).fetchSockets();
      for (const s of socketsInRoom) {
        try {
          s.disconnect(true);
        } catch {
          // ignore
        }
      }

      cb({ ok: true });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("createWebRtcTransport", async ({ roomId }, cb) => {
    try {
      const room = rooms.get(roomId);
      if (!room) throw new Error("Room not found");

      const transport = await room.router.createWebRtcTransport({
        listenIps: [
          {
            ip: process.env.MEDIASOUP_LISTEN_IP || "127.0.0.1",
            announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: MEDIASOUP_INITIAL_OUTGOING_BITRATE,
      });

      if (MEDIASOUP_MAX_INCOMING_BITRATE_ENABLED && MEDIASOUP_MAX_INCOMING_BITRATE_VALUE > 0) {
        await transport.setMaxIncomingBitrate(MEDIASOUP_MAX_INCOMING_BITRATE_VALUE);
      }

      room.peers.get(socket.id)?.transports.set(transport.id, transport);

      cb({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("connectTransport", async ({ roomId, transportId, dtlsParameters }, cb) => {
    try {
      const room = rooms.get(roomId);
      const transport = room?.peers.get(socket.id)?.transports.get(transportId);

      if (!transport) throw new Error("Transport not found");

      await transport.connect({ dtlsParameters });
      cb({ connected: true });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("produce", async ({ roomId, transportId, kind, rtpParameters }, cb) => {
    try {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      if (!room || !peer || !transport) throw new Error("Room/peer/transport not found");

      // Client starts sending microphone/camera through this transport.
      const producer = await transport.produce({ kind, rtpParameters });

      peer.producers.set(producer.id, producer);
      room.producers.set(producer.id, {
        producer,
        peerId: socket.id,
        displayName: peer.displayName || "Участник",
        avatarUrl: peer.avatarUrl || null,
        cameraEnabled: peer.cameraEnabled !== false,
      });

      producer.on("transportclose", () => {
        peer.producers.delete(producer.id);
        room.producers.delete(producer.id);
      });

      // Notify everyone else in room that a new media source is available.
      socket.to(roomId).emit("newProducer", {
        producerId: producer.id,
        peerId: socket.id,
        displayName: peer.displayName || "Участник",
        avatarUrl: peer.avatarUrl || null,
        cameraEnabled: peer.cameraEnabled !== false,
        handRaised: peer.handRaised === true,
      });

      cb({ producerId: producer.id });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("getProducers", ({ roomId }, cb) => {
    try {
      const room = rooms.get(roomId);
      if (!room) throw new Error("Room not found");

      const producers = [];
      for (const [producerId, entry] of room.producers.entries()) {
        // Do not ask client to consume its own media.
        if (entry.peerId !== socket.id) {
          producers.push({
            producerId,
            peerId: entry.peerId,
            displayName: entry.displayName || "Участник",
            avatarUrl: entry.avatarUrl || null,
            cameraEnabled: entry.cameraEnabled !== false,
            handRaised: entry.handRaised === true,
            kind: entry.producer.kind,
          });
        }
      }

      cb({ producers });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("consume", async ({ roomId, transportId, producerId, rtpCapabilities }, cb) => {
    try {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      const transport = peer?.transports.get(transportId);
      if (!room || !peer || !transport) throw new Error("Room/peer/transport not found");

      const producerEntry = room.producers.get(producerId);
      if (!producerEntry) throw new Error("Producer not found");

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error("Client cannot consume this producer");
      }

      // Start paused, then client explicitly resumes when media element is ready.
      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      peer.consumers.set(consumer.id, consumer);

      consumer.on("transportclose", () => {
        peer.consumers.delete(consumer.id);
      });

      consumer.on("producerclose", () => {
        peer.consumers.delete(consumer.id);
        socket.emit("producerClosed", { producerId });
      });

      cb({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        peerId: producerEntry.peerId,
        displayName: producerEntry.displayName || "Участник",
        avatarUrl: producerEntry.avatarUrl || null,
        cameraEnabled: producerEntry.cameraEnabled !== false,
        handRaised: producerEntry.handRaised === true,
        producerKind: producerEntry.producer.kind,
      });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("resumeConsumer", async ({ roomId, consumerId }, cb) => {
    try {
      const consumer = rooms.get(roomId)?.peers.get(socket.id)?.consumers.get(consumerId);
      if (!consumer) throw new Error("Consumer not found");

      await consumer.resume();
      cb({ resumed: true });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("getMessages", async ({ roomId }, cb) => {
    try {
      const peer = rooms.get(roomId)?.peers.get(socket.id);
      const messages = await fetchRoomMessages({
        roomId,
        accessToken: peer?.accessToken || null,
      });
      cb({ messages });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("sendMessage", async ({ roomId, text }, cb) => {
    try {
      const messageText = String(text || "").trim();
      if (!messageText) throw new Error("Message cannot be empty");

      const peer = rooms.get(roomId)?.peers.get(socket.id);
      if (!peer) throw new Error("Peer not found");

      const saved = await saveRoomMessage({
        roomId,
        accessToken: peer.accessToken,
        displayName: peer.displayName || "Участник",
        text: messageText,
      });

      io.to(roomId).emit("newMessage", saved);
      cb({ message: saved });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("updateMediaState", ({ roomId, cameraEnabled }, cb) => {
    try {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      if (!room || !peer) throw new Error("Room/peer not found");

      peer.cameraEnabled = cameraEnabled !== false;

      for (const entry of room.producers.values()) {
        if (entry.peerId === socket.id) {
          entry.cameraEnabled = peer.cameraEnabled;
        }
      }

      socket.to(roomId).emit("peerMediaState", {
        peerId: socket.id,
        cameraEnabled: peer.cameraEnabled,
      });
      cb({ ok: true });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("updateHandRaise", ({ roomId, handRaised }, cb) => {
    try {
      const room = rooms.get(roomId);
      const peer = room?.peers.get(socket.id);
      if (!room || !peer) throw new Error("Room/peer not found");

      peer.handRaised = handRaised === true;

      for (const entry of room.producers.values()) {
        if (entry.peerId === socket.id) {
          entry.handRaised = peer.handRaised;
        }
      }

      io.to(roomId).emit("peerHandRaise", {
        peerId: socket.id,
        handRaised: peer.handRaised,
      });
      cb({ ok: true });
    } catch (error) {
      cb({ error: error.message });
    }
  });

  socket.on("disconnect", async () => {
    for (const [roomId, room] of rooms.entries()) {
      const peer = room.peers.get(socket.id);
      if (!peer) continue;

      for (const consumer of peer.consumers.values()) {
        consumer.close();
      }

      for (const producer of peer.producers.values()) {
        room.producers.delete(producer.id);
        producer.close();
      }

      for (const transport of peer.transports.values()) {
        transport.close();
      }

      room.peers.delete(socket.id);
      if (room.ownerPeerId === socket.id) {
        room.ownerPeerId = null;
        const replacementOwner = Array.from(room.peers.entries()).find(([, candidate]) => candidate?.role === "owner");
        if (replacementOwner) {
          room.ownerPeerId = replacementOwner[0];
          room.ownerParticipantId = replacementOwner[1]?.participantId || room.ownerParticipantId || null;
        }
      }
      await notifyRoomLeave({ roomId, accessToken: peer.accessToken });
      scheduleEmptyRoomDeletion(roomId);
    }
    console.log(`socket disconnected: ${socket.id}`);
  });
});

const PORT = Number(process.env.PORT || 4001);

async function start() {
  const cpuCount = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
  const defaultWorkers = Math.max(1, Math.min(8, cpuCount));
  const requested = parsePositiveInt(process.env.MEDIASOUP_NUM_WORKERS, defaultWorkers);
  const workerCount = Math.min(32, Math.max(1, requested));

  for (let i = 0; i < workerCount; i += 1) {
    workers.push(await createWorker());
  }

  console.log(
    `mediasoup: ${workers.length} worker(s), max ${MAX_PEERS_PER_ROOM} peers/room, outbound bitrate ${MEDIASOUP_INITIAL_OUTGOING_BITRATE} bps`
  );

  httpServer.listen(PORT, () => {
    console.log(`mediasoup signaling server is running on http://localhost:${PORT}`);
    console.log(`metrics: http://localhost:${PORT}/metrics`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
