import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessageSchema, ErrorCode, ServerMessage } from '@rummy/shared';
import { verifyAccessToken } from '../auth/jwt.js';
import { registry, ClientConnection } from './connection-registry.js';
import { HeartbeatManager } from './heartbeat.js';
import { coordinator, RoomCoordinator } from './room-coordinator.js';

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

      let userId = 'anonymous';

      if (token) {
        try {
          const payload = verifyAccessToken(token);
          userId = payload.userId;
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
      const conn = registry.register(ws, userId, connectionId);
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
        } catch (err) {
          console.error(`[WS] Error in handleDisconnect for ${connectionId}:`, err);
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

        case 'JOIN_ROOM': {
          await this.roomCoordinator.handleJoinRoom(conn, message.payload.roomId);
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
