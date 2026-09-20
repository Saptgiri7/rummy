import { describe, it, expect, afterAll } from 'vitest';
import { db, closeDb, createUser, findUserByEmail, getUserProfile, getWallet } from '../index';

describe('Database Repositories & Connection', () => {
  afterAll(async () => {
    await closeDb();
  });

  const timestamp = Date.now();
  const testUser = {
    username: `db_user_${timestamp}`,
    email: `db_user_${timestamp}@example.com`,
    passwordHash: 'hashed_password_sample'
  };

  it('creates user and initializes wallet with 10,000 chips', async () => {
    const { user, wallet } = await createUser(
      testUser.username,
      testUser.email,
      testUser.passwordHash,
      10000
    );

    expect(user.id).toBeDefined();
    expect(user.username).toBe(testUser.username);
    expect(user.email).toBe(testUser.email);
    expect(wallet.userId).toBe(user.id);
    expect(wallet.chips).toBe(10000);
  });

  it('finds user by email', async () => {
    const found = await findUserByEmail(testUser.email);
    expect(found).not.toBeNull();
    expect(found?.username).toBe(testUser.username);
  });

  it('retrieves user profile with wallet balance and stats', async () => {
    const found = await findUserByEmail(testUser.email);
    expect(found).not.toBeNull();

    const profile = await getUserProfile(found!.id);
    expect(profile).not.toBeNull();
    expect(profile?.chips).toBe(10000);
    expect(profile?.gamesPlayed).toBe(0);
    expect(profile?.gamesWon).toBe(0);
  });
});
