import { z } from 'zod';

export const SuitSchema = z.enum(['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES', 'NONE']);
export type Suit = z.infer<typeof SuitSchema>;

export const RankSchema = z.enum([
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'JOKER'
]);
export type Rank = z.infer<typeof RankSchema>;

export const CardDtoSchema = z.object({
  id: z.string().min(1),
  suit: SuitSchema,
  rank: RankSchema,
  isPrintedJoker: z.boolean(),
  deckNumber: z.number().int().min(1).max(4).default(1),
  points: z.number().int().min(0).max(10).optional()
});
export type CardDto = z.infer<typeof CardDtoSchema>;
