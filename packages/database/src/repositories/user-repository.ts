import { eq, or, count, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { users, wallets, matches, matchPlayers } from '../schema/index';

export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
  initialChips = 10000,
  phone?: string | null,
  role: 'USER' | 'ADMIN' = 'USER',
  isVerified = false
) {
  return await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username,
        email,
        phone: phone ?? null,
        passwordHash,
        role,
        isVerified
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

export async function findUserByPhone(phone: string) {
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
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

export async function findUserByIdentifier(identifier: string) {
  const clean = identifier.trim();
  const [user] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.username, clean),
        eq(users.email, clean),
        eq(users.phone, clean)
      )
    )
    .limit(1);
  return user ?? null;
}

export async function updateUserVerification(userId: string, isVerified = true) {
  const [user] = await db
    .update(users)
    .set({ isVerified, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
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
    phone: user.phone ?? null,
    role: (user.role ?? 'USER') as 'USER' | 'ADMIN',
    isVerified: Boolean(user.isVerified),
    chips: wallet?.chips ?? 0,
    gamesPlayed: Number(playedResult?.value ?? 0),
    gamesWon: Number(wonResult?.value ?? 0),
    createdAt: user.createdAt.toISOString()
  };
}

export async function getAdminPlatformMetrics() {
  const [totalUsersRes] = await db.select({ value: count() }).from(users);
  const [verifiedUsersRes] = await db.select({ value: count() }).from(users).where(eq(users.isVerified, true));
  const [totalMatchesRes] = await db.select({ value: count() }).from(matches);
  const [totalChipsRes] = await db.select({ value: sql<string>`coalesce(sum(${wallets.chips}), 0)` }).from(wallets);
  const [phoneUsersRes] = await db.select({ value: count() }).from(users).where(sql`${users.phone} is not null`);

  const totalUsers = Number(totalUsersRes?.value ?? 0);
  const verifiedUsers = Number(verifiedUsersRes?.value ?? 0);
  const totalMatches = Number(totalMatchesRes?.value ?? 0);
  const totalChips = Number(totalChipsRes?.value ?? 0);
  const phoneUsers = Number(phoneUsersRes?.value ?? 0);
  const emailUsers = totalUsers;

  return {
    totalUsers,
    verifiedUsers,
    phoneUsers,
    emailUsers,
    totalMatches,
    totalChips
  };
}

export async function listUsersForAdmin(limit = 50, offset = 0) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      phone: users.phone,
      role: users.role,
      isVerified: users.isVerified,
      createdAt: users.createdAt,
      chips: wallets.chips
    })
    .from(users)
    .leftJoin(wallets, eq(users.id, wallets.userId))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    email: r.email,
    phone: r.phone ?? null,
    role: (r.role ?? 'USER') as 'USER' | 'ADMIN',
    isVerified: Boolean(r.isVerified),
    chips: r.chips ?? 0,
    createdAt: r.createdAt.toISOString()
  }));
}

export async function updateUsername(userId: string, newUsername: string) {
  const [user] = await db
    .update(users)
    .set({ username: newUsername, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return user ?? null;
}
