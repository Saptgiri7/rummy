import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import request from 'supertest';
import { app } from '../index.js';
import { generateAccessToken } from '../auth/jwt.js';
import { WebSocketGateway } from '../ws/server.js';
import { RoomCoordinator } from '../ws/room-coordinator.js';
import { roomService } from '../matchmaking/room-service.js';
import { closeDb, createUser } from '@rummy/database';
import { redis, getRoomLobby, clearUserActiveRoom, getMatchmakingQueueKey } from '@rummy/redis';
import { ServerMessage } from '@rummy/shared';

describe('Stage 6: Room Creation, Friend Sharing & Matchmaking Integration Tests', () => {
  let server: http.Server;
  let wsGateway: WebSocketGateway;
  let coordinator: RoomCoordinator;
  let wsUrl: string;

  let hostUser: { id: string; username: string; token: string };
  let friendUser1: { id: string; username: string; token: string };
  let friendUser2: { id: string; username: string; token: string };

  beforeAll(async () => {
    await redis.del(getMatchmakingQueueKey('POINTS_13', 2));
    await redis.del(getMatchmakingQueueKey('POINTS_13', 6));
    const ts = Date.now();
    const u1 = await createUser(`host_${ts}`, `host_${ts}@test.com`, 'hash_pwd');
    const u2 = await createUser(`friend1_${ts}`, `friend1_${ts}@test.com`, 'hash_pwd');
    const u3 = await createUser(`friend2_${ts}`, `friend2_${ts}@test.com`, 'hash_pwd');

    hostUser = {
      id: u1.user.id,
      username: u1.user.username,
      token: generateAccessToken({ userId: u1.user.id, username: u1.user.username })
    };
    friendUser1 = {
      id: u2.user.id,
      username: u2.user.username,
      token: generateAccessToken({ userId: u2.user.id, username: u2.user.username })
    };
    friendUser2 = {
      id: u3.user.id,
      username: u3.user.username,
      token: generateAccessToken({ userId: u3.user.id, username: u3.user.username })
    };

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

  function connectClient(token: string): Promise<{ ws: WebSocket }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${wsUrl}?token=${token}`);
      const timer = setTimeout(() => reject(new Error('WS connect timeout')), 3000);

      ws.once('open', () => {
        clearTimeout(timer);
        resolve({ ws });
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
    timeoutMs = 4000
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

  it('POST /api/rooms/create generates a 6-character room code and GET fetches lobby', async () => {
    const res = await request(app)
      .post('/api/rooms/create')
      .set('Authorization', `Bearer ${hostUser.token}`)
      .send({ maxPlayers: 2 });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.lobby.roomCode).toMatch(/^RUM[A-Z0-9]{3}$/);
    expect(res.body.lobby.maxPlayers).toBe(2);
    expect(res.body.lobby.hostId).toBe(hostUser.id);

    const roomCode = res.body.lobby.roomCode;
    const roomId = res.body.lobby.roomId;

    // Fetch using 6-character roomCode
    const fetchByCode = await request(app).get(`/api/rooms/${roomCode}`);
    expect(fetchByCode.status).toBe(200);
    expect(fetchByCode.body.lobby.roomId).toBe(roomId);

    // Fetch using full roomId
    const fetchById = await request(app).get(`/api/rooms/${roomId}`);
    expect(fetchById.status).toBe(200);
    expect(fetchById.body.lobby.roomCode).toBe(roomCode);
  });

  it('creates room via WebSocket and auto-starts when friend joins by roomCode', async () => {
    const host = await connectClient(hostUser.token);
    const friend = await connectClient(friendUser1.token);

    // 1. Host creates room for 2 players
    const roomCreatedPromise = waitForMessage(host.ws, 'ROOM_CREATED');
    host.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { maxPlayers: 2 }
    }));

    const created = await roomCreatedPromise;
    expect(created.payload.roomCode).toBeDefined();
    expect(created.payload.maxPlayers).toBe(2);
    expect(created.payload.isHost).toBe(true);

    const roomCode = created.payload.roomCode;

    // 2. Friend joins room using only the 6-character roomCode!
    const hostGameStartPromise = waitForMessage(host.ws, 'GAME_STARTED');
    const friendGameStartPromise = waitForMessage(friend.ws, 'GAME_STARTED');
    const friendLobbyUpdatePromise = waitForMessage(friend.ws, 'ROOM_LOBBY_UPDATE');

    friend.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    }));

    // Friend gets lobby update
    const lobbyUpdate = await friendLobbyUpdatePromise;
    expect(lobbyUpdate.payload.players).toHaveLength(2);

    // Since maxPlayers = 2, game auto-starts immediately!
    const [hostGame, friendGame] = await Promise.all([
      hostGameStartPromise,
      friendGameStartPromise
    ]);

    expect(hostGame.payload.initialHand).toHaveLength(13);
    expect(friendGame.payload.initialHand).toHaveLength(13);
    expect(hostGame.payload.wildJoker).toBeDefined();
    expect(friendGame.payload.wildJoker).toBeDefined();

    host.ws.close();
    friend.ws.close();
    coordinator.cancelTurnTimer(created.payload.roomId);
    await clearUserActiveRoom(hostUser.id);
    await clearUserActiveRoom(friendUser1.id);
  });

  it('rejects joining when room is already full', async () => {
    const host = await connectClient(hostUser.token);
    const friend1 = await connectClient(friendUser1.token);
    const friend2 = await connectClient(friendUser2.token);

    // Host creates 2-player room
    const roomCreatedPromise = waitForMessage(host.ws, 'ROOM_CREATED');
    host.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { maxPlayers: 2 }
    }));
    const created = await roomCreatedPromise;
    const roomCode = created.payload.roomCode;

    // Friend 1 joins -> fills room to 2/2
    const gameStartPromise = waitForMessage(host.ws, 'GAME_STARTED');
    friend1.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    }));
    await gameStartPromise;

    // Friend 2 tries to join full room -> rejected with GAME_ALREADY_STARTED or ROOM_FULL
    const errorPromise = waitForMessage(friend2.ws, 'ERROR');
    friend2.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    }));
    const err = await errorPromise;
    expect(['ROOM_FULL', 'GAME_ALREADY_STARTED', 'PLAYER_NOT_IN_ROOM']).toContain(err.payload.code);

    host.ws.close();
    friend1.ws.close();
    friend2.ws.close();
    coordinator.cancelTurnTimer(created.payload.roomId);
    await clearUserActiveRoom(hostUser.id);
    await clearUserActiveRoom(friendUser1.id);
    await clearUserActiveRoom(friendUser2.id);
  });

  it('allows host to manually start a 6-player room when >= 2 players join', async () => {
    const host = await connectClient(hostUser.token);
    const friend1 = await connectClient(friendUser1.token);

    // Host creates 6-player room
    const roomCreatedPromise = waitForMessage(host.ws, 'ROOM_CREATED');
    host.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      payload: { maxPlayers: 6 }
    }));
    const created = await roomCreatedPromise;
    const roomCode = created.payload.roomCode;
    const roomId = created.payload.roomId;

    // Friend 1 joins
    const lobbyPromise = waitForMessage(host.ws, 'ROOM_LOBBY_UPDATE');
    friend1.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId: roomCode }
    }));
    const lobby = await lobbyPromise;
    expect(lobby.payload.players).toHaveLength(2);
    expect(lobby.payload.canStart).toBe(true);

    // Host starts game on demand!
    const hostStartPromise = waitForMessage(host.ws, 'GAME_STARTED');
    const friendStartPromise = waitForMessage(friend1.ws, 'GAME_STARTED');

    host.ws.send(JSON.stringify({
      type: 'START_ROOM_GAME',
      payload: { roomId }
    }));

    const [hGame, fGame] = await Promise.all([hostStartPromise, friendStartPromise]);
    expect(hGame.payload.initialHand).toHaveLength(13);
    expect(fGame.payload.initialHand).toHaveLength(13);

    host.ws.close();
    friend1.ws.close();
    coordinator.cancelTurnTimer(roomId);
    await clearUserActiveRoom(hostUser.id);
    await clearUserActiveRoom(friendUser1.id);
  });

  it('pairs players via public matchmaking queues without any chips', async () => {
    await redis.del(getMatchmakingQueueKey('POINTS_13', 2));
    const p1 = await connectClient(hostUser.token);
    const p2 = await connectClient(friendUser1.token);

    const p1QueuePromise = waitForMessage(p1.ws, 'MATCHMAKING_STATUS');
    p1.ws.send(JSON.stringify({
      type: 'JOIN_MATCHMAKING',
      payload: { maxPlayers: 2 }
    }));
    const p1Status = await p1QueuePromise;
    expect(p1Status.payload.status).toBe('QUEUED');

    // Player 2 enters same queue -> match formed immediately!
    const p1MatchedPromise = waitForMessage(p1.ws, 'MATCHMAKING_STATUS', (m) => m.payload.status === 'MATCHED');
    const p2MatchedPromise = waitForMessage(p2.ws, 'MATCHMAKING_STATUS', (m) => m.payload.status === 'MATCHED');
    const p1GamePromise = waitForMessage(p1.ws, 'GAME_STARTED');
    const p2GamePromise = waitForMessage(p2.ws, 'GAME_STARTED');

    p2.ws.send(JSON.stringify({
      type: 'JOIN_MATCHMAKING',
      payload: { maxPlayers: 2 }
    }));

    const [m1, m2, g1, g2] = await Promise.all([
      p1MatchedPromise,
      p2MatchedPromise,
      p1GamePromise,
      p2GamePromise
    ]);

    expect(m1.payload.status).toBe('MATCHED');
    expect(m2.payload.status).toBe('MATCHED');
    expect(g1.payload.initialHand).toHaveLength(13);
    expect(g2.payload.initialHand).toHaveLength(13);

    p1.ws.close();
    p2.ws.close();
    coordinator.cancelTurnTimer(g1.payload.roomId);
    await clearUserActiveRoom(hostUser.id);
    await clearUserActiveRoom(friendUser1.id);
  });
});
