import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db';
import { refreshTokens } from '../schema/index';

export async function saveRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date
) {
  const [token] = await db
    .insert(refreshTokens)
    .values({
      userId,
      tokenHash,
      expiresAt
    })
    .returning();
  return token;
}

export async function findValidRefreshToken(tokenHash: string) {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        eq(refreshTokens.isRevoked, false),
        gt(refreshTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  return token ?? null;
}

export async function revokeRefreshToken(tokenHash: string) {
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.tokenHash, tokenHash));
}

export async function revokeAllUserTokens(userId: string) {
  await db
    .update(refreshTokens)
    .set({ isRevoked: true })
    .where(eq(refreshTokens.userId, userId));
}
