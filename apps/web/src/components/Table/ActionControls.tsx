import React from 'react';
import { TurnTimer } from './TurnTimer.js';

export interface ActionControlsProps {
  isMyTurn: boolean;
  turnPhase: 'WAITING_DRAW' | 'WAITING_DISCARD' | 'ROUND_ENDED';
  selectedCardCount: number;
  isFirstTurn: boolean;
  onDiscard: () => void;
  onDeclare: () => void;
  onDrop: () => void;
  remainingTurnTimeMs?: number;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  isMyTurn,
  turnPhase,
  selectedCardCount,
  isFirstTurn,
  onDiscard,
  onDeclare,
  onDrop,
  remainingTurnTimeMs = 30000
}) => {
  const canDiscard = isMyTurn && turnPhase === 'WAITING_DISCARD' && selectedCardCount === 1;
  const canDeclare = isMyTurn && turnPhase === 'WAITING_DISCARD' && selectedCardCount === 1;
  const canDrop = isMyTurn && turnPhase === 'WAITING_DRAW';

  const dropPenalty = isFirstTurn ? 20 : 40;

  return (
    <div className="action-controls-dock">
      {/* 1. Drop Button */}
      <button
        id="btn-drop-hand"
        type="button"
        disabled={!canDrop}
        onClick={onDrop}
        className="btn-game-action drop"
        title={`Drop hand and incur ${dropPenalty} points penalty`}
      >
        Drop ({dropPenalty} pts)
      </button>

      {/* 2. Turn Countdown Timer */}
      {isMyTurn && (
        <TurnTimer
          remainingMs={remainingTurnTimeMs}
          isActive={isMyTurn}
          totalDurationMs={30000}
        />
      )}

      {/* 3. Discard Button */}
      <button
        id="btn-discard-card"
        type="button"
        disabled={!canDiscard}
        onClick={onDiscard}
        className="btn-game-action discard"
      >
        Discard
      </button>

      {/* 4. Declare / Show Button */}
      <button
        id="btn-declare-show"
        type="button"
        disabled={!canDeclare}
        onClick={onDeclare}
        className="btn-game-action declare"
      >
        Declare Finish
      </button>
    </div>
  );
};
