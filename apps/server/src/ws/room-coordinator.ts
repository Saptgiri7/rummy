import {
  GameRoundState,
  createStandardRummyDeck,
  shuffleDeck,
  dealInitialGame,
  createInitialRoundState,
  executeDraw,
  executeDiscard,
  executeDeclare,
  executeDrop,
  executeForfeit,
  calculateOpponentPenalty,
  Card
} from '@rummy/engine';
import {
  getRoomLockKey,
  withLock,
  saveRoomState,
  getRoomState,
  deleteRoomState,
  setUserActiveRoom,
  getUserActiveRoom,
  clearUserActiveRoom,
  getRoomLobby,
  deleteRoomLobby
} from '@rummy/redis';
import {
  ErrorCode,
  ServerMessage
} from '@rummy/shared';
import { recordCompletedMatch, PlayerSettlement } from '@rummy/database';
import { ClientConnection, registry } from './connection-registry.js';
import { logger } from '../utils/logger.js';

export interface RoomCoordinatorConfig {
  turnTimeoutMs?: number;
  gracePeriodMs?: number;
}

export class RoomCoordinator {
  private turnTimers = new Map<string, NodeJS.Timeout>();
  private turnEndTimes = new Map<string, number>();
  private disconnectGraceTimers = new Map<string, NodeJS.Timeout>();
  private roomStakes = new Map<string, number>();

  readonly turnTimeoutMs: number;
  readonly gracePeriodMs: number;

  constructor(config: RoomCoordinatorConfig = {}) {
    this.turnTimeoutMs = config.turnTimeoutMs ?? 30000;
    this.gracePeriodMs = config.gracePeriodMs ?? 20000;
  }

  getActiveRoomCount(): number {
    return this.turnTimers.size;
  }

  getActiveRoomIds(): string[] {
    return Array.from(this.turnTimers.keys());
  }

  /**
   * Initializes a room, deals cards, persists to Redis, and notifies players.
   */
  async initializeRoom(
    roomId: string,
    playerIds: string[],
    stake = 0,
    turnTimeoutMs = this.turnTimeoutMs
  ): Promise<GameRoundState> {
    if (playerIds.length < 2 || playerIds.length > 6) {
      throw new Error(`Room requires 2 to 6 players, got ${playerIds.length}`);
    }

    return await withLock(getRoomLockKey(roomId), 3000, async () => {
      this.roomStakes.set(roomId, stake);

      const deck = createStandardRummyDeck(2);
      const shuffled = shuffleDeck(deck);
      const dealt = dealInitialGame(shuffled, playerIds.length, 13);

      const initialState = createInitialRoundState(roomId, playerIds, dealt, 0);
      await saveRoomState(initialState);

      // Track active room for each user in Redis and join them in registry
      for (let i = 0; i < playerIds.length; i++) {
        const pid = playerIds[i]!;
        await setUserActiveRoom(pid, roomId);

        const conns = registry.getConnectionsByUserId(pid);
        const userHand = dealt.playerHands[i] ?? [];

        const gameStartedMsg: ServerMessage = {
          type: 'GAME_STARTED',
          payload: {
            roomId,
            players: [...playerIds],
            activePlayerId: initialState.activePlayerId,
            wildJoker: initialState.wildJoker,
            openCard: initialState.openPile[0]!,
            initialHand: [...userHand],
            turnTimeoutMs
          }
        };

        if (conns.length > 0) {
          for (const conn of conns) {
            registry.joinRoom(conn.connectionId, roomId);
            registry.sendToConnection(conn.connectionId, gameStartedMsg);
          }
          logger.info(`Dispatched GAME_STARTED to user ${pid} (${conns.length} sockets) in room ${roomId}`);
        } else {
          logger.warn(`No active WebSocket connections found for user ${pid} when starting room ${roomId}`);
        }
      }

      this.startTurnTimer(roomId, initialState.activePlayerId, turnTimeoutMs);
      return initialState;
    });
  }

  /**
   * Handles player joining or reconnecting to a room.
   */
  async handleJoinRoom(conn: ClientConnection, roomId: string): Promise<void> {
    registry.joinRoom(conn.connectionId, roomId);

    const state = await getRoomState(roomId);
    if (!state) {
      // Room has not started yet or waiting in matchmaking
      const joinedMsg: ServerMessage = {
        type: 'ROOM_JOINED',
        payload: {
          roomId,
          players: [conn.userId],
          maxPlayers: 2
        }
      };
      registry.sendToConnection(conn.connectionId, joinedMsg);
      return;
    }

    if (!state.players.includes(conn.userId)) {
      this.sendError(conn, ErrorCode.PLAYER_NOT_IN_ROOM, 'You are not a player in this active room');
      return;
    }

    // Reconnection flow: Cancel disconnect grace timer if one exists
    this.cancelGraceTimer(roomId, conn.userId);

    const remainingTurnTimeMs = Math.max(
      0,
      (this.turnEndTimes.get(roomId) ?? Date.now()) - Date.now()
    );

    const reconnectedMsg: ServerMessage = {
      type: 'PLAYER_RECONNECTED',
      payload: {
        roomId,
        playerId: conn.userId
      }
    };
    registry.broadcastToRoom(roomId, reconnectedMsg, conn.connectionId);

    const topOpenCard = state.openPile[state.openPile.length - 1]!;
    const userHand = state.playerHands[conn.userId] ?? [];

    const gameStateMsg: ServerMessage = {
      type: 'GAME_RECONNECTED',
      payload: {
        roomId,
        activePlayerId: state.activePlayerId,
        wildJoker: state.wildJoker,
        openPileTop: topOpenCard,
        hand: [...userHand],
        players: [...state.players],
        remainingTurnTimeMs
      }
    };
    registry.sendToConnection(conn.connectionId, gameStateMsg);
  }

  /**
   * Handles player drawing a card (from CLOSED or OPEN pile).
   */
  async handleDraw(
    conn: ClientConnection,
    roomId: string,
    source: 'CLOSED' | 'OPEN'
  ): Promise<void> {
    await withLock(getRoomLockKey(roomId), 2000, async () => {
      const state = await getRoomState(roomId);
      if (!state) {
        return this.sendError(conn, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      }

      if (state.turnPhase !== 'WAITING_DRAW') {
        return this.sendError(conn, ErrorCode.INVALID_PHASE, `Cannot draw in phase: ${state.turnPhase}`);
      }

      if (state.activePlayerId !== conn.userId) {
        return this.sendError(conn, ErrorCode.NOT_YOUR_TURN, 'Not your turn to draw');
      }

      try {
        const actionResult = executeDraw(state, conn.userId, source);
        await saveRoomState(actionResult.nextState);

        const drawnCard = actionResult.event.payload['drawnCard'] as Card;
        const playerHand = actionResult.nextState.playerHands[conn.userId] ?? [];

        // 1. Unicast secret drawn card identity to drawing player only
        const privateMsg: ServerMessage = {
          type: 'CARD_DRAWN_PRIVATE',
          payload: {
            roomId,
            drawnCard,
            hand: [...playerHand]
          }
        };
        registry.sendToConnection(conn.connectionId, privateMsg);

        // 2. Broadcast public draw notification to all room participants (excluding secret card identity)
        const publicMsg: ServerMessage = {
          type: 'CARD_DRAWN_PUBLIC',
          payload: {
            roomId,
            playerId: conn.userId,
            source,
            cardCount: playerHand.length
          }
        };
        registry.broadcastToRoom(roomId, publicMsg);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Draw failed';
        this.sendError(conn, ErrorCode.INTERNAL_SERVER_ERROR, msg);
      }
    });
  }

  /**
   * Handles player discarding a card to the open pile.
   */
  async handleDiscard(
    conn: ClientConnection,
    roomId: string,
    cardId: string
  ): Promise<void> {
    await withLock(getRoomLockKey(roomId), 2000, async () => {
      const state = await getRoomState(roomId);
      if (!state) {
        return this.sendError(conn, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      }

      if (state.turnPhase !== 'WAITING_DISCARD') {
        return this.sendError(conn, ErrorCode.INVALID_PHASE, `Cannot discard in phase: ${state.turnPhase}`);
      }

      if (state.activePlayerId !== conn.userId) {
        return this.sendError(conn, ErrorCode.NOT_YOUR_TURN, 'Not your turn to discard');
      }

      try {
        const actionResult = executeDiscard(state, conn.userId, cardId);
        await saveRoomState(actionResult.nextState);

        const discardedCard = actionResult.event.payload['discardedCard'] as Card;
        const nextActiveId = actionResult.nextState.activePlayerId;

        // Restart turn timer for next player
        this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);

        // Broadcast discard to all room participants
        const discardMsg: ServerMessage = {
          type: 'CARD_DISCARDED',
          payload: {
            roomId,
            playerId: conn.userId,
            discardedCard,
            nextActivePlayerId: nextActiveId,
            turnTimeoutMs: this.turnTimeoutMs
          }
        };
        registry.broadcastToRoom(roomId, discardMsg);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Discard failed';
        this.sendError(conn, ErrorCode.CARD_NOT_IN_HAND, msg);
      }
    });
  }

  /**
   * Handles player dropping out of the active round.
   */
  async handleDrop(conn: ClientConnection, roomId: string): Promise<void> {
    await withLock(getRoomLockKey(roomId), 2000, async () => {
      const state = await getRoomState(roomId);
      if (!state) {
        return this.sendError(conn, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      }

      if (state.activePlayerId !== conn.userId) {
        return this.sendError(conn, ErrorCode.NOT_YOUR_TURN, 'Can only drop on your own turn');
      }

      try {
        const actionResult = executeDrop(state, conn.userId);

        if (actionResult.nextState.turnPhase === 'ROUND_ENDED') {
          // Last remaining active player wins!
          const winnerId = actionResult.nextState.roundWinnerId!;
          this.cancelTurnTimer(roomId);
          await this.settleRound(roomId, actionResult.nextState, winnerId);
        } else {
          await saveRoomState(actionResult.nextState);
          const nextActiveId = actionResult.nextState.activePlayerId;
          this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);

          const dropMsg: ServerMessage = {
            type: 'PLAYER_DROPPED',
            payload: {
              roomId,
              playerId: conn.userId,
              penalty: actionResult.event.payload['penalty'] as number,
              nextActivePlayerId: nextActiveId
            }
          };
          registry.broadcastToRoom(roomId, dropMsg);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Drop failed';
        this.sendError(conn, ErrorCode.INTERNAL_SERVER_ERROR, msg);
      }
    });
  }

  /**
   * Handles player forfeiting / exiting the active game table.
   * Can be invoked at any time, even when it is not the player's turn.
   */
  async handleLeaveTable(conn: ClientConnection, roomId: string): Promise<void> {
    await withLock(getRoomLockKey(roomId), 2500, async () => {
      const state = await getRoomState(roomId);
      if (!state || state.turnPhase === 'ROUND_ENDED') {
        await clearUserActiveRoom(conn.userId);
        registry.leaveRoom(conn.connectionId, roomId);
        return;
      }

      if (!state.players.includes(conn.userId) || state.playerStatuses[conn.userId] !== 'ACTIVE') {
        await clearUserActiveRoom(conn.userId);
        registry.leaveRoom(conn.connectionId, roomId);
        return;
      }

      try {
        this.cancelGraceTimer(roomId, conn.userId);
        const actionResult = executeForfeit(state, conn.userId);

        await clearUserActiveRoom(conn.userId);
        registry.leaveRoom(conn.connectionId, roomId);

        if (actionResult.nextState.turnPhase === 'ROUND_ENDED') {
          // Last remaining active player wins!
          const winnerId = actionResult.nextState.roundWinnerId!;
          this.cancelTurnTimer(roomId);
          await this.settleRound(roomId, actionResult.nextState, winnerId);
        } else {
          await saveRoomState(actionResult.nextState);
          const nextActiveId = actionResult.nextState.activePlayerId;
          if (state.activePlayerId === conn.userId) {
            this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);
          }

          const dropMsg: ServerMessage = {
            type: 'PLAYER_DROPPED',
            payload: {
              roomId,
              playerId: conn.userId,
              penalty: actionResult.event.payload['penalty'] as number,
              nextActivePlayerId: nextActiveId
            }
          };
          registry.broadcastToRoom(roomId, dropMsg);
        }
      } catch (err: unknown) {
        logger.error(`Error in handleLeaveTable for user ${conn.userId} in room ${roomId}:`, err);
        const msg = err instanceof Error ? err.message : 'Leave table failed';
        this.sendError(conn, ErrorCode.INTERNAL_SERVER_ERROR, msg);
      }
    });
  }

  /**
   * Handles declaration (Show) submission.
   */
  async handleDeclare(
    conn: ClientConnection,
    roomId: string,
    finishCardId: string,
    melds: Card[][]
  ): Promise<void> {
    await withLock(getRoomLockKey(roomId), 3000, async () => {
      const state = await getRoomState(roomId);
      if (!state) {
        return this.sendError(conn, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      }

      if (state.turnPhase !== 'WAITING_DISCARD') {
        return this.sendError(conn, ErrorCode.INVALID_PHASE, 'Must draw before declaring finish card');
      }

      if (state.activePlayerId !== conn.userId) {
        return this.sendError(conn, ErrorCode.NOT_YOUR_TURN, 'Not your turn to declare');
      }

      try {
        const actionResult = executeDeclare(state, conn.userId, finishCardId, melds);

        if (actionResult.nextState.turnPhase === 'ROUND_ENDED') {
          // Valid declaration!
          this.cancelTurnTimer(roomId);

          const declaredMsg: ServerMessage = {
            type: 'DECLARATION_SUBMITTED',
            payload: {
              roomId,
              declaringPlayerId: conn.userId
            }
          };
          registry.broadcastToRoom(roomId, declaredMsg);

          await this.settleRound(roomId, actionResult.nextState, conn.userId);
        } else {
          // Bogus Show: Player receives 80 penalty points and is eliminated
          await saveRoomState(actionResult.nextState);
          const nextActiveId = actionResult.nextState.activePlayerId;
          this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);

          const errorMsg: ServerMessage = {
            type: 'ERROR',
            payload: {
              code: ErrorCode.INVALID_DECLARATION,
              message: `Bogus Show! Penalty: 80 points. ${actionResult.nextState.declarationResult?.reason ?? ''}`
            }
          };
          registry.sendToConnection(conn.connectionId, errorMsg);

          const dropMsg: ServerMessage = {
            type: 'PLAYER_DROPPED',
            payload: {
              roomId,
              playerId: conn.userId,
              penalty: 80,
              nextActivePlayerId: nextActiveId
            }
          };
          registry.broadcastToRoom(roomId, dropMsg);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Declaration failed';
        this.sendError(conn, ErrorCode.INVALID_DECLARATION, msg);
      }
    });
  }

  /**
   * Handles player socket disconnection and starts the reconnect grace period.
   */
  async handleDisconnect(conn: ClientConnection): Promise<void> {
    const roomId = conn.roomId ?? (await getUserActiveRoom(conn.userId));
    if (!roomId) return;

    const state = await getRoomState(roomId);
    if (!state || state.turnPhase === 'ROUND_ENDED') return;

    if (state.players.includes(conn.userId) && state.playerStatuses[conn.userId] === 'ACTIVE') {
      const disconnectMsg: ServerMessage = {
        type: 'PLAYER_DISCONNECTED',
        payload: {
          roomId,
          playerId: conn.userId,
          gracePeriodMs: this.gracePeriodMs
        }
      };
      registry.broadcastToRoom(roomId, disconnectMsg, conn.connectionId);

      this.startGraceTimer(roomId, conn.userId, this.gracePeriodMs);
    }
  }

  /**
   * Settles match points, updates PostgreSQL wallets, and broadcasts round completion.
   */
  private async settleRound(
    roomId: string,
    finalState: GameRoundState,
    winnerId: string
  ): Promise<void> {
    const stake = this.roomStakes.get(roomId) ?? 10;
    const scores: Array<{
      playerId: string;
      points: number;
      penalty: number;
      melds?: Card[][];
    }> = [];

    const settlements: PlayerSettlement[] = [];
    let totalOpponentPenalties = 0;

    for (const pid of finalState.players) {
      if (pid === winnerId) {
        scores.push({
          playerId: pid,
          points: 0,
          penalty: 0
        });
      } else {
        const status = finalState.playerStatuses[pid];
        let penalty = 80;

        if (status === 'DROPPED') {
          const isFirstTurn = finalState.isFirstTurnForPlayer[pid] ?? false;
          penalty = isFirstTurn ? 20 : 40;
        } else if (status === 'ELIMINATED') {
          penalty = 80;
        } else {
          // Active opponent whose hand was unmelded
          const opponentHand = finalState.playerHands[pid] ?? [];
          const scoreResult = calculateOpponentPenalty([opponentHand], finalState.wildJoker);
          penalty = scoreResult.points;
        }

        totalOpponentPenalties += penalty;
        const chipLoss = -1 * penalty * stake;

        scores.push({
          playerId: pid,
          points: penalty,
          penalty
        });

        settlements.push({
          userId: pid,
          score: penalty,
          chipDelta: chipLoss,
          status: status ?? 'ACTIVE'
        });
      }
    }

    // Winner gains the sum of opponent chips
    const winnerGain = totalOpponentPenalties * stake;
    settlements.push({
      userId: winnerId,
      score: 0,
      chipDelta: winnerGain,
      status: 'WINNER'
    });

    try {
      await recordCompletedMatch(roomId, stake, winnerId, settlements);
    } catch (err) {
      console.error(`[Coordinator] Failed to persist match in DB for room ${roomId}:`, err);
    }

    // Clean up Redis room state, lobby, code mapping, and player bindings
    await deleteRoomState(roomId);
    for (const pid of finalState.players) {
      await clearUserActiveRoom(pid);
    }
    const lobby = await getRoomLobby(roomId);
    if (lobby) {
      await deleteRoomLobby(roomId, lobby.roomCode);
    }
    this.roomStakes.delete(roomId);
    this.cancelTurnTimer(roomId);

    // Broadcast ROUND_COMPLETED
    const roundCompletedMsg: ServerMessage = {
      type: 'ROUND_COMPLETED',
      payload: {
        roomId,
        winnerId,
        scores
      }
    };
    registry.broadcastToRoom(roomId, roundCompletedMsg);
  }

  /**
   * Starts or restarts the turn timer for an active player in a room.
   */
  startTurnTimer(roomId: string, activePlayerId: string, durationMs: number): void {
    this.cancelTurnTimer(roomId);

    // If active player is currently disconnected, expedite turn to 10s max
    const isConnected = registry.getConnectionsByUserId(activePlayerId).length > 0;
    const effectiveDuration = isConnected ? durationMs : Math.min(durationMs, 10000);

    this.turnEndTimes.set(roomId, Date.now() + effectiveDuration);

    const timer = setTimeout(async () => {
      try {
        await this.executeAutoTurn(roomId, activePlayerId);
      } catch (err) {
        logger.error(`Error in executeAutoTurn for room ${roomId}:`, err);
      }
    }, effectiveDuration);

    if (timer.unref) timer.unref();
    this.turnTimers.set(roomId, timer);
  }

  cancelTurnTimer(roomId: string): void {
    const timer = this.turnTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.turnTimers.delete(roomId);
    }
    this.turnEndTimes.delete(roomId);
  }

  /**
   * Automatic turn execution when turn timer expires.
   */
  async executeAutoTurn(roomId: string, expectedPlayerId: string): Promise<void> {
    await withLock(getRoomLockKey(roomId), 2500, async () => {
      try {
        const state = await getRoomState(roomId);
        if (!state || state.turnPhase === 'ROUND_ENDED' || state.activePlayerId !== expectedPlayerId) {
          return;
        }

        const isConnected = registry.getConnectionsByUserId(expectedPlayerId).length > 0;
        const currentMissed = (state.playerMissedTurns[expectedPlayerId] ?? 0) + 1;

        // Auto-forfeit if 3 missed turns or if disconnected player misses turn
        if (currentMissed >= 3 || (!isConnected && currentMissed >= 2)) {
          logger.info(`[AutoPlay] Player ${expectedPlayerId} missed turn in room ${roomId} (connected: ${isConnected}); auto-forfeiting`);
          const dropResult = executeForfeit(state, expectedPlayerId);

          if (dropResult.nextState.turnPhase === 'ROUND_ENDED') {
            const winnerId = dropResult.nextState.roundWinnerId!;
            this.cancelTurnTimer(roomId);
            await this.settleRound(roomId, dropResult.nextState, winnerId);
          } else {
            await saveRoomState(dropResult.nextState);
            const nextActiveId = dropResult.nextState.activePlayerId;
            this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);

            const dropMsg: ServerMessage = {
              type: 'PLAYER_DROPPED',
              payload: {
                roomId,
                playerId: expectedPlayerId,
                penalty: dropResult.event.payload['penalty'] as number,
                nextActivePlayerId: nextActiveId
              }
            };
            registry.broadcastToRoom(roomId, dropMsg);
          }
          return;
        }

        // Auto-Play: Draw from CLOSED deck if in WAITING_DRAW
        let currentState = state;
        let drawnCard: Card | undefined;

        if (currentState.turnPhase === 'WAITING_DRAW') {
          const drawResult = executeDraw(currentState, expectedPlayerId, 'CLOSED');
          currentState = drawResult.nextState;
          drawnCard = drawResult.event.payload['drawnCard'] as Card;

          // Broadcast public draw
          const publicDrawMsg: ServerMessage = {
            type: 'CARD_DRAWN_PUBLIC',
            payload: {
              roomId,
              playerId: expectedPlayerId,
              source: 'CLOSED',
              cardCount: currentState.playerHands[expectedPlayerId]?.length ?? 14
            }
          };
          registry.broadcastToRoom(roomId, publicDrawMsg);

          // Unicast private draw if player connection is still open
          const conn = registry.getConnectionByUserId(expectedPlayerId);
          if (conn) {
            const privateDrawMsg: ServerMessage = {
              type: 'CARD_DRAWN_PRIVATE',
              payload: {
                roomId,
                drawnCard,
                hand: [...(currentState.playerHands[expectedPlayerId] ?? [])]
              }
            };
            registry.sendToConnection(conn.connectionId, privateDrawMsg);
          }
        }

        // In WAITING_DISCARD: Discard the drawn card, or fallback to first card
        const hand = currentState.playerHands[expectedPlayerId] ?? [];
        const cardToDiscard = drawnCard ?? hand[0];

        if (!cardToDiscard) {
          // If hand is somehow empty, forfeit
          const forfeitRes = executeForfeit(currentState, expectedPlayerId);
          await saveRoomState(forfeitRes.nextState);
          return;
        }

        const discardResult = executeDiscard(currentState, expectedPlayerId, cardToDiscard.id);
        const nextActiveId = discardResult.nextState.activePlayerId;

        // Update missed turns in next state
        const stateWithMissed: GameRoundState = Object.freeze({
          ...discardResult.nextState,
          playerMissedTurns: Object.freeze({
            ...discardResult.nextState.playerMissedTurns,
            [expectedPlayerId]: currentMissed
          })
        });

        await saveRoomState(stateWithMissed);
        this.startTurnTimer(roomId, nextActiveId, this.turnTimeoutMs);

        const discardMsg: ServerMessage = {
          type: 'CARD_DISCARDED',
          payload: {
            roomId,
            playerId: expectedPlayerId,
            discardedCard: cardToDiscard,
            nextActivePlayerId: nextActiveId,
            turnTimeoutMs: this.turnTimeoutMs
          }
        };
        registry.broadcastToRoom(roomId, discardMsg);
      } catch (err) {
        logger.error(`Error in executeAutoTurn execution for room ${roomId}:`, err);
      }
    });
  }

  private startGraceTimer(roomId: string, userId: string, gracePeriodMs: number): void {
    const key = `${roomId}:${userId}`;
    this.cancelGraceTimer(roomId, userId);

    const timer = setTimeout(async () => {
      this.disconnectGraceTimers.delete(key);
      logger.info(`[GraceTimer] Disconnect grace expired for user ${userId} in room ${roomId}`);

      // Auto-forfeit the disconnected player
      const connMock: ClientConnection = {
        connectionId: `mock_${userId}`,
        userId,
        username: 'Player',
        ws: null as unknown as any,
        isAlive: false,
        connectedAt: Date.now()
      };
      await this.handleLeaveTable(connMock, roomId);
    }, gracePeriodMs);

    if (timer.unref) timer.unref();
    this.disconnectGraceTimers.set(key, timer);
  }

  private cancelGraceTimer(roomId: string, userId: string): void {
    const key = `${roomId}:${userId}`;
    const timer = this.disconnectGraceTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.disconnectGraceTimers.delete(key);
    }
  }

  private sendError(conn: ClientConnection, code: ErrorCode, message: string): void {
    const errorMsg: ServerMessage = {
      type: 'ERROR',
      payload: {
        code,
        message
      }
    };
    registry.sendToConnection(conn.connectionId, errorMsg);
  }
}

export const coordinator = new RoomCoordinator();
