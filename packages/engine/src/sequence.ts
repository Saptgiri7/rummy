import { Card, RANK_VALUE_MAP, isCardJoker } from './card.js';

export interface SequenceValidationResult {
  readonly isValid: boolean;
  readonly isPure: boolean;
  readonly suit?: string;
  readonly length: number;
  readonly reason?: string;
}

/**
 * Validates whether an array of cards forms a Pure Sequence:
 * 1. Must contain at least 3 cards.
 * 2. All cards must be of the same non-NONE suit.
 * 3. No Printed Jokers allowed.
 * 4. Wild Jokers can only be used as their natural suit and rank (no wildcard substitution).
 * 5. Cards must form strictly consecutive ranks with no duplicates.
 * 6. Ace can be low (A-2-3) or high (10-J-Q-K-A), but round-the-corner (K-A-2) is invalid.
 */
export function isPureSequence(cards: readonly Card[]): boolean {
  if (cards.length < 3) {
    return false;
  }

  const firstSuit = cards[0]?.suit;
  if (!firstSuit || firstSuit === 'NONE') {
    return false;
  }

  // All cards must share the exact same suit and must not be printed jokers
  for (const card of cards) {
    if (card.suit !== firstSuit || card.isPrintedJoker || card.rank === 'JOKER') {
      return false;
    }
  }

  // Check low-Ace sequence (A=1 ... K=13)
  const lowValues = cards.map((c) => RANK_VALUE_MAP[c.rank]);
  if (isConsecutive(lowValues)) {
    return true;
  }

  // Check high-Ace sequence (A=14, 10=10, J=11, Q=12, K=13)
  const hasAce = cards.some((c) => c.rank === 'A');
  if (hasAce) {
    const highValues = cards.map((c) => (c.rank === 'A' ? 14 : RANK_VALUE_MAP[c.rank]));
    if (isConsecutive(highValues)) {
      return true;
    }
  }

  return false;
}

function isConsecutive(values: number[]): boolean {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr === undefined || next === undefined || next - curr !== 1) {
      return false;
    }
  }
  return true;
}

/**
 * Validates whether an array of cards forms an Impure Sequence:
 * 1. Must contain at least 3 cards.
 * 2. At least one natural (non-joker) card to anchor the suit.
 * 3. All natural cards must share the same non-NONE suit.
 * 4. No duplicate ranks among natural cards.
 * 5. Jokers (printed or wild) substitute for missing ranks.
 * 6. Fits within valid rank boundaries ([1, 13] for low-Ace or [2, 14] for high-Ace).
 */
export function isImpureSequence(cards: readonly Card[], wildJoker: Card | null): boolean {
  if (cards.length < 3) {
    return false;
  }

  const jokers: Card[] = [];
  const naturals: Card[] = [];

  for (const card of cards) {
    if (isCardJoker(card, wildJoker)) {
      jokers.push(card);
    } else {
      naturals.push(card);
    }
  }

  // Must have at least one natural card to anchor the sequence's suit
  if (naturals.length === 0) {
    return false;
  }

  const sequenceSuit = naturals[0]?.suit;
  if (!sequenceSuit || sequenceSuit === 'NONE') {
    return false;
  }

  // All natural cards must belong to the sequence's suit
  for (const card of naturals) {
    if (card.suit !== sequenceSuit) {
      return false;
    }
  }

  const totalLength = cards.length;

  // Check low-Ace representation
  const lowValues = naturals.map((c) => RANK_VALUE_MAP[c.rank]);
  if (canFormSequenceWindow(lowValues, totalLength, 1, 13)) {
    return true;
  }

  // Check high-Ace representation (A = 14)
  const highValues = naturals.map((c) => (c.rank === 'A' ? 14 : RANK_VALUE_MAP[c.rank]));
  if (canFormSequenceWindow(highValues, totalLength, 2, 14)) {
    return true;
  }

  return false;
}

/**
 * Helper to determine if a list of distinct natural values can fit inside a consecutive
 * window of size `targetLength` strictly bounded within [minBound, maxBound].
 */
function canFormSequenceWindow(
  values: number[],
  targetLength: number,
  minBound: number,
  maxBound: number
): boolean {
  const sorted = [...values].sort((a, b) => a - b);

  // Reject duplicate natural ranks
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i] === sorted[i + 1]) {
      return false;
    }
  }

  const minVal = sorted[0];
  const maxVal = sorted[sorted.length - 1];
  if (minVal === undefined || maxVal === undefined) {
    return false;
  }

  // The span of natural cards cannot exceed the target sequence length
  const naturalSpan = maxVal - minVal + 1;
  if (naturalSpan > targetLength) {
    return false;
  }

  // The sequence must be able to fit within [minBound, maxBound]
  // Possible starting positions for a window of size targetLength:
  // windowStart >= minBound
  // windowStart <= minVal (must include minVal)
  // windowEnd = windowStart + targetLength - 1
  // windowEnd >= maxVal (must include maxVal) => windowStart >= maxVal - targetLength + 1
  // windowEnd <= maxBound => windowStart <= maxBound - targetLength + 1
  const startMin = Math.max(minBound, maxVal - targetLength + 1);
  const startMax = Math.min(minVal, maxBound - targetLength + 1);

  return startMin <= startMax;
}

/**
 * High-level sequence validator: Checks pure sequence first, then impure sequence.
 */
export function validateSequence(
  cards: readonly Card[],
  wildJoker: Card | null
): SequenceValidationResult {
  if (cards.length < 3) {
    return { isValid: false, isPure: false, length: cards.length, reason: 'Sequence must have at least 3 cards' };
  }

  if (isPureSequence(cards)) {
    return { isValid: true, isPure: true, suit: cards[0]?.suit, length: cards.length };
  }

  if (isImpureSequence(cards, wildJoker)) {
    const natural = cards.find((c) => !isCardJoker(c, wildJoker));
    return { isValid: true, isPure: false, suit: natural?.suit, length: cards.length };
  }

  return { isValid: false, isPure: false, length: cards.length, reason: 'Cards do not form a valid pure or impure sequence' };
}
