import type { Suit, Rank } from '@rummy/shared';

export { Suit, Rank };

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly isPrintedJoker: boolean;
  readonly deckNumber: number; // 1 or 2 in standard 2-deck Indian Rummy
}

export const STANDARD_SUITS: readonly Suit[] = ['HEARTS', 'DIAMONDS', 'CLUBS', 'SPADES'] as const;

export const STANDARD_RANKS: readonly Rank[] = [
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
  'K'
] as const;

export const RANK_VALUE_MAP: Readonly<Record<Rank, number>> = {
  'A': 1, // Can also be 14 in Q-K-A
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'JOKER': 0
};

export const RANK_PENALTY_MAP: Readonly<Record<Rank, number>> = {
  'A': 10,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 10,
  'Q': 10,
  'K': 10,
  'JOKER': 0
};

/**
 * Determines whether a given card functions as a Joker.
 * A card is a Joker if:
 * 1. It is a Printed Joker.
 * 2. It matches the rank of the designated Wild Joker card (unless the cut card was a printed joker, in which case Aces are wild jokers).
 */
export function isCardJoker(card: Card, wildJokerCard: Card | null): boolean {
  if (card.isPrintedJoker || card.rank === 'JOKER') {
    return true;
  }
  if (!wildJokerCard) {
    return false;
  }

  // If the cut card is a printed joker, standard Indian Rummy specifies Aces as wild jokers.
  const effectiveWildRank = wildJokerCard.isPrintedJoker || wildJokerCard.rank === 'JOKER' ? 'A' : wildJokerCard.rank;

  return card.rank === effectiveWildRank;
}

/**
 * Creates a unique card instance.
 */
export function createCard(
  suit: Suit,
  rank: Rank,
  isPrintedJoker = false,
  deckNumber = 1
): Card {
  const id = isPrintedJoker ? `PJ_${deckNumber}_${rank}` : `${suit[0]}_${rank}_${deckNumber}`;
  return Object.freeze({
    id,
    suit,
    rank,
    isPrintedJoker,
    deckNumber
  });
}
