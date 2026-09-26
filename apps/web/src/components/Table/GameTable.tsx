import React from 'react';
import { CardDto } from '@rummy/shared';
import { LogOut } from 'lucide-react';
import { CenterPiles } from './CenterPiles.js';
import { OpponentSeat } from './OpponentSeat.js';
import { PlayerHand } from './PlayerHand.js';
import { ActionControls } from './ActionControls.js';

export interface OpponentData {
  id: string;
  username: string;
  cardCount: number;
  isActiveTurn: boolean;
  isDisconnected: boolean;
}

export interface GameTableProps {
  myUserId: string;
  activePlayerId: string;
  wildJoker: CardDto | null;
  openPileTop: CardDto | null;
  hand: CardDto[];
  handGroups: CardDto[][];
  selectedCardIds: string[];
  opponents: OpponentData[];
  turnPhase: 'WAITING_DRAW' | 'WAITING_DISCARD' | 'ROUND_ENDED';
  remainingTurnTimeMs?: number;
  isFirstTurn?: boolean;
  selectedFinishCard: CardDto | null;
  onCardClick: (card: CardDto) => void;
  onGroupSelected: () => void;
  onAutoSort: () => void;
  onMoveCard?: (cardId: string, targetGroupIndex: number, targetCardIndex?: number) => void;
  onDrawClosed: () => void;
  onDrawOpen: () => void;
  onDiscard: (cardId?: string) => void;
  onDeclare: () => void;
  onDrop: () => void;
  onExitTable?: () => void;
  onFinishSlotClick: (cardId?: string) => void;
}

export const GameTable: React.FC<GameTableProps> = ({
  myUserId,
  activePlayerId,
  wildJoker,
  openPileTop,
  handGroups,
  selectedCardIds,
  opponents,
  turnPhase,
  remainingTurnTimeMs,
  isFirstTurn = false,
  selectedFinishCard,
  onCardClick,
  onGroupSelected,
  onAutoSort,
  onMoveCard,
  onDrawClosed,
  onDrawOpen,
  onDiscard,
  onDeclare,
  onDrop,
  onExitTable,
  onFinishSlotClick
}) => {
  const isMyTurn = Boolean(activePlayerId && myUserId && activePlayerId === myUserId);
  const canDraw = isMyTurn && turnPhase === 'WAITING_DRAW';
  const canDiscard = isMyTurn && turnPhase === 'WAITING_DISCARD';

  const activeOpponent = opponents.find((o) => o.id === activePlayerId);
  const activeOpponentName = activeOpponent ? activeOpponent.username : 'Opponent';

  return (
    <div className="game-table-wrapper" data-testid="game-table">
      <div className="table-surface">
        {/* Opponents Row at Top of Table */}
        <div className="opponents-row">
          {opponents.map((opp) => (
            <OpponentSeat
              key={opp.id}
              id={opp.id}
              username={opp.username}
              cardCount={opp.cardCount}
              isActiveTurn={opp.isActiveTurn}
              isDisconnected={opp.isDisconnected}
              turnTimeoutMs={remainingTurnTimeMs}
            />
          ))}
        </div>

        {/* Prominent Turn Status Banner */}
        <div
          id="turn-status-banner"
          className={`turn-status-banner ${isMyTurn ? (turnPhase === 'WAITING_DRAW' ? 'my-turn draw-phase' : 'my-turn discard-phase') : 'opponent-turn'}`}
          data-testid="turn-status-banner"
        >
          {isMyTurn ? (
            turnPhase === 'WAITING_DRAW' ? (
              <div className="banner-content draw-turn">
                <span className="banner-pulse green" />
                <span className="banner-badge green">YOUR TURN</span>
                <span className="banner-instruction">
                  Draw a card: Tap the <strong>Closed Deck</strong> or <strong>Open Pile</strong>
                </span>
              </div>
            ) : (
              <div className="banner-content discard-turn">
                <span className="banner-pulse gold" />
                <span className="banner-badge gold">YOUR TURN</span>
                <span className="banner-instruction">
                  Select 1 card from your hand, then click <strong>Discard</strong> or drag directly to <strong>Open Pile</strong>
                </span>
              </div>
            )
          ) : (
            <div className="banner-content waiting-turn">
              <span className="banner-loader" />
              <span className="banner-badge gray">WAITING</span>
              <span className="banner-instruction">
                Waiting for <strong>{activeOpponentName}</strong> to play their turn...
              </span>
            </div>
          )}
        </div>

        {/* Center Table: Closed Deck, Open Pile, Wild Joker, Finish Slot */}
        <CenterPiles
          wildJoker={wildJoker}
          openCard={openPileTop}
          canDraw={canDraw}
          canDiscard={canDiscard}
          onDrawClosed={onDrawClosed}
          onDrawOpen={onDrawOpen}
          onFinishSelect={() => onFinishSlotClick()}
          selectedFinishCard={selectedFinishCard}
          onDiscardCard={(cardId) => onDiscard(cardId)}
          onDropFinishCard={(cardId) => onFinishSlotClick(cardId)}
        />

        {/* Bottom Area: Action Controls + Player Hand */}
        <div className="player-bottom-dock">
          <ActionControls
            isMyTurn={isMyTurn}
            turnPhase={turnPhase}
            selectedCardCount={selectedCardIds.length}
            isFirstTurn={isFirstTurn}
            onDiscard={() => onDiscard()}
            onDeclare={onDeclare}
            onDrop={onDrop}
            remainingTurnTimeMs={remainingTurnTimeMs}
          />

          <PlayerHand
            cards={handGroups.flat()}
            groups={handGroups}
            wildJoker={wildJoker}
            selectedCardIds={selectedCardIds}
            onCardClick={onCardClick}
            onGroupSelected={onGroupSelected}
            onAutoSort={onAutoSort}
            onMoveCard={onMoveCard}
            onDiscardCard={(cardId) => onDiscard(cardId)}
            onDropFinishCard={(cardId) => onFinishSlotClick(cardId)}
          />
        </div>
      </div>
    </div>
  );
};
