import crypto from 'node:crypto';
import {
  saveRoomLobby,
  getRoomLobby,
  getRoomIdByCode,
  deleteRoomLobby,
  RoomLobbyState,
  LobbyPlayer,
  withLock,
  getRoomLockKey
} from '@rummy/redis';
import { ErrorCode } from '@rummy/shared';
import { coordinator } from '../ws/room-coordinator.js';
import { registry } from '../ws/connection-registry.js';

export function generateRoomCode(): string {
  // Generate a clean, human-friendly 6-character room code (e.g. RUM482)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'RUM';
  for (let i = 0; i < 3; i++) {
    const idx = crypto.randomInt(0, chars.length);
    code += chars[idx];
  }
  return code;
}

export class RoomService {
  /**
   * Creates a private room lobby and assigns a shareable Room Code.
   */
  async createRoom(
    host: { id: string; username: string },
    maxPlayers: 2 | 6 = 2
  ): Promise<RoomLobbyState> {
    const roomId = `room_${crypto.randomUUID()}`;
    let roomCode = generateRoomCode();

    // Ensure code uniqueness
    let existing = await getRoomIdByCode(roomCode);
    while (existing) {
      roomCode = generateRoomCode();
      existing = await getRoomIdByCode(roomCode);
    }

    const hostPlayer: LobbyPlayer = {
      id: host.id,
      username: host.username,
      isHost: true,
      joinedAt: Date.now()
    };

    const lobby: RoomLobbyState = {
      roomId,
      roomCode,
      hostId: host.id,
      maxPlayers,
      gameVariant: 'POINTS_13',
      players: [hostPlayer],
      status: 'WAITING',
      createdAt: Date.now()
    };

    await saveRoomLobby(lobby);
    return lobby;
  }

  /**
   * Joins a room lobby by either 6-char Room Code or full Room ID.
   */
  async joinRoom(
    user: { id: string; username: string },
    codeOrId: string
  ): Promise<{ lobby: RoomLobbyState; shouldStartGame: boolean }> {
    // 1. Resolve Room ID
    let roomId = codeOrId;
    const resolvedId = await getRoomIdByCode(codeOrId);
    if (resolvedId) {
      roomId = resolvedId;
    }

    return await withLock(getRoomLockKey(roomId), 2500, async () => {
      const lobby = await getRoomLobby(roomId);
      if (!lobby) {
        throw new Error(ErrorCode.ROOM_NOT_FOUND);
      }

      if (lobby.status !== 'WAITING') {
        const existingPlayer = lobby.players.find((p) => p.id === user.id);
        if (existingPlayer) {
          // Rejoining in-progress game
          return { lobby, shouldStartGame: false };
        }
        throw new Error(ErrorCode.GAME_ALREADY_STARTED);
      }

      const existingPlayer = lobby.players.find((p) => p.id === user.id);
      if (!existingPlayer) {
        if (lobby.players.length >= lobby.maxPlayers) {
          throw new Error(ErrorCode.ROOM_FULL);
        }

        lobby.players.push({
          id: user.id,
          username: user.username,
          isHost: false,
          joinedAt: Date.now()
        });

        await saveRoomLobby(lobby);
      }

      const shouldStartGame = lobby.players.length === lobby.maxPlayers;
      return { lobby, shouldStartGame };
    });
  }

  /**
   * Starts game manually on demand (host only, requires >= 2 players).
   */
  async startGame(
    roomId: string,
    requestingUserId: string
  ): Promise<RoomLobbyState> {
    let targetRoomId = roomId;
    const resolved = await getRoomIdByCode(roomId);
    if (resolved) {
      targetRoomId = resolved;
    }

    const lobby = await withLock(getRoomLockKey(targetRoomId), 3000, async () => {
      const currentLobby = await getRoomLobby(targetRoomId);
      if (!currentLobby) throw new Error(ErrorCode.ROOM_NOT_FOUND);

      if (currentLobby.hostId !== requestingUserId) {
        throw new Error(ErrorCode.NOT_ROOM_HOST);
      }

      if (currentLobby.players.length < 2) {
        throw new Error(ErrorCode.NOT_ENOUGH_PLAYERS);
      }

      currentLobby.status = 'IN_PROGRESS';
      await saveRoomLobby(currentLobby);
      return currentLobby;
    });

    // Start authoritative turn loop coordinator (it manages its own lock)
    const playerIds = lobby.players.map((p) => p.id);
    await coordinator.initializeRoom(targetRoomId, playerIds, 0); // No chips involved

    return lobby;
  }

  /**
   * Removes a player from a waiting room lobby.
   */
  async leaveRoom(
    roomId: string,
    userId: string
  ): Promise<RoomLobbyState | null> {
    return await withLock(getRoomLockKey(roomId), 2500, async () => {
      const lobby = await getRoomLobby(roomId);
      if (!lobby || lobby.status !== 'WAITING') return null;

      lobby.players = lobby.players.filter((p) => p.id !== userId);

      if (lobby.players.length === 0) {
        await deleteRoomLobby(roomId, lobby.roomCode);
        return null;
      }

      // Reassign host if host left
      if (lobby.hostId === userId && lobby.players.length > 0) {
        lobby.players[0]!.isHost = true;
        lobby.hostId = lobby.players[0]!.id;
      }

      await saveRoomLobby(lobby);
      return lobby;
    });
  }

  /**
   * Broadcasts room lobby update to all connected participants.
   */
  broadcastLobbyUpdate(lobby: RoomLobbyState): void {
    const canStart = lobby.players.length >= 2;
    registry.broadcastToRoom(lobby.roomId, {
      type: 'ROOM_LOBBY_UPDATE',
      payload: {
        roomId: lobby.roomId,
        roomCode: lobby.roomCode,
        maxPlayers: lobby.maxPlayers,
        players: lobby.players.map((p) => ({
          id: p.id,
          username: p.username,
          isHost: p.isHost
        })),
        canStart
      }
    });
  }
}

export const roomService = new RoomService();
