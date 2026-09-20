import { eq, count } from 'drizzle-orm';
import { db } from '../db';
import { users, wallets, matches, matchPlayers } from '../schema/index';

export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
  initialChips = 10000
) {
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username,
        email,
        passwordHash
      })
      .returning();

    if (!user) throw new Error('Failed to create user record');

    const [wallet] = await tx
      .insert(wallets)
      .values({
        userId: user.id,
        chips: initialChips
      })
      .returning();

    if (!wallet) throw new Error('Failed to create wallet record');

    return {
      user,
      wallet
    };
  });
}

export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function findUserById(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function findUserByUsername(username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return user ?? null;
}

export async function getUserProfile(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, id)).limit(1);

  // Aggregated stats from matchPlayers and matches
  const [playedResult] = await db
    .select({ value: count() })
    .from(matchPlayers)
    .where(eq(matchPlayers.userId, id));

  const [wonResult] = await db
    .select({ value: count() })
    .from(matches)
    .where(eq(matches.winnerId, id));

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    chips: wallet?.chips ?? 0,
    gamesPlayed: Number(playedResult?.value ?? 0),
    gamesWon: Number(wonResult?.value ?? 0),
    createdAt: user.createdAt.toISOString()
  };
}
