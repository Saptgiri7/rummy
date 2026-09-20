import { describe, it, expect, afterAll } from 'vitest';
import {
  checkRedisHealth,
  closeRedis,
  acquireLock,
  releaseLock,
  withLock,
  saveRoomState,
  getRoomState,
  deleteRoomState,
  setUserActiveRoom,
  getUserActiveRoom,
  clearUserActiveRoom,
  publishRoomEvent,
  createSubscriberClient,
  getRoomLockKey,
  getRoomEventChannel
} from '../index';
import {
  createStandardRummyDeck,
  dealInitialGame,
  createInitialRoundState
} from '@rummy/engine';

describe('Redis Connection & Health', () => {
  it('connects to Redis and responds to ping', async () => {
    const isHealthy = await checkRedisHealth();
    expect(isHealthy).toBe(true);
  });
});

describe('Distributed Mutex Locks', () => {
  const testLockKey = getRoomLockKey('test_room_101');

  it('acquires and releases exclusive lock', async () => {
    const handle = await acquireLock(testLockKey, 3000);
    expect(handle).not.toBeNull();
    expect(handle?.lockId).toBeDefined();

    // Second acquisition on same key must fail
    const blockedHandle = await acquireLock(testLockKey, 3000);
    expect(blockedHandle).toBeNull();

    // Release lock
    const released = await releaseLock(handle!);
    expect(released).toBe(true);

    // Now acquisition succeeds again
    const reacquired = await acquireLock(testLockKey, 3000);
    expect(reacquired).not.toBeNull();
    await releaseLock(reacquired!);
  });

  it('prevents releasing lock with wrong lockId (anti-tamper safety)', async () => {
    const handle = await acquireLock(testLockKey, 3000);
    expect(handle).not.toBeNull();

    const bogusHandle = {
      resourceKey: handle!.resourceKey,
      lockId: 'fake-uuid-not-owner',
      ttlMs: 3000
    };

    const released = await releaseLock(bogusHandle);
    expect(released).toBe(false);

    // Clean up actual lock
    await releaseLock(handle!);
  });

  it('withLock executes callback and automatically cleans up lock', async () => {
    let executed = false;
    const res = await withLock(testLockKey, 2000, async () => {
      executed = true;
      return 42;
    });

    expect(executed).toBe(true);
    expect(res).toBe(42);

    // Verify lock was released
    const nextHandle = await acquireLock(testLockKey, 1000);
    expect(nextHandle).not.toBeNull();
    await releaseLock(nextHandle!);
  });
});

describe('Room State Store', () => {
  const roomId = 'room_state_test_202';
  const players = ['usr_alice', 'usr_bob'];

  it('saves and retrieves active GameRoundState', async () => {
    const deck = createStandardRummyDeck(2);
    const deal = dealInitialGame(deck, 2);
    const initialRound = createInitialRoundState(roomId, players, deal, 0);

    await saveRoomState(initialRound, 60);

    const retrieved = await getRoomState(roomId);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.roomId).toBe(roomId);
    expect(retrieved?.activePlayerId).toBe('usr_alice');
    expect(retrieved?.playerHands['usr_alice']).toHaveLength(13);
    expect(retrieved?.wildJoker.id).toBe(initialRound.wildJoker.id);

    await deleteRoomState(roomId);
    const afterDelete = await getRoomState(roomId);
    expect(afterDelete).toBeNull();
  });

  it('manages user active room routing', async () => {
    const userId = 'usr_alice';
    await setUserActiveRoom(userId, roomId, 60);

    const activeRoom = await getUserActiveRoom(userId);
    expect(activeRoom).toBe(roomId);

    await clearUserActiveRoom(userId);
    const cleared = await getUserActiveRoom(userId);
    expect(cleared).toBeNull();
  });
});

describe('Redis Pub/Sub', () => {
  it('publishes and receives room events across connections', async () => {
    const subscriber = createSubscriberClient();
    const testRoomId = 'room_pubsub_303';
    const channel = getRoomEventChannel(testRoomId);

    const receivedEvents: any[] = [];

    await subscriber.subscribe(channel);
    subscriber.on('message', (_chan, msg) => {
      receivedEvents.push(JSON.parse(msg));
    });

    // Small delay to ensure subscription is established in Redis
    await new Promise((r) => setTimeout(r, 100));

    const testEvent = { type: 'CARD_DRAWN', playerId: 'usr_alice', source: 'CLOSED' };
    await publishRoomEvent(testRoomId, testEvent);

    // Wait for event delivery
    await new Promise((r) => setTimeout(r, 150));

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]?.type).toBe('CARD_DRAWN');
    expect(receivedEvents[0]?.playerId).toBe('usr_alice');

    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  });

  afterAll(async () => {
    await closeRedis();
  });
});
