import { describe, it, expect } from 'vitest';
import {
  createCard,
  createStandardRummyDeck,
  shuffleDeck,
  dealInitialGame,
  isPureSequence,
  isImpureSequence,
  isValidSet,
  validateDeclaration,
  calculateOpponentPenalty,
  createInitialRoundState,
  executeDraw,
  executeDiscard,
  executeDeclare,
  executeDrop,
  FIRST_DROP_PENALTY,
  MIDDLE_DROP_PENALTY,
  MAX_PENALTY_POINTS
} from '../index.js';

describe('Deck & Dealing', () => {
  it('creates standard 2-deck set with 108 cards including 4 printed jokers', () => {
    const deck = createStandardRummyDeck(2);
    expect(deck).toHaveLength(108);

    const printedJokers = deck.filter((c) => c.isPrintedJoker);
    expect(printedJokers).toHaveLength(4);

    const hearts = deck.filter((c) => c.suit === 'HEARTS');
    expect(hearts).toHaveLength(26); // 13 * 2

    const spades = deck.filter((c) => c.suit === 'SPADES');
    expect(spades).toHaveLength(26);
  });

  it('deals 13 cards each to players, 1 wild joker, and 1 open card', () => {
    const deck = createStandardRummyDeck(2);
    const shuffled = shuffleDeck(deck);
    const deal = dealInitialGame(shuffled, 4);

    expect(deal.playerHands).toHaveLength(4);
    for (const hand of deal.playerHands) {
      expect(hand).toHaveLength(13);
    }
    expect(deal.wildJoker).toBeDefined();
    expect(deal.openPile).toHaveLength(1);
    expect(deal.closedDeck.length).toBe(108 - 4 * 13 - 1 - 1); // 108 - 52 - 2 = 54
  });
});

describe('Pure Sequence Validation', () => {
  it('identifies standard 3-card pure sequences', () => {
    const hand = [
      createCard('HEARTS', '4'),
      createCard('HEARTS', '5'),
      createCard('HEARTS', '6')
    ];
    expect(isPureSequence(hand)).toBe(true);
  });

  it('identifies low-Ace pure sequence (A-2-3)', () => {
    const hand = [
      createCard('SPADES', 'A'),
      createCard('SPADES', '2'),
      createCard('SPADES', '3')
    ];
    expect(isPureSequence(hand)).toBe(true);
  });

  it('identifies high-Ace pure sequence (10-J-Q-K-A)', () => {
    const hand = [
      createCard('DIAMONDS', '10'),
      createCard('DIAMONDS', 'J'),
      createCard('DIAMONDS', 'Q'),
      createCard('DIAMONDS', 'K'),
      createCard('DIAMONDS', 'A')
    ];
    expect(isPureSequence(hand)).toBe(true);
  });

  it('rejects round-the-corner sequences (K-A-2)', () => {
    const hand = [
      createCard('CLUBS', 'K'),
      createCard('CLUBS', 'A'),
      createCard('CLUBS', '2')
    ];
    expect(isPureSequence(hand)).toBe(false);
  });

  it('rejects sequences with printed jokers as wildcards', () => {
    const hand = [
      createCard('HEARTS', '4'),
      createCard('NONE', 'JOKER', true),
      createCard('HEARTS', '6')
    ];
    expect(isPureSequence(hand)).toBe(false);
  });

  it('rejects sequences with duplicate cards', () => {
    const hand = [
      createCard('HEARTS', '4', false, 1),
      createCard('HEARTS', '4', false, 2),
      createCard('HEARTS', '5', false, 1)
    ];
    expect(isPureSequence(hand)).toBe(false);
  });

  it('rejects sequences with cards of different suits', () => {
    const hand = [
      createCard('HEARTS', '4'),
      createCard('SPADES', '5'),
      createCard('HEARTS', '6')
    ];
    expect(isPureSequence(hand)).toBe(false);
  });

  it('rejects sequences with fewer than 3 cards', () => {
    const hand = [createCard('HEARTS', '4'), createCard('HEARTS', '5')];
    expect(isPureSequence(hand)).toBe(false);
  });
});

describe('Impure Sequence Validation', () => {
  const wildJoker = createCard('SPADES', '8'); // 8 of any suit is wild joker

  it('accepts impure sequence using printed joker as middle card', () => {
    const hand = [
      createCard('HEARTS', '4'),
      createCard('NONE', 'JOKER', true),
      createCard('HEARTS', '6')
    ];
    expect(isImpureSequence(hand, wildJoker)).toBe(true);
  });

  it('accepts impure sequence using wild joker as wildcard', () => {
    const wildCard = createCard('CLUBS', '8'); // Rank matches cut card
    const hand = [
      createCard('HEARTS', '9'),
      wildCard,
      createCard('HEARTS', 'J')
    ];
    expect(isImpureSequence(hand, wildJoker)).toBe(true);
  });

  it('accepts impure sequence with multiple jokers filling multiple consecutive gaps', () => {
    const pj = createCard('NONE', 'JOKER', true);
    const wildCard = createCard('DIAMONDS', '8');
    const hand = [
      createCard('CLUBS', '2'),
      pj,
      wildCard,
      createCard('CLUBS', '5')
    ];
    expect(isImpureSequence(hand, wildJoker)).toBe(true);
  });

  it('treats Aces as wild jokers when the cut card is a printed joker', () => {
    const cutPrintedJoker = createCard('NONE', 'JOKER', true);
    const aceOfHearts = createCard('HEARTS', 'A');
    // In this hand: 4♠, Ace of Hearts (acting as wild joker), 6♠
    const hand = [
      createCard('SPADES', '4'),
      aceOfHearts,
      createCard('SPADES', '6')
    ];
    expect(isImpureSequence(hand, cutPrintedJoker)).toBe(true);
  });

  it('rejects impure sequence with duplicate natural cards', () => {
    const pj = createCard('NONE', 'JOKER', true);
    const hand = [
      createCard('HEARTS', '4', false, 1),
      createCard('HEARTS', '4', false, 2),
      pj
    ];
    expect(isImpureSequence(hand, wildJoker)).toBe(false);
  });

  it('rejects impure sequence with naturals of different suits', () => {
    const pj = createCard('NONE', 'JOKER', true);
    const hand = [
      createCard('HEARTS', '4'),
      createCard('DIAMONDS', '5'),
      pj
    ];
    expect(isImpureSequence(hand, wildJoker)).toBe(false);
  });
});

describe('Valid Set Validation', () => {
  const wildJoker = createCard('HEARTS', '9'); // 9 is wild joker

  it('accepts 3-card and 4-card sets of same rank and different suits', () => {
    const set3 = [
      createCard('HEARTS', '7'),
      createCard('SPADES', '7'),
      createCard('CLUBS', '7')
    ];
    expect(isValidSet(set3, wildJoker)).toBe(true);

    const set4 = [
      createCard('HEARTS', 'K'),
      createCard('SPADES', 'K'),
      createCard('CLUBS', 'K'),
      createCard('DIAMONDS', 'K')
    ];
    expect(isValidSet(set4, wildJoker)).toBe(true);
  });

  it('accepts set with printed jokers substituting missing suits', () => {
    const setWithPJ = [
      createCard('HEARTS', '5'),
      createCard('SPADES', '5'),
      createCard('NONE', 'JOKER', true)
    ];
    expect(isValidSet(setWithPJ, wildJoker)).toBe(true);
  });

  it('accepts set with wild joker substituting missing suit', () => {
    const wj = createCard('DIAMONDS', '9'); // 9 is wild joker
    const setWithWJ = [
      createCard('HEARTS', 'Q'),
      createCard('CLUBS', 'Q'),
      wj
    ];
    expect(isValidSet(setWithWJ, wildJoker)).toBe(true);
  });

  it('rejects sets with duplicate suits', () => {
    const invalidSet = [
      createCard('HEARTS', '7', false, 1),
      createCard('HEARTS', '7', false, 2),
      createCard('SPADES', '7', false, 1)
    ];
    expect(isValidSet(invalidSet, wildJoker)).toBe(false);
  });

  it('rejects sets with more than 4 cards', () => {
    const invalidSet = [
      createCard('HEARTS', '7'),
      createCard('SPADES', '7'),
      createCard('CLUBS', '7'),
      createCard('DIAMONDS', '7'),
      createCard('NONE', 'JOKER', true)
    ];
    expect(isValidSet(invalidSet, wildJoker)).toBe(false);
  });

  it('rejects sets with fewer than 3 cards', () => {
    const invalidSet = [createCard('HEARTS', '7'), createCard('SPADES', '7')];
    expect(isValidSet(invalidSet, wildJoker)).toBe(false);
  });
});

describe('13-Card Declaration Validation', () => {
  const wildJoker = createCard('CLUBS', '6'); // 6 is wild joker

  it('approves valid 13-card hand with 1 pure seq, 1 impure seq, and 2 sets', () => {
    const pureSeq = [
      createCard('HEARTS', 'A'),
      createCard('HEARTS', '2'),
      createCard('HEARTS', '3')
    ];
    const impureSeq = [
      createCard('SPADES', '9'),
      createCard('NONE', 'JOKER', true, 1),
      createCard('SPADES', 'J')
    ];
    const set1 = [
      createCard('HEARTS', 'K'),
      createCard('SPADES', 'K'),
      createCard('CLUBS', 'K')
    ];
    const set2 = [
      createCard('DIAMONDS', '4'),
      createCard('CLUBS', '4'),
      createCard('SPADES', '4'),
      createCard('HEARTS', '4')
    ];

    const declaration = [pureSeq, impureSeq, set1, set2];
    const result = validateDeclaration(declaration, wildJoker);

    expect(result.isValid).toBe(true);
    expect(result.hasPureSequence).toBe(true);
    expect(result.hasSecondSequence).toBe(true);
    expect(result.penaltyPoints).toBe(0);
  });

  it('rejects declaration with NO Pure Sequence (Bogus Show - 80 pts penalty)', () => {
    // All sets and impure sequences, but no pure sequence
    const impureSeq1 = [
      createCard('HEARTS', '2'),
      createCard('NONE', 'JOKER', true, 1),
      createCard('HEARTS', '4')
    ];
    const impureSeq2 = [
      createCard('SPADES', '9'),
      createCard('NONE', 'JOKER', true, 2),
      createCard('SPADES', 'J')
    ];
    const set1 = [
      createCard('HEARTS', 'K'),
      createCard('SPADES', 'K'),
      createCard('CLUBS', 'K')
    ];
    const set2 = [
      createCard('DIAMONDS', '5'),
      createCard('CLUBS', '5'),
      createCard('SPADES', '5'),
      createCard('HEARTS', '5')
    ];

    const declaration = [impureSeq1, impureSeq2, set1, set2];
    const result = validateDeclaration(declaration, wildJoker);

    expect(result.isValid).toBe(false);
    expect(result.penaltyPoints).toBe(80);
    expect(result.reason).toContain('Pure Sequence');
  });

  it('rejects declaration missing second sequence', () => {
    const pureSeq = [
      createCard('HEARTS', 'A'),
      createCard('HEARTS', '2'),
      createCard('HEARTS', '3')
    ];
    const set1 = [
      createCard('HEARTS', 'K'),
      createCard('SPADES', 'K'),
      createCard('CLUBS', 'K')
    ];
    const set2 = [
      createCard('HEARTS', '8'),
      createCard('SPADES', '8'),
      createCard('CLUBS', '8')
    ];
    const set3 = [
      createCard('DIAMONDS', '4'),
      createCard('CLUBS', '4'),
      createCard('SPADES', '4'),
      createCard('HEARTS', '4')
    ];

    const declaration = [pureSeq, set1, set2, set3];
    const result = validateDeclaration(declaration, wildJoker);

    expect(result.isValid).toBe(false);
    expect(result.hasPureSequence).toBe(true);
    expect(result.hasSecondSequence).toBe(false);
    expect(result.penaltyPoints).toBe(80);
  });
});

describe('Scoring & Penalties', () => {
  const wildJoker = createCard('SPADES', '5');

  it('penalizes opponent all cards (capped at 80) if no pure sequence exists', () => {
    // 13 loose/unmelded cards
    const melds = [
      [
        createCard('HEARTS', 'K'), // 10
        createCard('HEARTS', 'Q'), // 10
        createCard('HEARTS', 'J')  // 10
        // Wait, K-Q-J is a pure sequence! Let's make them mixed suits:
      ]
    ];
    const unmelded = [
      [
        createCard('HEARTS', 'K'),
        createCard('SPADES', 'Q'),
        createCard('CLUBS', 'J')
      ],
      [
        createCard('HEARTS', 'A'),
        createCard('SPADES', 'A'),
        createCard('CLUBS', '2')
      ],
      [
        createCard('DIAMONDS', '10'),
        createCard('CLUBS', '10'),
        createCard('HEARTS', '9')
      ],
      [
        createCard('SPADES', '9'),
        createCard('CLUBS', '8'),
        createCard('HEARTS', '8'),
        createCard('DIAMONDS', '7')
      ]
    ];

    const score = calculateOpponentPenalty(unmelded, wildJoker);
    expect(score.hasPureSequence).toBe(false);
    expect(score.points).toBe(MAX_PENALTY_POINTS); // Capped at 80
  });

  it('protects only pure sequence if missing second sequence', () => {
    const pureSeq = [
      createCard('HEARTS', '2'),
      createCard('HEARTS', '3'),
      createCard('HEARTS', '4')
    ];
    const setOfKings = [
      createCard('HEARTS', 'K'), // 10
      createCard('SPADES', 'K'), // 10
      createCard('CLUBS', 'K')   // 10
    ]; // Set is valid, but because there is no second sequence, it is penalized!
    const loose = [
      [createCard('DIAMONDS', '2'), createCard('CLUBS', '2'), createCard('SPADES', '3')],
      [createCard('HEARTS', '7'), createCard('SPADES', '7'), createCard('CLUBS', '6'), createCard('DIAMONDS', '6')]
    ];

    const melds = [pureSeq, setOfKings, ...loose];
    const score = calculateOpponentPenalty(melds, wildJoker);

    expect(score.hasPureSequence).toBe(true);
    expect(score.hasSecondSequence).toBe(false);
    expect(score.meldedCardCount).toBe(3); // Only pure sequence is saved
    expect(score.points).toBeGreaterThan(30);
  });
});

describe('Turn State Machine (FSM)', () => {
  it('orchestrates complete turn flow: Deal -> Draw -> Discard -> Next Player', () => {
    const deck = createStandardRummyDeck(2);
    const deal = dealInitialGame(deck, 2);
    const p1 = 'player_1';
    const p2 = 'player_2';

    const state = createInitialRoundState('room_101', [p1, p2], deal, 0);

    expect(state.turnPhase).toBe('WAITING_DRAW');
    expect(state.activePlayerId).toBe(p1);
    expect(state.playerHands[p1]).toHaveLength(13);

    // Player 1 draws from closed deck
    const drawRes = executeDraw(state, p1, 'CLOSED');
    expect(drawRes.nextState.turnPhase).toBe('WAITING_DISCARD');
    expect(drawRes.nextState.playerHands[p1]).toHaveLength(14);

    // Player 1 discards the first card in their hand
    const cardToDiscard = drawRes.nextState.playerHands[p1]![0]!;
    const discardRes = executeDiscard(drawRes.nextState, p1, cardToDiscard.id);

    expect(discardRes.nextState.turnPhase).toBe('WAITING_DRAW');
    expect(discardRes.nextState.playerHands[p1]).toHaveLength(13);
    expect(discardRes.nextState.activePlayerId).toBe(p2); // Turn rotated to Player 2!
  });

  it('executes drop and awards victory to last standing player', () => {
    const deck = createStandardRummyDeck(2);
    const deal = dealInitialGame(deck, 2);
    const p1 = 'player_1';
    const p2 = 'player_2';

    const state = createInitialRoundState('room_102', [p1, p2], deal, 0);

    // Player 1 drops on first turn
    const dropRes = executeDrop(state, p1);
    expect(dropRes.nextState.turnPhase).toBe('ROUND_ENDED');
    expect(dropRes.nextState.roundWinnerId).toBe(p2);
    expect(dropRes.event.payload['penalty']).toBe(FIRST_DROP_PENALTY);
  });
});
