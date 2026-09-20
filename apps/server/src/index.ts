import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter from './routes/auth.js';
import { WebSocketGateway } from './ws/server.js';
import { coordinator } from './ws/room-coordinator.js';
import { registry } from './ws/connection-registry.js';

dotenv.config();

const app = express();
const port = process.env['PORT'] ? parseInt(process.env['PORT'], 10) : 4000;

app.use(cors({ origin: process.env['CORS_ORIGIN'] || '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/auth', authRouter);

const server = http.createServer(app);

// Mount real-time WebSocket Gateway
const wsGateway = new WebSocketGateway({
  server,
  path: '/ws'
});

if (process.env['NODE_ENV'] !== 'test') {
  server.listen(port, () => {
    console.log(`[HTTP] Rummy Server listening on http://localhost:${port}`);
    console.log(`[WS] WebSocket endpoint active at ws://localhost:${port}/ws`);
  });
}

export { app, server, wsGateway, coordinator, registry };
