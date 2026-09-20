import { Card, RANK_PENALTY_MAP, isCardJoker } from './card.js';
import { isPureSequence, validateSequence } from './sequence.js';
import { isValidSet } from './set.js';

export const MAX_PENALTY_POINTS = 80;
export const FIRST_DROP_PENALTY = 20;
export const MIDDLE_DROP_PENALTY = 40;
export const BOGUS_DECLARATION_PENALTY = 80;

export interface PlayerHandScore {
  readonly points: number;
  readonly hasPureSequence: boolean;
  readonly hasSecondSequence: boolean;
  readonly meldedCardCount: number;
  readonly unmeldedCardCount: number;
  readonly breakdown: string;
}

/**
 * Calculates card penalty point value.
 * Jokers (printed or wild) contribute 0 penalty points.
 * Face cards and Aces contribute 10 points.
 * Number cards contribute their face value (2-10).
 */
export function getCardPenaltyPoints(card: Card, wildJoker: Card | null): number {
  if (isCardJoker(card, wildJoker)) {
    return 0;
  }
  return RANK_PENALTY_MAP[card.rank];
}

/**
 * Evaluates an opponent's submitted hand at the end of a round and calculates their penalty points:
 *
 * Case 1: No Pure Sequence
 *   -> All cards are counted as unmelded penalty points (capped at 80).
 *
 * Case 2: Pure Sequence present, but No Second Sequence
 *   -> Only cards in the pure sequence(s) score 0. All other cards (even valid sets) count as penalty points (capped at 80).
 *
 * Case 3: Pure Sequence + Second Sequence present
 *   -> Cards in all valid sequences and sets score 0. Only cards in invalid groups count as penalty points (capped at 80).
 */
export function calculateOpponentPenalty(
  melds: readonly (readonly Card[])[],
  wildJoker: Card | null
): PlayerHandScore {
  const allCards = melds.flat();

  // Find pure sequences
  const pureSequenceIndices = new Set<number>();
  const impureSequenceIndices = new Set<number>();
  const setIndices = new Set<number>();

  for (let i = 0; i < melds.length; i++) {
    const group = melds[i];
    if (!group || group.length < 3) continue;

    if (isPureSequence(group)) {
      pureSequenceIndices.add(i);
      continue;
    }

    const seqRes = validateSequence(group, wildJoker);
    if (seqRes.isValid && !seqRes.isPure) {
      impureSequenceIndices.add(i);
      continue;
    }

    if (isValidSet(group, wildJoker)) {
      setIndices.add(i);
    }
  }

  const hasPure = pureSequenceIndices.size >= 1;
  const totalSequences = pureSequenceIndices.size + impureSequenceIndices.size;
  const hasSecondSeq = totalSequences >= 2;

  let rawPoints = 0;
  let meldedCount = 0;
  let unmeldedCount = 0;
  let breakdown = '';

  if (!hasPure) {
    // Case 1: No pure sequence — all cards are penalized
    for (const card of allCards) {
      rawPoints += getCardPenaltyPoints(card, wildJoker);
    }
    unmeldedCount = allCards.length;
    breakdown = 'No pure sequence: all cards penalized';
  } else if (!hasSecondSeq) {
    // Case 2: Has pure sequence, but missing second sequence — only pure sequences are saved
    for (let i = 0; i < melds.length; i++) {
      const group = melds[i]!;
      if (pureSequenceIndices.has(i)) {
        meldedCount += group.length;
      } else {
        unmeldedCount += group.length;
        for (const card of group) {
          rawPoints += getCardPenaltyPoints(card, wildJoker);
        }
      }
    }
    breakdown = 'Only pure sequence saved; missing second sequence';
  } else {
    // Case 3: Has pure + second sequence — all valid groups are saved
    for (let i = 0; i < melds.length; i++) {
      const group = melds[i]!;
      const isValidMeld = pureSequenceIndices.has(i) || impureSequenceIndices.has(i) || setIndices.has(i);
      if (isValidMeld) {
        meldedCount += group.length;
      } else {
        unmeldedCount += group.length;
        for (const card of group) {
          rawPoints += getCardPenaltyPoints(card, wildJoker);
        }
      }
    }
    breakdown = 'Valid sequences and sets saved; only loose/invalid cards penalized';
  }

  const points = Math.min(rawPoints, MAX_PENALTY_POINTS);

  return {
    points,
    hasPureSequence: hasPure,
    hasSecondSequence: hasSecondSeq,
    meldedCardCount: meldedCount,
    unmeldedCardCount: unmeldedCount,
    breakdown
  };
}
