import React from 'react';
import { CardDto } from '@rummy/shared';
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
  onDrawClosed: () => void;
  onDrawOpen: () => void;
  onDiscard: () => void;
  onDeclare: () => void;
  onDrop: () => void;
  onFinishSlotClick: () => void;
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
  onDrawClosed,
  onDrawOpen,
  onDiscard,
  onDeclare,
  onDrop,
  onFinishSlotClick
}) => {
  const isMyTurn = activePlayerId === myUserId;
  const canDraw = isMyTurn && turnPhase === 'WAITING_DRAW';

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
            />
          ))}
        </div>

        {/* Center Table: Closed Deck, Open Pile, Wild Joker, Finish Slot */}
        <CenterPiles
          wildJoker={wildJoker}
          openCard={openPileTop}
          canDraw={canDraw}
          onDrawClosed={onDrawClosed}
          onDrawOpen={onDrawOpen}
          onFinishSelect={onFinishSlotClick}
          selectedFinishCard={selectedFinishCard}
        />

        {/* Bottom Area: Action Controls + Player Hand */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <ActionControls
            isMyTurn={isMyTurn}
            turnPhase={turnPhase}
            selectedCardCount={selectedCardIds.length}
            isFirstTurn={isFirstTurn}
            onDiscard={onDiscard}
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
          />
        </div>
      </div>
    </div>
  );
};
