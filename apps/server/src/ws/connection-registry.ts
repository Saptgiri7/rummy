import { WebSocket } from 'ws';
import { ServerMessage } from '@rummy/shared';

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
  private userToConnection = new Map<string, string>();
  private roomToConnections = new Map<string, Set<string>>();

  register(
    ws: WebSocket,
    userId: string,
    connectionId: string,
    username = 'Player'
  ): ClientConnection {
    // If user already had a previous connection, clean it up
    const existingConnId = this.userToConnection.get(userId);
    if (existingConnId && existingConnId !== connectionId) {
      this.unregister(existingConnId);
    }

    const conn: ClientConnection = {
      connectionId,
      userId,
      username,
      ws,
      isAlive: true,
      connectedAt: Date.now()
    };

    this.connections.set(connectionId, conn);
    this.userToConnection.set(userId, connectionId);

    return conn;
  }

  unregister(connectionId: string): ClientConnection | null {
    const conn = this.connections.get(connectionId);
    if (!conn) return null;

    if (conn.roomId) {
      this.leaveRoom(connectionId, conn.roomId);
    }

    this.connections.delete(connectionId);
    if (this.userToConnection.get(conn.userId) === connectionId) {
      this.userToConnection.delete(conn.userId);
    }

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
  }

  getConnection(connectionId: string): ClientConnection | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionByUserId(userId: string): ClientConnection | undefined {
    const connId = this.userToConnection.get(userId);
    if (!connId) return undefined;
    return this.connections.get(connId);
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
      console.error(`[WS] Failed to send message to ${connectionId}:`, err);
      return false;
    }
  }

  sendToUser(userId: string, message: ServerMessage): boolean {
    const conn = this.getConnectionByUserId(userId);
    if (!conn) return false;
    return this.sendToConnection(conn.connectionId, message);
  }

  broadcastToRoom(
    roomId: string,
    message: ServerMessage,
    excludeConnectionId?: string
  ): void {
    const connIds = this.getRoomConnectionIds(roomId);
    for (const cid of connIds) {
      if (excludeConnectionId && cid === excludeConnectionId) {
        continue;
      }
      this.sendToConnection(cid, message);
    }
  }
}

export const registry = new ConnectionRegistry();
