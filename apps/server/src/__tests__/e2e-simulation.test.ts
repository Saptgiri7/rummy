import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import request from 'supertest';
import { app } from '../index.js';
import { generateAccessToken } from '../auth/jwt.js';
import { WebSocketGateway } from '../ws/server.js';
import { RoomCoordinator } from '../ws/room-coordinator.js';
import { closeDb, createUser, db, matches, eq } from '@rummy/database';
import { getRoomState } from '@rummy/redis';
import { ServerMessage, CardDto } from '@rummy/shared';

describe('Stage 8: E2E Integration, Concurrency Stress & Production Hardening', () => {
  let server: http.Server;
  let wsGateway: WebSocketGateway;
  let coordinator: RoomCoordinator;
  let wsUrl: string;

  beforeAll(async () => {
    coordinator = new RoomCoordinator({ turnTimeoutMs: 5000 });
    server = http.createServer(app);
    wsGateway = new WebSocketGateway({
      server,
      path: '/ws',
      coordinator
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
  });

  afterAll(async () => {
    if (wsGateway) await wsGateway.close();
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    await closeDb();
  });

  function connectClient(token: string): Promise<{ ws: WebSocket; initial: ServerMessage }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      const timer = setTimeout(() => reject(new Error('WS connect timeout')), 3000);

      ws.once('message', (raw) => {
        clearTimeout(timer);
        const initial = JSON.parse(raw.toString()) as ServerMessage;
        resolve({ ws, initial });
      });

      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  function waitForMessage<T extends ServerMessage['type']>(
    ws: WebSocket,
    type: T,
    filter?: (msg: Extract<ServerMessage, { type: T }>) => boolean,
    timeoutMs = 5000
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for message type: ${type}`));
      }, timeoutMs);

      function onMessage(raw: WebSocket.RawData) {
        try {
          const msg = JSON.parse(raw.toString()) as ServerMessage;
          if (msg.type === type) {
            const typedMsg = msg as Extract<ServerMessage, { type: T }>;
            if (!filter || filter(typedMsg)) {
              cleanup();
              resolve(typedMsg);
            }
          }
        } catch {
          // ignore
        }
      }

      function cleanup() {
        clearTimeout(timer);
        ws.off('message', onMessage);
      }

      ws.on('message', onMessage);
    });
  }

  it('GET /health returns healthy status with postgres and redis status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.services.postgres).toBe('ok');
    expect(res.body.services.redis).toBe('ok');
    expect(res.body.uptimeSec).toBeGreaterThanOrEqual(0);
  });

  it('executes complete end-to-end game: room code invite -> dealing -> turns -> drop -> DB persistence', async () => {
    const ts = Date.now();
    const u1 = await createUser(`e2e_p1_${ts}`, `e2e_p1_${ts}@test.com`, 'pwd123');
    const u2 = await createUser(`e2e_p2_${ts}`, `e2e_p2_${ts}@test.com`, 'pwd123');

    const token1 = generateAccessToken({ userId: u1.user.id, username: u1.user.username });
    const token2 = generateAccessToken({ userId: u2.user.id, username: u2.user.username });

    const client1 = await connectClient(token1);
    const client2 = await connectClient(token2);

    // 1. Host creates room and gets 6-character room code
    const createPromise = waitForMessage(client1.ws, 'ROOM_CREATED');
    client1.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { maxPlayers: 2 }
    }));
    const created = await createPromise;
    const roomCode = created.payload.roomCode;
    const roomId = created.payload.roomId;

    // 2. Friend joins via 6-character room code
    const c1StartPromise = waitForMessage(client1.ws, 'GAME_STARTED');
    const c2StartPromise = waitForMessage(client2.ws, 'GAME_STARTED');

    client2.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    }));

    const [start1, start2] = await Promise.all([c1StartPromise, c2StartPromise]);
    expect(start1.payload.initialHand).toHaveLength(13);
    expect(start2.payload.initialHand).toHaveLength(13);

    const firstActive = start1.payload.activePlayerId;
    const secondActive = firstActive === u1.user.id ? u2.user.id : u1.user.id;

    const activeClient = firstActive === u1.user.id ? client1 : client2;
    const nonActiveClient = firstActive === u1.user.id ? client2 : client1;

    // 3. Turn 1: Active player draws from CLOSED deck
    const drawPrivatePromise = waitForMessage(activeClient.ws, 'CARD_DRAWN_PRIVATE');
    const drawPublicPromise = waitForMessage(nonActiveClient.ws, 'CARD_DRAWN_PUBLIC');

    activeClient.ws.send(JSON.stringify({
      type: 'DRAW_CARD',
      payload: { roomId, source: 'CLOSED' }
    }));

    const [drawPriv, drawPub] = await Promise.all([drawPrivatePromise, drawPublicPromise]);
    expect(drawPriv.payload.hand).toHaveLength(14);
    expect(drawPub.payload.cardCount).toBe(14);

    // 4. Turn 1: Active player discards drawn card
    const drawnCard = drawPriv.payload.drawnCard;
    const discardPromise1 = waitForMessage(client1.ws, 'CARD_DISCARDED');
    const discardPromise2 = waitForMessage(client2.ws, 'CARD_DISCARDED');

    activeClient.ws.send(JSON.stringify({
      type: 'DISCARD_CARD',
      payload: { roomId, cardId: drawnCard.id }
    }));

    const [disc1, disc2] = await Promise.all([discardPromise1, discardPromise2]);
    expect(disc1.payload.nextActivePlayerId).toBe(secondActive);
    expect(disc2.payload.nextActivePlayerId).toBe(secondActive);

    // 5. Turn 2: Second player drops hand
    const roundCompPromise1 = waitForMessage(client1.ws, 'ROUND_COMPLETED');
    const roundCompPromise2 = waitForMessage(client2.ws, 'ROUND_COMPLETED');

    nonActiveClient.ws.send(JSON.stringify({
      type: 'DROP_HAND',
      payload: { roomId }
    }));

    const [comp1, comp2] = await Promise.all([roundCompPromise1, roundCompPromise2]);
    expect(comp1.payload.winnerId).toBe(firstActive);
    expect(comp2.payload.winnerId).toBe(firstActive);

    // 6. Verify PostgreSQL Database Match Record
    const [matchRecord] = await db
      .select()
      .from(matches)
      .where(eq(matches.roomId, roomId))
      .limit(1);

    expect(matchRecord).toBeDefined();
    expect(matchRecord?.winnerId).toBe(firstActive);

    client1.ws.close();
    client2.ws.close();
  });

  it('sustains high-concurrency turn mutations across 10 simultaneous tables with 0 deadlocks', async () => {
    const tableCount = 10;
    const simulationTasks: Promise<void>[] = [];

    for (let i = 0; i < tableCount; i++) {
      simulationTasks.push(
        (async (tableIdx: number) => {
          const ts = Date.now() + tableIdx * 10;
          const uA = await createUser(`stress_a_${ts}_${tableIdx}`, `stress_a_${ts}_${tableIdx}@test.com`, 'pwd');
          const uB = await createUser(`stress_b_${ts}_${tableIdx}`, `stress_b_${ts}_${tableIdx}@test.com`, 'pwd');

          const tokA = generateAccessToken({ userId: uA.user.id, username: uA.user.username });
          const tokB = generateAccessToken({ userId: uB.user.id, username: uB.user.username });

          const clA = await connectClient(tokA);
          const clB = await connectClient(tokB);

          const roomId = `stress_room_${tableIdx}_${ts}`;
          const startA = waitForMessage(clA.ws, 'GAME_STARTED');
          const startB = waitForMessage(clB.ws, 'GAME_STARTED');

          await coordinator.initializeRoom(roomId, [uA.user.id, uB.user.id], 0);

          const [sA] = await Promise.all([startA, startB]);
          const activeUser = sA.payload.activePlayerId;
          const activeCl = activeUser === uA.user.id ? clA : clB;

          // Execute concurrent draw
          const drawPrivPromise = waitForMessage(activeCl.ws, 'CARD_DRAWN_PRIVATE');
          activeCl.ws.send(JSON.stringify({
            type: 'DRAW_CARD',
            payload: { roomId, source: 'CLOSED' }
          }));
          const drawResult = await drawPrivPromise;

          // Execute concurrent discard
          const cardId = drawResult.payload.drawnCard.id;
          const discPromise = waitForMessage(clA.ws, 'CARD_DISCARDED');
          activeCl.ws.send(JSON.stringify({
            type: 'DISCARD_CARD',
            payload: { roomId, cardId }
          }));
          await discPromise;

          // Verify room state is consistent in Redis
          const roomState = await getRoomState(roomId);
          expect(roomState).not.toBeNull();
          expect(roomState?.openPile.length).toBeGreaterThan(1);

          clA.ws.close();
          clB.ws.close();
        })(i)
      );
    }

    // Await all 10 simultaneous tables
    await Promise.all(simulationTasks);
  });
});
