import { Card, STANDARD_RANKS, STANDARD_SUITS, createCard } from './card.js';

export interface DealResult {
  playerHands: Card[][];
  wildJoker: Card;
  openPile: Card[];
  closedDeck: Card[];
}

/**
 * Generates a standard multi-deck set for Indian Rummy.
 * Default: 2 decks = (52 cards + 2 printed jokers) * 2 = 108 cards.
 */
export function createStandardRummyDeck(numberOfDecks = 2): Card[] {
  const cards: Card[] = [];

  for (let deckNumber = 1; deckNumber <= numberOfDecks; deckNumber++) {
    for (const suit of STANDARD_SUITS) {
      for (const rank of STANDARD_RANKS) {
        cards.push(createCard(suit, rank, false, deckNumber));
      }
    }

    // Each physical deck includes 2 printed jokers
    cards.push(createCard('NONE', 'JOKER', true, deckNumber));
    cards.push(createCard('NONE', 'JOKER', true, deckNumber));
  }

  return cards;
}

/**
 * Fisher-Yates in-place or pure array shuffle.
 * Accepts an optional RNG function for deterministic testing.
 */
export function shuffleDeck(cards: readonly Card[], rng: () => number = Math.random): Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    const target = shuffled[j];
    if (temp !== undefined && target !== undefined) {
      shuffled[i] = target;
      shuffled[j] = temp;
    }
  }
  return shuffled;
}

/**
 * Deals cards to 2 to 6 players according to 13-Card Indian Rummy rules:
 * 1. 13 cards dealt to each player.
 * 2. 1 cut card selected as Wild Joker.
 * 3. 1 card placed face up on the open discard pile.
 * 4. Remaining cards form the closed draw deck.
 */
export function dealInitialGame(
  shuffledDeck: readonly Card[],
  playerCount: number,
  cardsPerPlayer = 13
): DealResult {
  if (playerCount < 2 || playerCount > 6) {
    throw new Error(`Indian Rummy supports 2 to 6 players, requested: ${playerCount}`);
  }

  const minCardsNeeded = playerCount * cardsPerPlayer + 2; // Hands + 1 wild joker + 1 open card
  if (shuffledDeck.length < minCardsNeeded) {
    throw new Error(
      `Insufficient cards in deck. Needed at least ${minCardsNeeded}, got ${shuffledDeck.length}`
    );
  }

  const deck = [...shuffledDeck];
  const playerHands: Card[][] = Array.from({ length: playerCount }, () => []);

  // Deal 13 cards per player
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let p = 0; p < playerCount; p++) {
      const card = deck.pop();
      if (!card) throw new Error('Deck exhausted during deal');
      playerHands[p]?.push(card);
    }
  }

  // 1 cut card as wild joker
  const wildJoker = deck.pop();
  if (!wildJoker) throw new Error('Deck exhausted when cutting wild joker');

  // 1 card as open pile starter
  const openStarter = deck.pop();
  if (!openStarter) throw new Error('Deck exhausted when creating open pile');

  return {
    playerHands,
    wildJoker,
    openPile: [openStarter],
    closedDeck: deck
  };
}
