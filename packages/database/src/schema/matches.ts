import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: varchar('room_id', { length: 100 }).notNull().unique(),
  gameVariant: varchar('game_variant', { length: 50 }).default('POINTS_13').notNull(),
  stake: integer('stake').default(10).notNull(),
  winnerId: uuid('winner_id').references(() => users.id),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true })
});

export const matchPlayers = pgTable('match_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id')
    .notNull()
    .references(() => matches.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  score: integer('score').default(0).notNull(),
  chipDelta: integer('chip_delta').default(0).notNull(),
  status: varchar('status', { length: 50 }).default('COMPLETED').notNull()
});

export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchPlayer = typeof matchPlayers.$inferSelect;
export type NewMatchPlayer = typeof matchPlayers.$inferInsert;
