import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkDbHealth } from '@rummy/database';
import { redis } from '@rummy/redis';

import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import { WebSocketGateway } from './ws/server.js';
import { coordinator } from './ws/room-coordinator.js';
import { registry } from './ws/connection-registry.js';
import { roomService } from './matchmaking/room-service.js';
import { matchmaker } from './matchmaking/matchmaker.js';

dotenv.config();

const app = express();
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 4000;

app.use(cors({ origin: process.env['CORS_ORIGIN'] || '*' }));
app.use(express.json());

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

  server.listen(port, () => {
    console.log(`[HTTP] Rummy Server listening on http://localhost:${port}`);
    console.log(`[WS] WebSocket endpoint active at ws://localhost:${port}/ws`);
  });
}

export { app, server, wsGateway, coordinator, registry, roomService, matchmaker, gracefulShutdown };
