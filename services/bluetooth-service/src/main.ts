import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { KafkaProducer } from '../../../shared/adapters/kafka/KafkaProducer';
import { Logger } from '../../../shared/utils/logger';

dotenv.config();

const app = express();
const server = http.createServer(app);
const logger = new Logger('BluetoothService');
const PORT = process.env.PORT || 3005;

const MAX_RADIUS_M = parseInt(process.env.BT_MAX_RADIUS_M || '200');
const DEFAULT_RADIUS_M = parseInt(process.env.BT_DEFAULT_RADIUS_M || '50');
const PRESENCE_TTL_S = parseInt(process.env.BT_PRESENCE_TTL_S || '45');

// ── Redis ─────────────────────────────────────────────────────────────────────
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const BT_GEO_KEY = 'bt:geo';

// ── Kafka ─────────────────────────────────────────────────────────────────────
const kafkaProducer = new KafkaProducer('bluetooth-service');

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// userId → Set of socketIds
const userSockets = new Map<string, Set<string>>();

function sendToUser(userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data);
}

async function removePresence(userId: string) {
  try {
    await redis.zrem(BT_GEO_KEY, userId);
    await redis.del(`bt:presence:${userId}`);
  } catch {}
}

async function getNearby(userId: string, radiusM: number): Promise<any[]> {
  try {
    const raw = await redis.georadiusbymember(
      BT_GEO_KEY,
      userId,
      radiusM,
      'm',
      'WITHCOORD',
      'WITHDIST',
      'COUNT',
      50,
      'ASC'
    ) as any[];

    const results: any[] = [];
    for (const entry of raw) {
      const memberId = entry[0] as string;
      if (memberId === userId) continue;
      const dist = parseFloat(entry[1] as string);
      const [lng, lat] = entry[2] as [string, string];
      const presenceRaw = await redis.get(`bt:presence:${memberId}`);
      const presence = presenceRaw ? JSON.parse(presenceRaw) : null;
      results.push({
        userId: memberId,
        distanceM: Math.round(dist),
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        displayName: presence?.displayName || memberId.slice(0, 8),
        avatarInitial: (presence?.displayName || memberId).charAt(0).toUpperCase(),
      });
    }
    return results;
  } catch (err) {
    logger.error(`getNearby error: ${(err as Error).message}`);
    return [];
  }
}

io.on('connection', async (socket: Socket) => {
  const userId = socket.handshake.query.userId as string;
  if (!userId) {
    socket.disconnect();
    return;
  }

  logger.info(`BT connected: ${userId} (${socket.id})`);

  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socket.id);
  socket.join(`user:${userId}`);

  socket.emit('bt:connected', { message: 'Bluetooth service connected', userId });

  // ── Start discovery ──────────────────────────────────────────────────────────
  socket.on('bt:start', async (data: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    displayName?: string;
  }) => {
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') return;

    const radiusM = Math.min(data.radiusM ?? DEFAULT_RADIUS_M, MAX_RADIUS_M);
    const presence = {
      userId,
      displayName: data.displayName || userId.slice(0, 8),
      radiusM,
      lastSeen: Date.now(),
    };

    try {
      // Store GEO location
      await redis.geoadd(BT_GEO_KEY, data.longitude, data.latitude, userId);
      // Store presence metadata with TTL
      await redis.setex(`bt:presence:${userId}`, PRESENCE_TTL_S, JSON.stringify(presence));

      logger.debug(`BT beacon registered: ${userId} at (${data.latitude}, ${data.longitude})`);

      // Find nearby users and notify them + current user
      const nearby = await getNearby(userId, radiusM);

      // Send list to the newly advertising user
      socket.emit('bt:nearby-list', { users: nearby });

      // Notify each nearby user that this user appeared
      for (const peer of nearby) {
        // Only notify if peer's radius overlaps
        const peerPresenceRaw = await redis.get(`bt:presence:${peer.userId}`);
        const peerPresence = peerPresenceRaw ? JSON.parse(peerPresenceRaw) : null;
        if (!peerPresence) continue;

        sendToUser(peer.userId, 'bt:user-found', {
          userId,
          displayName: presence.displayName,
          avatarInitial: presence.displayName.charAt(0).toUpperCase(),
          distanceM: peer.distanceM,
        });
      }

      // Publish Kafka event
      await kafkaProducer.publish('bt.user.appeared', {
        userId,
        latitude: data.latitude,
        longitude: data.longitude,
        nearbyCount: nearby.length,
      }).catch(() => {});
    } catch (err) {
      logger.error(`bt:start error: ${(err as Error).message}`);
    }
  });

  // ── Periodic beacon (location update) ───────────────────────────────────────
  socket.on('bt:beacon', async (data: { latitude: number; longitude: number }) => {
    if (typeof data?.latitude !== 'number' || typeof data?.longitude !== 'number') return;

    const presenceRaw = await redis.get(`bt:presence:${userId}`);
    if (!presenceRaw) return; // user hasn't started discovery

    const presence = JSON.parse(presenceRaw);
    presence.lastSeen = Date.now();

    try {
      await redis.geoadd(BT_GEO_KEY, data.longitude, data.latitude, userId);
      await redis.setex(`bt:presence:${userId}`, PRESENCE_TTL_S, JSON.stringify(presence));

      // Notify nearby users of updated position
      const nearby = await getNearby(userId, presence.radiusM);
      socket.emit('bt:nearby-list', { users: nearby });

      for (const peer of nearby) {
        sendToUser(peer.userId, 'bt:user-found', {
          userId,
          displayName: presence.displayName,
          avatarInitial: presence.displayName.charAt(0).toUpperCase(),
          distanceM: peer.distanceM,
        });
      }
    } catch (err) {
      logger.error(`bt:beacon error: ${(err as Error).message}`);
    }
  });

  // ── Stop discovery ───────────────────────────────────────────────────────────
  socket.on('bt:stop', async () => {
    const presenceRaw = await redis.get(`bt:presence:${userId}`);
    const presence = presenceRaw ? JSON.parse(presenceRaw) : null;
    if (!presence) return;

    const nearby = await getNearby(userId, presence.radiusM);
    await removePresence(userId);

    for (const peer of nearby) {
      sendToUser(peer.userId, 'bt:user-lost', { userId });
    }

    socket.emit('bt:stopped', {});
    logger.debug(`BT discovery stopped: ${userId}`);

    await kafkaProducer.publish('bt.user.disappeared', { userId }).catch(() => {});
  });

  // ── Disconnect ───────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    logger.info(`BT disconnected: ${userId} (${socket.id})`);

    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);

        // Remove from discovery
        const presenceRaw = await redis.get(`bt:presence:${userId}`);
        const presence = presenceRaw ? JSON.parse(presenceRaw) : null;
        if (presence) {
          const nearby = await getNearby(userId, presence.radiusM);
          await removePresence(userId);
          for (const peer of nearby) {
            sendToUser(peer.userId, 'bt:user-lost', { userId });
          }
        }
      }
    }
  });
});

// ── REST Endpoints ─────────────────────────────────────────────────────────────
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'Bluetooth Service is running',
    activeUsers: userSockets.size,
    timestamp: new Date(),
  });
});

// Get nearby users for a given userId (REST fallback)
app.get('/nearby/:userId', async (req, res) => {
  const { userId } = req.params;
  const radiusM = Math.min(parseInt(req.query.radiusM as string) || DEFAULT_RADIUS_M, MAX_RADIUS_M);
  const nearby = await getNearby(userId, radiusM);
  res.json({ users: nearby, radiusM });
});

// ── Start ──────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await redis.ping();
    logger.info('Connected to Redis');

    await kafkaProducer.connect();
    logger.info('Connected to Kafka');

    server.listen(PORT, () => {
      logger.info(`Bluetooth Service running on port ${PORT}`);
      logger.info(`Max radius: ${MAX_RADIUS_M}m, Default: ${DEFAULT_RADIUS_M}m`);
    });
  } catch (error) {
    logger.error(`Failed to start: ${(error as Error).message}`);
    process.exit(1);
  }
}

startServer();

export default app;
