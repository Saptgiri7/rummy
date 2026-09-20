import { Card } from './card.js';
import { shuffleDeck } from './deck.js';
import { validateDeclaration, DeclarationResult } from './declaration.js';
import { FIRST_DROP_PENALTY, MIDDLE_DROP_PENALTY } from './scoring.js';

export type TurnPhase = 'WAITING_DRAW' | 'WAITING_DISCARD' | 'ROUND_ENDED';
export type PlayerStatus = 'ACTIVE' | 'DROPPED' | 'DECLARED' | 'ELIMINATED';

export interface GameRoundState {
  readonly roomId: string;
  readonly players: readonly string[];
  readonly activePlayerId: string;
  readonly wildJoker: Card;
  readonly closedDeck: readonly Card[];
  readonly openPile: readonly Card[];
  readonly playerHands: Readonly<Record<string, readonly Card[]>>;
  readonly playerStatuses: Readonly<Record<string, PlayerStatus>>;
  readonly playerMissedTurns: Readonly<Record<string, number>>;
  readonly isFirstTurnForPlayer: Readonly<Record<string, boolean>>;
  readonly turnPhase: TurnPhase;
  readonly roundWinnerId?: string;
  readonly declarationResult?: DeclarationResult;
}

export interface FsmActionResult {
  readonly nextState: GameRoundState;
  readonly event: {
    readonly type: string;
    readonly payload: Record<string, unknown>;
  };
}

/**
 * Creates initial round state given dealt cards.
 */
export function createInitialRoundState(
  roomId: string,
  players: readonly string[],
  dealt: {
    playerHands: readonly (readonly Card[])[];
    wildJoker: Card;
    openPile: readonly Card[];
    closedDeck: readonly Card[];
  },
  startingPlayerIndex = 0
): GameRoundState {
  if (players.length < 2) throw new Error('At least 2 players required');

  const handsMap: Record<string, readonly Card[]> = {};
  const statusesMap: Record<string, PlayerStatus> = {};
  const missedMap: Record<string, number> = {};
  const firstTurnMap: Record<string, boolean> = {};

  for (let i = 0; i < players.length; i++) {
    const pid = players[i]!;
    handsMap[pid] = dealt.playerHands[i] ?? [];
    statusesMap[pid] = 'ACTIVE';
    missedMap[pid] = 0;
    firstTurnMap[pid] = true;
  }

  const activePlayerId = players[startingPlayerIndex % players.length]!;

  return Object.freeze({
    roomId,
    players,
    activePlayerId,
    wildJoker: dealt.wildJoker,
    closedDeck: dealt.closedDeck,
    openPile: dealt.openPile,
    playerHands: Object.freeze(handsMap),
    playerStatuses: Object.freeze(statusesMap),
    playerMissedTurns: Object.freeze(missedMap),
    isFirstTurnForPlayer: Object.freeze(firstTurnMap),
    turnPhase: 'WAITING_DRAW'
  });
}

/**
 * Executes a card draw action (from CLOSED or OPEN pile).
 */
export function executeDraw(
  state: GameRoundState,
  playerId: string,
  source: 'CLOSED' | 'OPEN'
): FsmActionResult {
  if (state.turnPhase !== 'WAITING_DRAW') {
    throw new Error(`Cannot draw in phase: ${state.turnPhase}`);
  }
  if (state.activePlayerId !== playerId) {
    throw new Error(`Not player's turn. Active: ${state.activePlayerId}, requested: ${playerId}`);
  }
  if (state.playerStatuses[playerId] !== 'ACTIVE') {
    throw new Error(`Player ${playerId} is not active (${state.playerStatuses[playerId]})`);
  }

  let drawnCard: Card | undefined;
  let nextClosedDeck = [...state.closedDeck];
  let nextOpenPile = [...state.openPile];

  if (source === 'OPEN') {
    if (nextOpenPile.length === 0) {
      throw new Error('Open discard pile is empty');
    }
    drawnCard = nextOpenPile.pop();
  } else {
    // If closed deck is empty, reshuffle all cards from open pile except top card
    if (nextClosedDeck.length === 0) {
      if (nextOpenPile.length <= 1) {
        throw new Error('No cards remaining in either pile to draw');
      }
      const topOpenCard = nextOpenPile.pop()!;
      nextClosedDeck = shuffleDeck(nextOpenPile);
      nextOpenPile = [topOpenCard];
    }
    drawnCard = nextClosedDeck.pop();
  }

  if (!drawnCard) {
    throw new Error('Failed to retrieve card from deck');
  }

  const currentHand = state.playerHands[playerId] ?? [];
  const nextHand = [...currentHand, drawnCard];

  const nextState: GameRoundState = Object.freeze({
    ...state,
    closedDeck: Object.freeze(nextClosedDeck),
    openPile: Object.freeze(nextOpenPile),
    playerHands: Object.freeze({
      ...state.playerHands,
      [playerId]: Object.freeze(nextHand)
    }),
    turnPhase: 'WAITING_DISCARD'
  });

  return {
    nextState,
    event: {
      type: 'CARD_DRAWN',
      payload: {
        playerId,
        source,
        drawnCard,
        cardCount: nextHand.length
      }
    }
  };
}

/**
 * Executes a card discard action, ending the player's turn.
 */
export function executeDiscard(
  state: GameRoundState,
  playerId: string,
  cardId: string
): FsmActionResult {
  if (state.turnPhase !== 'WAITING_DISCARD') {
    throw new Error(`Cannot discard in phase: ${state.turnPhase}`);
  }
  if (state.activePlayerId !== playerId) {
    throw new Error(`Not player's turn. Active: ${state.activePlayerId}, requested: ${playerId}`);
  }

  const currentHand = state.playerHands[playerId] ?? [];
  const cardIndex = currentHand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) {
    throw new Error(`Card ${cardId} not found in player's hand`);
  }

  const discardedCard = currentHand[cardIndex]!;
  const nextHand = currentHand.filter((_, idx) => idx !== cardIndex);

  const nextOpenPile = [...state.openPile, discardedCard];
  const nextPlayerId = getNextActivePlayer(state.players, state.playerStatuses, playerId);

  const nextState: GameRoundState = Object.freeze({
    ...state,
    openPile: Object.freeze(nextOpenPile),
    playerHands: Object.freeze({
      ...state.playerHands,
      [playerId]: Object.freeze(nextHand)
    }),
    playerMissedTurns: Object.freeze({
      ...state.playerMissedTurns,
      [playerId]: 0 // Reset missed turns on valid action
    }),
    isFirstTurnForPlayer: Object.freeze({
      ...state.isFirstTurnForPlayer,
      [playerId]: false
    }),
    activePlayerId: nextPlayerId,
    turnPhase: 'WAITING_DRAW'
  });

  return {
    nextState,
    event: {
      type: 'CARD_DISCARDED',
      payload: {
        playerId,
        discardedCard,
        nextActivePlayerId: nextPlayerId
      }
    }
  };
}

/**
 * Executes a hand declaration (Show).
 */
export function executeDeclare(
  state: GameRoundState,
  playerId: string,
  finishCardId: string,
  melds: readonly (readonly Card[])[]
): FsmActionResult {
  if (state.turnPhase !== 'WAITING_DISCARD') {
    throw new Error(`Cannot declare in phase: ${state.turnPhase}`);
  }
  if (state.activePlayerId !== playerId) {
    throw new Error(`Not player's turn. Active: ${state.activePlayerId}`);
  }

  const currentHand = state.playerHands[playerId] ?? [];
  const finishCard = currentHand.find((c) => c.id === finishCardId);
  if (!finishCard) {
    throw new Error(`Finish card ${finishCardId} not in player's hand`);
  }

  const handWithoutFinish = currentHand.filter((c) => c.id !== finishCardId);
  if (handWithoutFinish.length !== 13) {
    throw new Error(`After finish card, player must declare with 13 cards, got ${handWithoutFinish.length}`);
  }

  const decResult = validateDeclaration(melds, state.wildJoker);

  if (decResult.isValid) {
    const nextOpenPile = [...state.openPile, finishCard];
    const nextState: GameRoundState = Object.freeze({
      ...state,
      openPile: Object.freeze(nextOpenPile),
      playerHands: Object.freeze({
        ...state.playerHands,
        [playerId]: Object.freeze(handWithoutFinish)
      }),
      turnPhase: 'ROUND_ENDED',
      roundWinnerId: playerId,
      declarationResult: decResult
    });

    return {
      nextState,
      event: {
        type: 'DECLARATION_SUCCESSFUL',
        payload: {
          winnerId: playerId,
          melds,
          finishCard
        }
      }
    };
  } else {
    // Bogus Show: Player is eliminated or assigned 80 points penalty
    const nextPlayerId = getNextActivePlayer(state.players, state.playerStatuses, playerId);
    const nextState: GameRoundState = Object.freeze({
      ...state,
      playerStatuses: Object.freeze({
        ...state.playerStatuses,
        [playerId]: 'ELIMINATED'
      }),
      activePlayerId: nextPlayerId,
      turnPhase: 'WAITING_DRAW',
      declarationResult: decResult
    });

    return {
      nextState,
      event: {
        type: 'DECLARATION_BOGUS',
        payload: {
          playerId,
          penalty: 80,
          reason: decResult.reason,
          nextActivePlayerId: nextPlayerId
        }
      }
    };
  }
}

/**
 * Executes a Player Drop action.
 */
export function executeDrop(state: GameRoundState, playerId: string): FsmActionResult {
  if (state.activePlayerId !== playerId) {
    throw new Error(`Can only drop on own turn. Active: ${state.activePlayerId}`);
  }

  const isFirstTurn = state.isFirstTurnForPlayer[playerId] ?? false;
  const penalty = isFirstTurn ? FIRST_DROP_PENALTY : MIDDLE_DROP_PENALTY;

  const nextStatuses = {
    ...state.playerStatuses,
    [playerId]: 'DROPPED' as PlayerStatus
  };

  const activeRemaining = state.players.filter((p) => nextStatuses[p] === 'ACTIVE');

  if (activeRemaining.length === 1) {
    // Only one player left — they win automatically!
    const winnerId = activeRemaining[0]!;
    const nextState: GameRoundState = Object.freeze({
      ...state,
      playerStatuses: Object.freeze(nextStatuses),
      turnPhase: 'ROUND_ENDED',
      roundWinnerId: winnerId
    });

    return {
      nextState,
      event: {
        type: 'ROUND_WON_BY_LAST_STANDING',
        payload: { winnerId, droppedPlayerId: playerId, penalty }
      }
    };
  }

  const nextPlayerId = getNextActivePlayer(state.players, nextStatuses, playerId);
  const nextState: GameRoundState = Object.freeze({
    ...state,
    playerStatuses: Object.freeze(nextStatuses),
    activePlayerId: nextPlayerId,
    turnPhase: 'WAITING_DRAW'
  });

  return {
    nextState,
    event: {
      type: 'PLAYER_DROPPED',
      payload: { playerId, penalty, nextActivePlayerId: nextPlayerId }
    }
  };
}

function getNextActivePlayer(
  players: readonly string[],
  statuses: Readonly<Record<string, PlayerStatus>>,
  currentActiveId: string
): string {
  const currentIndex = players.indexOf(currentActiveId);
  const count = players.length;

  for (let i = 1; i <= count; i++) {
    const nextIdx = (currentIndex + i) % count;
    const pid = players[nextIdx]!;
    if (statuses[pid] === 'ACTIVE') {
      return pid;
    }
  }

  return currentActiveId;
}
