import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { wallets } from '../schema/index';

export async function getWallet(userId: string) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return wallet ?? null;
}

export async function adjustChips(userId: string, delta: number) {
  const [updated] = await db
    .update(wallets)
    .set({
      chips: sql`${wallets.chips} + ${delta}`,
      updatedAt: new Date()
    })
    .where(eq(wallets.userId, userId))
    .returning();

  return updated ?? null;
}
