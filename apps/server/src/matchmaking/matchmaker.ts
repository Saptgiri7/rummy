import crypto from 'node:crypto';
import { redis, getMatchmakingQueueKey, getUserQueueKey } from '@rummy/redis';
import { coordinator } from '../ws/room-coordinator.js';
import { registry } from '../ws/connection-registry.js';
import { ServerMessage } from '@rummy/shared';

const MATCH_POP_LUA = `
local count = redis.call('ZCARD', KEYS[1])
local needed = tonumber(ARGV[1])
if count >= needed then
  local players = redis.call('ZRANGE', KEYS[1], 0, needed - 1)
  redis.call('ZREMRANGEBYRANK', KEYS[1], 0, needed - 1)
  return players
else
  return nil
end
`;

export class Matchmaker {
  /**
   * Enqueues a player into a public matchmaking queue.
   */
  async enqueue(
    userId: string,
    maxPlayers: 2 | 6 = 2
  ): Promise<{ matched: boolean; roomId?: string; players?: string[] }> {
    const queueKey = getMatchmakingQueueKey('POINTS_13', maxPlayers);
    const userQueueKey = getUserQueueKey(userId);

    // 1. Add player to ZSET queue with current timestamp
    await redis.zadd(queueKey, Date.now(), userId);
    await redis.set(userQueueKey, queueKey, 'EX', 1800);

    // Send QUEUED status
    const queuedMsg: ServerMessage = {
      type: 'MATCHMAKING_STATUS',
      payload: {
        status: 'QUEUED',
        queueTimeSec: 0
      }
    };
    registry.sendToUser(userId, queuedMsg);

    // 2. Run atomic Lua script to check if match can be formed
    const result = (await redis.eval(
      MATCH_POP_LUA,
      1,
      queueKey,
      maxPlayers
    )) as string[] | null;

    if (result && Array.isArray(result) && result.length === maxPlayers) {
      const roomId = `room_mm_${crypto.randomUUID()}`;

      // Clean up reverse index for matched players
      for (const pid of result) {
        await redis.del(getUserQueueKey(pid));
        const matchedMsg: ServerMessage = {
          type: 'MATCHMAKING_STATUS',
          payload: {
            status: 'MATCHED',
            queueTimeSec: 0
          }
        };
        registry.sendToUser(pid, matchedMsg);
      }

      // Initialize authoritative room with 0 stake (no chips involved)
      await coordinator.initializeRoom(roomId, result, 0);

      return { matched: true, roomId, players: result };
    }

    return { matched: false };
  }

  /**
   * Removes a player from the matchmaking queue.
   */
  async dequeue(userId: string): Promise<boolean> {
    const userQueueKey = getUserQueueKey(userId);
    const queueKey = await redis.get(userQueueKey);

    if (queueKey) {
      await redis.zrem(queueKey, userId);
      await redis.del(userQueueKey);

      const cancelledMsg: ServerMessage = {
        type: 'MATCHMAKING_STATUS',
        payload: {
          status: 'CANCELLED',
          queueTimeSec: 0
        }
      };
      registry.sendToUser(userId, cancelledMsg);
      return true;
    }

    return false;
  }

  /**
   * Cleans up queue if player's socket drops.
   */
  async handleDisconnect(userId: string): Promise<void> {
    await this.dequeue(userId);
  }
}

export const matchmaker = new Matchmaker();
