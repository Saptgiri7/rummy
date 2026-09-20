import http from 'node:http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';

import authRouter from './routes/auth';

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

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] New client connected from ${ip}`);

  ws.send(JSON.stringify({
    type: 'CONNECTED',
    payload: {
      serverTime: Date.now(),
      message: 'Connected to Indian Rummy Real-Time Server'
    }
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (err) {
      console.error('[WS] Error parsing incoming message:', err);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`[WS] Client disconnected: ${code} ${reason.toString()}`);
  });
});

if (process.env['NODE_ENV'] !== 'test') {
  server.listen(port, () => {
    console.log(`[HTTP] Rummy Server listening on http://localhost:${port}`);
    console.log(`[WS] WebSocket endpoint active at ws://localhost:${port}/ws`);
  });
}

export { app, server, wss };
