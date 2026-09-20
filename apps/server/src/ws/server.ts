import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessageSchema, ErrorCode, ServerMessage } from '@rummy/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { registry, ClientConnection } from './connection-registry.js';
import { HeartbeatManager } from './heartbeat.js';
import { coordinator, RoomCoordinator } from './room-coordinator.js';
import { roomService } from '../matchmaking/room-service.js';
import { matchmaker } from '../matchmaking/matchmaker.js';
import { getRoomState, getRoomIdByCode } from '@rummy/redis';

export interface WebSocketGatewayOptions {
  server: http.Server;
  path?: string;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  coordinator?: RoomCoordinator;
}

export class WebSocketGateway {
  readonly wss: WebSocketServer;
  readonly heartbeatManager: HeartbeatManager;
  readonly roomCoordinator: RoomCoordinator;

  constructor(options: WebSocketGatewayOptions) {
    this.roomCoordinator = options.coordinator ?? coordinator;
    this.heartbeatManager = new HeartbeatManager(
      {
        pingIntervalMs: options.heartbeatIntervalMs ?? 30000,
        pongTimeoutMs: options.heartbeatTimeoutMs ?? 10000
      },
      (conn) => {
        this.roomCoordinator.handleDisconnect(conn).catch((err) => {
          console.error(`[WS] Error in heartbeat disconnect handler:`, err);
        });
        matchmaker.handleDisconnect(conn.userId).catch(() => {});
        registry.unregister(conn.connectionId);
      }
    );

    this.wss = new WebSocketServer({
      server: options.server,
      path: options.path ?? '/ws'
    });

    this.init();
    this.heartbeatManager.start();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    try {
      const url = new URL(req.url ?? '', `http://${req.headers.host || 'localhost'}`);
      const token = url.searchParams.get('token');

      let userId = `anon_${crypto.randomUUID().slice(0, 8)}`;
      let username = 'Player';

      if (token) {
        try {
          const payload = verifyAccessToken(token);
          userId = payload.userId;
          username = payload.username || 'Player';
        } catch (authErr) {
          console.warn('[WS] Invalid or expired token presented during connection handshake:', authErr);
          const errorMsg: ServerMessage = {
            type: 'ERROR',
            payload: {
              code: ErrorCode.UNAUTHORIZED,
              message: 'Authentication token is invalid or expired'
            }
          };
          ws.send(JSON.stringify(errorMsg));
          ws.close(1008, 'Unauthorized');
          return;
        }
      }

      const connectionId = crypto.randomUUID();
      const conn = registry.register(ws, userId, connectionId, username);
      this.heartbeatManager.setupSocket(conn);

      // Send initial CONNECTED frame
      const connectedMsg: ServerMessage = {
        type: 'CONNECTED',
        payload: {
          connectionId,
          userId,
          serverTime: Date.now(),
          message: 'Connected to Indian Rummy Real-Time Server'
        }
      };
      registry.sendToConnection(connectionId, connectedMsg);

      // Wire message listener
      ws.on('message', async (raw) => {
        await this.handleClientMessage(conn, raw);
      });

      // Wire close listener
      ws.on('close', async (code, reason) => {
        console.log(`[WS] Client ${connectionId} disconnected (${code}: ${reason.toString()})`);
        try {
          await this.roomCoordinator.handleDisconnect(conn);
          await matchmaker.handleDisconnect(conn.userId);
        } catch (err) {
          console.error(`[WS] Error in disconnect handler for ${connectionId}:`, err);
        }
        registry.unregister(connectionId);
      });

      // Wire socket errors
      ws.on('error', (err) => {
        console.error(`[WS] Socket error for ${connectionId}:`, err);
      });
    } catch (err) {
      console.error('[WS] Connection handshake failed:', err);
      try {
        ws.close(1011, 'Internal Server Error');
      } catch {
        // Ignore close error
      }
    }
  }

  private async handleClientMessage(
    conn: ClientConnection,
    raw: unknown
  ): Promise<void> {
    try {
      const text = typeof raw === 'string' ? raw : (raw as Buffer).toString('utf-8');
      const json = JSON.parse(text);

      const parsed = ClientMessageSchema.safeParse(json);
      if (!parsed.success) {
        const errorMsg: ServerMessage = {
          type: 'ERROR',
          payload: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid message structure',
            details: parsed.error.issues
          }
        };
        registry.sendToConnection(conn.connectionId, errorMsg);
        return;
      }

      const message = parsed.data;

      switch (message.type) {
        case 'PING': {
          conn.isAlive = true;
          const pongMsg: ServerMessage = {
            type: 'PONG',
            timestamp: Date.now()
          };
          registry.sendToConnection(conn.connectionId, pongMsg);
          break;
        }

        case 'CREATE_ROOM': {
          const lobby = await roomService.createRoom(
            { id: conn.userId, username: conn.username },
            message.payload.maxPlayers
          );
          registry.joinRoom(conn.connectionId, lobby.roomId);

          const roomCreatedMsg: ServerMessage = {
            type: 'ROOM_CREATED',
            payload: {
              roomId: lobby.roomId,
              roomCode: lobby.roomCode,
              maxPlayers: lobby.maxPlayers,
              players: lobby.players.map((p) => ({
                id: p.id,
                username: p.username,
                isHost: p.isHost
              })),
              isHost: true
            }
          };
          registry.sendToConnection(conn.connectionId, roomCreatedMsg);
          break;
        }

        case 'JOIN_ROOM': {
          let targetRoomId = message.payload.roomId;
          const resolvedId = await getRoomIdByCode(message.payload.roomId);
          if (resolvedId) {
            targetRoomId = resolvedId;
          }

          // Check if game is already active (reconnection flow)
          const activeGameState = await getRoomState(targetRoomId);
          if (activeGameState) {
            await this.roomCoordinator.handleJoinRoom(conn, targetRoomId);
            break;
          }

          // Otherwise join waiting room lobby
          try {
            const { lobby, shouldStartGame } = await roomService.joinRoom(
              { id: conn.userId, username: conn.username },
              targetRoomId
            );

            registry.joinRoom(conn.connectionId, lobby.roomId);
            roomService.broadcastLobbyUpdate(lobby);

            if (shouldStartGame) {
              // Auto-start when room reaches full player capacity
              const playerIds = lobby.players.map((p) => p.id);
              await this.roomCoordinator.initializeRoom(lobby.roomId, playerIds, 0);
            }
          } catch (err: unknown) {
            const errCode = (err instanceof Error && Object.values(ErrorCode).includes(err.message as ErrorCode))
              ? (err.message as ErrorCode)
              : ErrorCode.ROOM_NOT_FOUND;
            const errorMsg: ServerMessage = {
              type: 'ERROR',
              payload: {
                code: errCode,
                message: err instanceof Error ? err.message : 'Failed to join room'
              }
            };
            registry.sendToConnection(conn.connectionId, errorMsg);
          }
          break;
        }

        case 'START_ROOM_GAME': {
          try {
            await roomService.startGame(message.payload.roomId, conn.userId);
          } catch (err: unknown) {
            const errCode = (err instanceof Error && Object.values(ErrorCode).includes(err.message as ErrorCode))
              ? (err.message as ErrorCode)
              : ErrorCode.INTERNAL_SERVER_ERROR;
            const errorMsg: ServerMessage = {
              type: 'ERROR',
              payload: {
                code: errCode,
                message: err instanceof Error ? err.message : 'Failed to start game'
              }
            };
            registry.sendToConnection(conn.connectionId, errorMsg);
          }
          break;
        }

        case 'LEAVE_ROOM': {
          const updatedLobby = await roomService.leaveRoom(message.payload.roomId, conn.userId);
          registry.leaveRoom(conn.connectionId, message.payload.roomId);

          if (updatedLobby) {
            roomService.broadcastLobbyUpdate(updatedLobby);
          }
          break;
        }

        case 'JOIN_MATCHMAKING': {
          await matchmaker.enqueue(conn.userId, message.payload.maxPlayers);
          break;
        }

        case 'LEAVE_MATCHMAKING': {
          await matchmaker.dequeue(conn.userId);
          break;
        }

        case 'DRAW_CARD': {
          await this.roomCoordinator.handleDraw(
            conn,
            message.payload.roomId,
            message.payload.source
          );
          break;
        }

        case 'DISCARD_CARD': {
          await this.roomCoordinator.handleDiscard(
            conn,
            message.payload.roomId,
            message.payload.cardId
          );
          break;
        }

        case 'DROP_HAND': {
          await this.roomCoordinator.handleDrop(conn, message.payload.roomId);
          break;
        }

        case 'DECLARE_SHOW': {
          await this.roomCoordinator.handleDeclare(
            conn,
            message.payload.roomId,
            message.payload.finishCardId,
            message.payload.melds
          );
          break;
        }

        default: {
          console.warn(`[WS] Unhandled message type: ${(message as { type: string }).type}`);
        }
      }
    } catch (err: unknown) {
      console.error(`[WS] Error processing message from ${conn.connectionId}:`, err);
      const errorMsg: ServerMessage = {
        type: 'ERROR',
        payload: {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          message: 'Failed to process message'
        }
      };
      registry.sendToConnection(conn.connectionId, errorMsg);
    }
  }

  close(): Promise<void> {
    this.heartbeatManager.stop();
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
