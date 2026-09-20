import { Redis } from 'ioredis';
import { redis, createRedisClient } from './client';
import { getRoomEventChannel } from './keys';

/**
 * Publishes an event to a room's Redis Pub/Sub channel.
 */
export async function publishRoomEvent(roomId: string, event: unknown): Promise<number> {
  const channel = getRoomEventChannel(roomId);
  const payload = JSON.stringify(event);
  return await redis.publish(channel, payload);
}

/**
 * Creates an independent Redis subscriber client for listening to room events.
 */
export function createSubscriberClient(): Redis {
  return createRedisClient();
}
