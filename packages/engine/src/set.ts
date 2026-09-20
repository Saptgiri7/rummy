import { Card, isCardJoker } from './card.js';

export interface SetValidationResult {
  readonly isValid: boolean;
  readonly rank?: string;
  readonly length: number;
  readonly reason?: string;
}

/**
 * Validates whether an array of cards forms a valid Set:
 * 1. Must contain 3 or 4 cards.
 * 2. All natural (non-joker) cards must have the exact same rank.
 * 3. All natural cards must have distinct suits (no duplicate suits, e.g., 7♠ and 7♠ is invalid).
 * 4. At least one natural card must exist to anchor the rank.
 * 5. Jokers (printed or wild) substitute for missing suits.
 */
export function isValidSet(cards: readonly Card[], wildJoker: Card | null): boolean {
  if (cards.length < 3 || cards.length > 4) {
    return false;
  }

  const naturals: Card[] = [];
  const jokers: Card[] = [];

  for (const card of cards) {
    if (isCardJoker(card, wildJoker)) {
      jokers.push(card);
    } else {
      naturals.push(card);
    }
  }

  // Need at least one natural card to anchor the rank
  if (naturals.length === 0) {
    return false;
  }

  const targetRank = naturals[0]?.rank;
  if (!targetRank || targetRank === 'JOKER') {
    return false;
  }

  const seenSuits = new Set<string>();

  for (const card of naturals) {
    // All natural cards must have the same rank
    if (card.rank !== targetRank) {
      return false;
    }

    // Duplicate suits are strictly prohibited in a set (e.g., 7♠ and 7♠ in 2-deck game)
    if (seenSuits.has(card.suit)) {
      return false;
    }

    seenSuits.add(card.suit);
  }

  // Total distinct cards + jokers must equal cards.length (which is 3 or 4)
  // And the number of natural suits cannot exceed 4
  return seenSuits.size + jokers.length === cards.length && seenSuits.size + jokers.length <= 4;
}

/**
 * High-level set validation with detailed result object.
 */
export function validateSet(cards: readonly Card[], wildJoker: Card | null): SetValidationResult {
  if (cards.length < 3 || cards.length > 4) {
    return {
      isValid: false,
      length: cards.length,
      reason: `A set must contain exactly 3 or 4 cards, got ${cards.length}`
    };
  }

  if (isValidSet(cards, wildJoker)) {
    const natural = cards.find((c) => !isCardJoker(c, wildJoker));
    return {
      isValid: true,
      rank: natural?.rank,
      length: cards.length
    };
  }

  return {
    isValid: false,
    length: cards.length,
    reason: 'Cards do not form a valid set of distinct suits and identical rank'
  };
}
