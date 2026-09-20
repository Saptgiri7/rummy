import { GameRoundState } from '@rummy/engine';
import { redis } from './client';
import { getRoomStateKey, getUserActiveRoomKey } from './keys';

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
