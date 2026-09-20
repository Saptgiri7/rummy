import { Redis, RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env['REDIS_URL'] || 'redis://localhost:6379';

const defaultOptions: RedisOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: false,
  enableReadyCheck: true
};

export function createRedisClient(options?: RedisOptions): Redis {
  const client = new Redis(REDIS_URL, {
    ...defaultOptions,
    ...options
  });

  client.on('error', (err) => {
    console.error('[REDIS] Connection error:', err.message);
  });

  return client;
}

export const redis = createRedisClient();

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const res = await redis.ping();
    return res === 'PONG';
  } catch (_err) {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
