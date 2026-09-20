import { WebSocket } from 'ws';
import { ServerMessage } from '@rummy/shared';
import { logger } from '../utils/logger.js';

export interface ClientConnection {
  readonly connectionId: string;
  readonly userId: string;
  readonly username: string;
  readonly ws: WebSocket;
  roomId?: string;
  isAlive: boolean;
  connectedAt: number;
}

class ConnectionRegistry {
  private connections = new Map<string, ClientConnection>();
  private userToConnections = new Map<string, Set<string>>();
  private roomToConnections = new Map<string, Set<string>>();

  register(
    ws: WebSocket,
    userId: string,
    connectionId: string,
    username = 'Player'
  ): ClientConnection {
    const conn: ClientConnection = {
      connectionId,
      userId,
      username,
      ws,
      isAlive: true,
      connectedAt: Date.now()
    };

    this.connections.set(connectionId, conn);

    let userConns = this.userToConnections.get(userId);
    if (!userConns) {
      userConns = new Set<string>();
      this.userToConnections.set(userId, userConns);
    }
    userConns.add(connectionId);

    logger.info(`Registered connection ${connectionId} for user ${userId} (${username}). Total conns for user: ${userConns.size}`);
    return conn;
  }

  unregister(connectionId: string): ClientConnection | null {
    const conn = this.connections.get(connectionId);
    if (!conn) return null;

    if (conn.roomId) {
      this.leaveRoom(connectionId, conn.roomId);
    }

    this.connections.delete(connectionId);

    const userConns = this.userToConnections.get(conn.userId);
    if (userConns) {
      userConns.delete(connectionId);
      if (userConns.size === 0) {
        this.userToConnections.delete(conn.userId);
      }
    }

    logger.info(`Unregistered connection ${connectionId} for user ${conn.userId}`);
    return conn;
  }

  joinRoom(connectionId: string, roomId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;

    conn.roomId = roomId;

    let roomSet = this.roomToConnections.get(roomId);
    if (!roomSet) {
      roomSet = new Set<string>();
      this.roomToConnections.set(roomId, roomSet);
    }
    roomSet.add(connectionId);
    logger.info(`Connection ${connectionId} (user ${conn.userId}) joined room ${roomId}. Room occupants: ${roomSet.size}`);
  }

  leaveRoom(connectionId: string, roomId: string): void {
    const conn = this.connections.get(connectionId);
    if (conn && conn.roomId === roomId) {
      conn.roomId = undefined;
    }

    const roomSet = this.roomToConnections.get(roomId);
    if (roomSet) {
      roomSet.delete(connectionId);
      if (roomSet.size === 0) {
        this.roomToConnections.delete(roomId);
      }
    }
    logger.info(`Connection ${connectionId} left room ${roomId}`);
  }

  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionByUserId(userId: string): ClientConnection | undefined {
    const userConns = this.userToConnections.get(userId);
    if (!userConns || userConns.size === 0) return undefined;
    // Prefer open connection
    for (const cid of userConns) {
      const conn = this.connections.get(cid);
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        return conn;
      }
    }
    return undefined;
  }

  getConnectionsByUserId(userId: string): ClientConnection[] {
    const userConns = this.userToConnections.get(userId);
    if (!userConns) return [];
    const result: ClientConnection[] = [];
    for (const cid of userConns) {
      const conn = this.connections.get(cid);
      if (conn && conn.ws.readyState === WebSocket.OPEN) {
        result.push(conn);
      }
    }
    return result;
  }

  getRoomConnectionIds(roomId: string): string[] {
    const set = this.roomToConnections.get(roomId);
    return set ? Array.from(set) : [];
  }

  getAllConnections(): IterableIterator<ClientConnection> {
    return this.connections.values();
  }

  sendToConnection(connectionId: string, message: ServerMessage): boolean {
    const conn = this.connections.get(connectionId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      conn.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      logger.error(`Failed to send message to ${connectionId}:`, err);
      return false;
    }
  }

  sendToUser(userId: string, message: ServerMessage): boolean {
    const conns = this.getConnectionsByUserId(userId);
    if (conns.length === 0) return false;
    let sent = false;
    for (const conn of conns) {
      if (this.sendToConnection(conn.connectionId, message)) {
        sent = true;
      }
    }
    return sent;
  }

  broadcastToRoom(
    roomId: string,
    message: ServerMessage,
    excludeConnectionId?: string
  ): void {
    const connIds = this.getRoomConnectionIds(roomId);
    logger.info(`Broadcasting ${message.type} to room ${roomId} (recipients: ${connIds.length})`);
    for (const cid of connIds) {
      if (excludeConnectionId && cid === excludeConnectionId) {
        continue;
      }
      this.sendToConnection(cid, message);
    }
  }
}

export const registry = new ConnectionRegistry();
