import { db } from '../db';
import { matches, matchPlayers, wallets } from '../schema/index';
import { sql, eq } from 'drizzle-orm';

export interface PlayerSettlement {
  userId: string;
  score: number;
  chipDelta: number;
  status: string;
}

export async function recordCompletedMatch(
  roomId: string,
  stake: number,
  winnerId: string,
  players: PlayerSettlement[],
  gameVariant = 'POINTS_13'
) {
  return await db.transaction(async (tx) => {
    // 1. Create match record
    const [match] = await tx
      .insert(matches)
      .values({
        roomId,
        stake,
        gameVariant,
        winnerId,
        endedAt: new Date()
      })
      .returning();

    if (!match) throw new Error('Failed to record match');

    // 2. Insert match players
    for (const p of players) {
      await tx.insert(matchPlayers).values({
        matchId: match.id,
        userId: p.userId,
        score: p.score,
        chipDelta: p.chipDelta,
        status: p.status
      });

      // 3. Atomically update wallet
      await tx
        .update(wallets)
        .set({
          chips: sql`${wallets.chips} + ${p.chipDelta}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.userId, p.userId));
    }

    return match;
  });
}
