import { GameRoundState } from '@rummy/engine';
import { redis } from './client.js';
import {
  getRoomStateKey,
  getUserActiveRoomKey,
  getRoomLobbyKey,
  getRoomCodeKey
} from './keys.js';

export interface LobbyPlayer {
  id: string;
  username: string;
  isHost: boolean;
  joinedAt: number;
}

export interface RoomLobbyState {
  roomId: string;
  roomCode: string;
  hostId: string;
  maxPlayers: number;
  gameVariant: string;
  players: LobbyPlayer[];
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: number;
}

/**
 * Saves the ephemeral active GameRoundState to Redis with a rolling TTL.
 */
export async function saveRoomState(
  state: GameRoundState,
  ttlSeconds = 3600
): Promise<void> {
  const key = getRoomStateKey(state.roomId);
  const serialized = JSON.stringify(state);
  await redis.set(key, serialized, 'EX', ttlSeconds);
}

/**
 * Retrieves the GameRoundState from Redis.
 */
export async function getRoomState(
  roomId: string
): Promise<GameRoundState | null> {
  const key = getRoomStateKey(roomId);
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as GameRoundState;
}

/**
 * Deletes room state from Redis upon game completion or teardown.
 */
export async function deleteRoomState(roomId: string): Promise<void> {
  const key = getRoomStateKey(roomId);
  await redis.del(key);
}

/**
 * Saves or updates a waiting room lobby in Redis.
 */
export async function saveRoomLobby(
  lobby: RoomLobbyState,
  ttlSeconds = 7200
): Promise<void> {
  const lobbyKey = getRoomLobbyKey(lobby.roomId);
  const codeKey = getRoomCodeKey(lobby.roomCode);

  await redis.set(lobbyKey, JSON.stringify(lobby), 'EX', ttlSeconds);
  await redis.set(codeKey, lobby.roomId, 'EX', ttlSeconds);
}

/**
 * Retrieves room lobby state by roomId.
 */
export async function getRoomLobby(
  roomId: string
): Promise<RoomLobbyState | null> {
  const key = getRoomLobbyKey(roomId);
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as RoomLobbyState;
}

/**
 * Resolves a 6-character room code to its corresponding roomId.
 */
export async function getRoomIdByCode(
  roomCode: string
): Promise<string | null> {
  const codeKey = getRoomCodeKey(roomCode);
  return await redis.get(codeKey);
}

/**
 * Deletes room lobby state and code mapping from Redis.
 */
export async function deleteRoomLobby(
  roomId: string,
  roomCode?: string
): Promise<void> {
  const lobbyKey = getRoomLobbyKey(roomId);
  await redis.del(lobbyKey);

  if (roomCode) {
    const codeKey = getRoomCodeKey(roomCode);
    await redis.del(codeKey);
  }
}

/**
 * Tracks the current room for a player for reconnection routing.
 */
export async function setUserActiveRoom(
  userId: string,
  roomId: string,
  ttlSeconds = 3600
): Promise<void> {
  const key = getUserActiveRoomKey(userId);
  await redis.set(key, roomId, 'EX', ttlSeconds);
}

export async function getUserActiveRoom(
  userId: string
): Promise<string | null> {
  const key = getUserActiveRoomKey(userId);
  return await redis.get(key);
}

export async function clearUserActiveRoom(userId: string): Promise<void> {
  const key = getUserActiveRoomKey(userId);
  await redis.del(key);
}
