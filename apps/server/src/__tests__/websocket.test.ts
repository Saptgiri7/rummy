import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import express from 'express';
import { generateAccessToken } from '../auth/jwt.js';
import { WebSocketGateway } from '../ws/server.js';
import { RoomCoordinator } from '../ws/room-coordinator.js';
import { closeDb, createUser } from '@rummy/database';
import { redis, getRoomState } from '@rummy/redis';
import { ServerMessage } from '@rummy/shared';

describe('Real-Time WebSocket Server & Turn Loop Integration Tests', () => {
  let server: http.Server;
  let wsGateway: WebSocketGateway;
  let coordinator: RoomCoordinator;
  let wsUrl: string;

  let player1: { id: string; username: string; token: string };
  let player2: { id: string; username: string; token: string };

  beforeAll(async () => {
    // 1. Create test users in DB
    const ts = Date.now();
    const u1 = await createUser(
      `ws_p1_${ts}`,
      `ws_p1_${ts}@example.com`,
      'dummy_hash'
    );
    const u2 = await createUser(
      `ws_p2_${ts}`,
      `ws_p2_${ts}@example.com`,
      'dummy_hash'
    );

    player1 = {
      id: u1.user.id,
      username: u1.user.username,
      token: generateAccessToken({ userId: u1.user.id, username: u1.user.username })
    };
    player2 = {
      id: u2.user.id,
      username: u2.user.username,
      token: generateAccessToken({ userId: u2.user.id, username: u2.user.username })
    };

    // 2. Start HTTP server with ephemeral port and WebSocketGateway
    const app = express();
    server = http.createServer(app);

    coordinator = new RoomCoordinator({
      turnTimeoutMs: 5000,
      gracePeriodMs: 5000
    });

    wsGateway = new WebSocketGateway({
      server,
      path: '/ws',
      heartbeatIntervalMs: 60000,
      coordinator
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const addr = server.address() as AddressInfo;
    wsUrl = `ws://127.0.0.1:${addr.port}/ws`;
  });

  afterAll(async () => {
    if (wsGateway) {
      await wsGateway.close();
    }
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
    await closeDb();
  });

  // Helper to connect WebSocket and collect initial CONNECTED frame
  function connectClient(token?: string): Promise<{ ws: WebSocket; initialMessage: ServerMessage }> {
    return new Promise((resolve, reject) => {
      const url = token ? `${wsUrl}?token=${token}` : wsUrl;
      const ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timed out'));
      }, 3000);

      ws.once('message', (data) => {
        clearTimeout(timeout);
        const msg = JSON.parse(data.toString()) as ServerMessage;
        resolve({ ws, initialMessage: msg });
      });

      ws.once('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  // Helper to wait for a specific message type
  function waitForMessage<T extends ServerMessage['type']>(
    ws: WebSocket,
    type: T,
    timeoutMs = 4000
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for message type: ${type}`));
      }, timeoutMs);

      function onMessage(data: WebSocket.RawData) {
        try {
          const msg = JSON.parse(data.toString()) as ServerMessage;
          if (msg.type === type) {
            cleanup();
            resolve(msg as Extract<ServerMessage, { type: T }>);
          }
        } catch {
          // ignore parsing error in waiter
        }
      }

      function cleanup() {
        clearTimeout(timer);
        ws.off('message', onMessage);
      }

      ws.on('message', onMessage);
    });
  }

  it('rejects connection with invalid token with UNAUTHORIZED error', async () => {
    const { initialMessage, ws } = await connectClient('invalid.expired.jwt.token');
    expect(initialMessage.type).toBe('ERROR');
    if (initialMessage.type === 'ERROR') {
      expect(initialMessage.payload.code).toBe('UNAUTHORIZED');
    }
    ws.close();
  });

  it('connects authenticated client and completes PING/PONG', async () => {
    const { ws, initialMessage } = await connectClient(player1.token);

    expect(initialMessage.type).toBe('CONNECTED');
    if (initialMessage.type === 'CONNECTED') {
      expect(initialMessage.payload.userId).toBe(player1.id);
      expect(initialMessage.payload.connectionId).toBeDefined();
    }

    const pongPromise = waitForMessage(ws, 'PONG');
    ws.send(JSON.stringify({ type: 'PING' }));
    const pong = await pongPromise;
    expect(pong.type).toBe('PONG');
    expect(pong.timestamp).toBeGreaterThan(0);

    ws.close();
  });

  it('executes full authoritative turn cycle with anti-cheat information hiding', async () => {
    const roomId = `room_sim_${Date.now()}`;

    // Connect both players
    const client1 = await connectClient(player1.token);
    const client2 = await connectClient(player2.token);

    // Initialize room with player1 and player2
    const gameStartPromise1 = waitForMessage(client1.ws, 'GAME_STARTED');
    const gameStartPromise2 = waitForMessage(client2.ws, 'GAME_STARTED');

    const initialState = await coordinator.initializeRoom(roomId, [player1.id, player2.id]);
    expect(initialState.roomId).toBe(roomId);
    expect(initialState.activePlayerId).toBe(player1.id);

    const startMsg1 = await gameStartPromise1;
    const startMsg2 = await gameStartPromise2;

    expect(startMsg1.payload.initialHand).toHaveLength(13);
    expect(startMsg2.payload.initialHand).toHaveLength(13);
    expect(startMsg1.payload.activePlayerId).toBe(player1.id);

    // Verify Redis state was persisted
    const redisState = await getRoomState(roomId);
    expect(redisState).not.toBeNull();
    expect(redisState?.turnPhase).toBe('WAITING_DRAW');

    // 1. Player 1 draws from CLOSED deck
    const p1PrivateDrawPromise = waitForMessage(client1.ws, 'CARD_DRAWN_PRIVATE');
    const p2PublicDrawPromise = waitForMessage(client2.ws, 'CARD_DRAWN_PUBLIC');

    client1.ws.send(JSON.stringify({
      type: 'DRAW_CARD',
      payload: { roomId, source: 'CLOSED' }
    }));

    const p1Draw = await p1PrivateDrawPromise;
    const p2Draw = await p2PublicDrawPromise;

    // Player 1 receives secret card
    expect(p1Draw.payload.drawnCard).toBeDefined();
    expect(p1Draw.payload.hand).toHaveLength(14);

    // Player 2 receives public notification with NO card details (anti-cheat!)
    expect(p2Draw.payload.playerId).toBe(player1.id);
    expect(p2Draw.payload.source).toBe('CLOSED');
    expect(p2Draw.payload.cardCount).toBe(14);
    expect((p2Draw.payload as Record<string, unknown>)['drawnCard']).toBeUndefined();

    // 2. Illegal action: Player 2 tries to discard on Player 1's turn
    const p2ErrorPromise = waitForMessage(client2.ws, 'ERROR');
    client2.ws.send(JSON.stringify({
      type: 'DISCARD_CARD',
      payload: { roomId, cardId: 'dummy_card' }
    }));
    const p2Error = await p2ErrorPromise;
    expect(p2Error.payload.code).toBe('NOT_YOUR_TURN');

    // 3. Player 1 discards the drawn card to complete turn
    const cardToDiscard = p1Draw.payload.drawnCard.id;
    const p1DiscardPromise = waitForMessage(client1.ws, 'CARD_DISCARDED');
    const p2DiscardPromise = waitForMessage(client2.ws, 'CARD_DISCARDED');

    client1.ws.send(JSON.stringify({
      type: 'DISCARD_CARD',
      payload: { roomId, cardId: cardToDiscard }
    }));

    const [discard1, discard2] = await Promise.all([p1DiscardPromise, p2DiscardPromise]);
    expect(discard1.payload.playerId).toBe(player1.id);
    expect(discard1.payload.nextActivePlayerId).toBe(player2.id);
    expect(discard2.payload.nextActivePlayerId).toBe(player2.id);

    // Verify Redis state updated: Active player is now player 2
    const updatedState = await getRoomState(roomId);
    expect(updatedState?.activePlayerId).toBe(player2.id);
    expect(updatedState?.turnPhase).toBe('WAITING_DRAW');

    // 4. Player 2 drops hand -> Player 1 wins by last standing
    const roundCompletedPromise1 = waitForMessage(client1.ws, 'ROUND_COMPLETED');
    const roundCompletedPromise2 = waitForMessage(client2.ws, 'ROUND_COMPLETED');

    client2.ws.send(JSON.stringify({
      type: 'DROP_HAND',
      payload: { roomId }
    }));

    const [comp1, comp2] = await Promise.all([roundCompletedPromise1, roundCompletedPromise2]);
    expect(comp1.payload.winnerId).toBe(player1.id);
    expect(comp2.payload.winnerId).toBe(player1.id);

    client1.ws.close();
    client2.ws.close();
  });

  it('handles player disconnect notification and reconnection state recovery', async () => {
    const roomId = `room_reconnect_${Date.now()}`;

    const client1 = await connectClient(player1.token);
    const client2 = await connectClient(player2.token);

    await coordinator.initializeRoom(roomId, [player1.id, player2.id]);

    // Player 1 disconnects
    const p2DisconnectPromise = waitForMessage(client2.ws, 'PLAYER_DISCONNECTED');
    client1.ws.close();

    const p2Disconnect = await p2DisconnectPromise;
    expect(p2Disconnect.payload.playerId).toBe(player1.id);
    expect(p2Disconnect.payload.gracePeriodMs).toBeGreaterThan(0);

    // Player 1 reconnects with a fresh socket
    const reconnectedClient1 = await connectClient(player1.token);
    const p2ReconnectedPromise = waitForMessage(client2.ws, 'PLAYER_RECONNECTED');
    const p1StateRecoveryPromise = waitForMessage(reconnectedClient1.ws, 'GAME_RECONNECTED');

    reconnectedClient1.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      payload: { roomId }
    }));

    const [p2Reconn, p1Recovery] = await Promise.all([
      p2ReconnectedPromise,
      p1StateRecoveryPromise
    ]);

    expect(p2Reconn.payload.playerId).toBe(player1.id);
    expect(p1Recovery.payload.roomId).toBe(roomId);
    expect(p1Recovery.payload.hand).toHaveLength(13);
    expect(p1Recovery.payload.wildJoker).toBeDefined();

    client2.ws.close();
    reconnectedClient1.ws.close();
  });

  it('executes auto-play on turn timeout and auto-drops after 3 missed turns', async () => {
    const roomId = `room_autoplay_${Date.now()}`;

    const client1 = await connectClient(player1.token);
    const client2 = await connectClient(player2.token);

    await coordinator.initializeRoom(roomId, [player1.id, player2.id]);

    // 1. First missed turn for Player 1: Auto-turn draws from closed and discards
    const p2DiscardPromise1 = waitForMessage(client2.ws, 'CARD_DISCARDED');
    await coordinator.executeAutoTurn(roomId, player1.id);
    const discardMsg1 = await p2DiscardPromise1;
    expect(discardMsg1.payload.playerId).toBe(player1.id);
    expect(discardMsg1.payload.nextActivePlayerId).toBe(player2.id);

    let state = await getRoomState(roomId);
    expect(state?.playerMissedTurns[player1.id]).toBe(1);

    // Player 2 takes turn normally
    client2.ws.send(JSON.stringify({
      type: 'DRAW_CARD',
      payload: { roomId, source: 'CLOSED' }
    }));
    const p2Draw = await waitForMessage(client2.ws, 'CARD_DRAWN_PRIVATE');
    client2.ws.send(JSON.stringify({
      type: 'DISCARD_CARD',
      payload: { roomId, cardId: p2Draw.payload.drawnCard.id }
    }));
    await waitForMessage(client1.ws, 'CARD_DISCARDED');

    // 2. Second missed turn for Player 1
    await coordinator.executeAutoTurn(roomId, player1.id);
    state = await getRoomState(roomId);
    expect(state?.playerMissedTurns[player1.id]).toBe(2);

    // Player 2 takes turn normally again
    client2.ws.send(JSON.stringify({
      type: 'DRAW_CARD',
      payload: { roomId, source: 'CLOSED' }
    }));
    const p2Draw2 = await waitForMessage(client2.ws, 'CARD_DRAWN_PRIVATE');
    client2.ws.send(JSON.stringify({
      type: 'DISCARD_CARD',
      payload: { roomId, cardId: p2Draw2.payload.drawnCard.id }
    }));
    await waitForMessage(client1.ws, 'CARD_DISCARDED');

    // 3. Third missed turn for Player 1: Triggers Auto-Drop!
    const p2WonPromise = waitForMessage(client2.ws, 'ROUND_COMPLETED');
    await coordinator.executeAutoTurn(roomId, player1.id);
    const roundComp = await p2WonPromise;
    expect(roundComp.payload.winnerId).toBe(player2.id);

    client1.ws.close();
    client2.ws.close();
  });

  it('penalizes bogus declaration with 80 points and awards round to remaining player', async () => {
    const roomId = `room_declare_${Date.now()}`;

    const client1 = await connectClient(player1.token);
    const client2 = await connectClient(player2.token);

    await coordinator.initializeRoom(roomId, [player1.id, player2.id]);

    // Player 1 draws a card to enter WAITING_DISCARD phase
    client1.ws.send(JSON.stringify({
      type: 'DRAW_CARD',
      payload: { roomId, source: 'CLOSED' }
    }));
    const p1Draw = await waitForMessage(client1.ws, 'CARD_DRAWN_PRIVATE');

    // Player 1 submits bogus declaration (no valid pure sequence)
    const p1ErrorPromise = waitForMessage(client1.ws, 'ERROR');
    const p2DropPromise = waitForMessage(client2.ws, 'PLAYER_DROPPED');

    const finishCard = p1Draw.payload.drawnCard;
    const handCards = p1Draw.payload.hand.filter((c) => c.id !== finishCard.id);

    // Group cards arbitrarily into 2 groups (which won't form pure sequences)
    const melds = [handCards.slice(0, 6), handCards.slice(6)];

    client1.ws.send(JSON.stringify({
      type: 'DECLARE_SHOW',
      payload: {
        roomId,
        finishCardId: finishCard.id,
        melds
      }
    }));

    const [errorMsg, dropMsg] = await Promise.all([p1ErrorPromise, p2DropPromise]);
    expect(errorMsg.payload.code).toBe('INVALID_DECLARATION');
    expect(dropMsg.payload.playerId).toBe(player1.id);
    expect(dropMsg.payload.penalty).toBe(80);

    client1.ws.close();
    client2.ws.close();
  });

  it('handles LEAVE_TABLE message with immediate auto-win for opponent in heads-up match', async () => {
    const roomId = `room_leave_${Date.now()}`;

    const client1 = await connectClient(player1.token);
    const client2 = await connectClient(player2.token);

    await coordinator.initializeRoom(roomId, [player1.id, player2.id]);

    // Player 1 sends LEAVE_TABLE
    const p2WonPromise = waitForMessage(client2.ws, 'ROUND_COMPLETED');
    client1.ws.send(JSON.stringify({
      type: 'LEAVE_TABLE',
      payload: { roomId }
    }));

    const roundComp = await p2WonPromise;
    expect(roundComp.payload.winnerId).toBe(player2.id);

    client1.ws.close();
    client2.ws.close();
  });
});
