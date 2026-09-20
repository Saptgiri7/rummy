import { Card } from './card.js';
import { isPureSequence, validateSequence } from './sequence.js';
import { isValidSet } from './set.js';

export interface GroupValidationStatus {
  readonly groupIndex: number;
  readonly cardCount: number;
  readonly isValid: boolean;
  readonly type: 'PURE_SEQUENCE' | 'IMPURE_SEQUENCE' | 'SET' | 'INVALID';
  readonly reason?: string;
}

export interface DeclarationResult {
  readonly isValid: boolean;
  readonly hasPureSequence: boolean;
  readonly hasSecondSequence: boolean;
  readonly groupStatuses: readonly GroupValidationStatus[];
  readonly penaltyPoints: number; // 0 if valid, 80 if invalid declaration
  readonly reason?: string;
}

/**
 * Validates a complete 13-card Indian Rummy declaration.
 *
 * Requirements for a valid show:
 * 1. Total card count across all melds must equal exactly 13.
 * 2. Every individual card in the declaration must be unique (no duplicate card instances).
 * 3. At least one Pure Sequence (mandatory first life).
 * 4. At least a second Sequence (Pure or Impure, mandatory second life).
 * 5. All remaining melds must be either valid sequences or valid sets.
 */
export function validateDeclaration(
  melds: readonly (readonly Card[])[],
  wildJoker: Card | null
): DeclarationResult {
  // Check total card count
  const totalCards = melds.reduce((sum, g) => sum + g.length, 0);
  if (totalCards !== 13) {
    return {
      isValid: false,
      hasPureSequence: false,
      hasSecondSequence: false,
      groupStatuses: [],
      penaltyPoints: 80,
      reason: `A declaration must contain exactly 13 cards, got ${totalCards}`
    };
  }

  // Check card uniqueness
  const cardIds = new Set<string>();
  for (const group of melds) {
    for (const card of group) {
      if (cardIds.has(card.id)) {
        return {
          isValid: false,
          hasPureSequence: false,
          hasSecondSequence: false,
          groupStatuses: [],
          penaltyPoints: 80,
          reason: `Duplicate card detected in hand: ${card.id}`
        };
      }
      cardIds.add(card.id);
    }
  }

  const groupStatuses: GroupValidationStatus[] = [];
  let pureSequenceCount = 0;
  let impureSequenceCount = 0;
  let setCount = 0;
  let invalidGroupCount = 0;

  for (let i = 0; i < melds.length; i++) {
    const group = melds[i];
    if (!group || group.length < 3) {
      groupStatuses.push({
        groupIndex: i,
        cardCount: group?.length ?? 0,
        isValid: false,
        type: 'INVALID',
        reason: 'Each group must contain at least 3 cards'
      });
      invalidGroupCount++;
      continue;
    }

    if (isPureSequence(group)) {
      groupStatuses.push({
        groupIndex: i,
        cardCount: group.length,
        isValid: true,
        type: 'PURE_SEQUENCE'
      });
      pureSequenceCount++;
      continue;
    }

    const seqResult = validateSequence(group, wildJoker);
    if (seqResult.isValid && !seqResult.isPure) {
      groupStatuses.push({
        groupIndex: i,
        cardCount: group.length,
        isValid: true,
        type: 'IMPURE_SEQUENCE'
      });
      impureSequenceCount++;
      continue;
    }

    if (isValidSet(group, wildJoker)) {
      groupStatuses.push({
        groupIndex: i,
        cardCount: group.length,
        isValid: true,
        type: 'SET'
      });
      setCount++;
      continue;
    }

    groupStatuses.push({
      groupIndex: i,
      cardCount: group.length,
      isValid: false,
      type: 'INVALID',
      reason: 'Group is neither a valid sequence nor a valid set'
    });
    invalidGroupCount++;
  }

  const totalSequences = pureSequenceCount + impureSequenceCount;
  const hasPureSequence = pureSequenceCount >= 1;
  const hasSecondSequence = totalSequences >= 2;

  if (invalidGroupCount > 0) {
    return {
      isValid: false,
      hasPureSequence,
      hasSecondSequence,
      groupStatuses,
      penaltyPoints: 80,
      reason: 'Hand contains one or more invalid melds'
    };
  }

  if (!hasPureSequence) {
    return {
      isValid: false,
      hasPureSequence: false,
      hasSecondSequence,
      groupStatuses,
      penaltyPoints: 80,
      reason: 'Missing mandatory Pure Sequence (First Life)'
    };
  }

  if (!hasSecondSequence) {
    return {
      isValid: false,
      hasPureSequence: true,
      hasSecondSequence: false,
      groupStatuses,
      penaltyPoints: 80,
      reason: 'Missing mandatory Second Sequence (Second Life)'
    };
  }

  // All groups are valid melds, pure sequence exists, second sequence exists
  return {
    isValid: true,
    hasPureSequence: true,
    hasSecondSequence: true,
    groupStatuses,
    penaltyPoints: 0
  };
}
