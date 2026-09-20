import crypto from 'node:crypto';
import { redis } from './client';

// Atomic Lua script: only delete the key if the value matches the lockId
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface LockHandle {
  readonly resourceKey: string;
  readonly lockId: string;
  readonly ttlMs: number;
}

/**
 * Attempts to acquire an exclusive distributed lock on a resource.
 * Uses atomic SET resourceKey lockId PX ttlMs NX.
 * Returns LockHandle if successful, or null if already held.
 */
export async function acquireLock(
  resourceKey: string,
  ttlMs = 2000
): Promise<LockHandle | null> {
  const lockId = crypto.randomUUID();

  // ioredis SET with 'PX' and 'NX'
  const result = await redis.set(resourceKey, lockId, 'PX', ttlMs, 'NX');

  if (result === 'OK') {
    return Object.freeze({
      resourceKey,
      lockId,
      ttlMs
    });
  }

  return null;
}

/**
 * Releases a held lock atomically using a Lua script.
 * Guarantees that only the owner who acquired the lock can release it.
 */
export async function releaseLock(handle: LockHandle): Promise<boolean> {
  const result = await redis.eval(
    RELEASE_LOCK_LUA,
    1,
    handle.resourceKey,
    handle.lockId
  );
  return result === 1;
}

/**
 * Higher-order helper: acquires lock, runs the provided callback,
 * and guarantees release in a finally block.
 */
export async function withLock<T>(
  resourceKey: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const handle = await acquireLock(resourceKey, ttlMs);
  if (!handle) {
    throw new Error(`Failed to acquire lock for resource: ${resourceKey}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(handle);
  }
}
