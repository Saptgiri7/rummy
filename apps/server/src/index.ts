import 'dotenv/config';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { checkDbHealth } from '@rummy/database';
import { redis } from '@rummy/redis';

import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import adminRouter from './routes/admin.js';
import { findUserByUsername, createUser } from '@rummy/database';
import { hashPassword } from './auth/jwt.js';
import { WebSocketGateway } from './ws/server.js';
import { coordinator } from './ws/room-coordinator.js';
import { registry } from './ws/connection-registry.js';
import { roomService } from './matchmaking/room-service.js';
import { matchmaker } from './matchmaking/matchmaker.js';

const app = express();
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 4000;

app.use(cors({ origin: process.env['CORS_ORIGIN'] || '*' }));
app.use(express.json());

// Auto-seed default platform administrator if not present
export async function seedAdminAccount() {
  try {
    const existing = await findUserByUsername('admin');
    if (!existing) {
      const hash = await hashPassword('AdminPassword123!');
      await createUser('admin', 'admin@rummy.pro', hash, 100000, null, 'ADMIN', true);
      console.log('👑 [SEED] Default admin created: admin@rummy.pro (username: admin)');
    }
  } catch (err) {
    console.warn('[SEED] Admin auto-seed skipped:', (err as Error).message);
  }
}

// Comprehensive healthcheck verifying PostgreSQL and Redis health
app.get('/health', async (_req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  const isDbHealthy = await checkDbHealth();
  if (!isDbHealthy) {
    dbStatus = 'unhealthy';
  }

  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') redisStatus = 'unhealthy';
  } catch {
    redisStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'ok' && redisStatus === 'ok';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    services: {
      postgres: dbStatus,
      redis: redisStatus
    },
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/admin', adminRouter);

const server = http.createServer(app);

// Mount real-time WebSocket Gateway
const wsGateway = new WebSocketGateway({
  server,
  path: '/ws'
});

async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}; initiating graceful shutdown...`);
  try {
    await wsGateway.close();
    server.close(() => {
      console.log('[Server] HTTP & WebSocket servers closed.');
      process.exit(0);
    });
  } catch (err) {
    console.error('[Server] Error during shutdown:', err);
    process.exit(1);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server.listen(port, async () => {
    console.log(`[HTTP] Rummy Server listening on http://localhost:${port}`);
    console.log(`[WS] WebSocket endpoint active at ws://localhost:${port}/ws`);
    await seedAdminAccount();
  });
}

export { app, server, wsGateway, coordinator, registry, roomService, matchmaker, gracefulShutdown };
