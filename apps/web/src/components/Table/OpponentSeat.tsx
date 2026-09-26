import React from 'react';
import { TurnTimer } from './TurnTimer.js';

export interface OpponentSeatProps {
  id: string;
  username: string;
  cardCount: number;
  isActiveTurn: boolean;
  isDisconnected?: boolean;
  turnTimeoutMs?: number;
}

export const OpponentSeat: React.FC<OpponentSeatProps> = ({
  id,
  username,
  cardCount = 13,
  isActiveTurn = false,
  isDisconnected = false,
  turnTimeoutMs = 30000
}) => {
  const initial = username.charAt(0).toUpperCase();

  return (
    <div
      id={`seat-${id}`}
      className={`opponent-card ${isActiveTurn ? 'active-turn' : ''}`}
    >
      <div className="opponent-avatar">
        {initial}
        <span className="card-count-badge">{cardCount}</span>
      </div>

      <div className="opponent-info-col">
        <div className="opponent-username">
          {username}
        </div>
        {isDisconnected ? (
          <span className="opponent-disconnected-badge">
            <span className="status-dot disconnected" />
            Disconnected
          </span>
        ) : isActiveTurn ? (
          <span className="opponent-active-badge">
            ACTIVE TURN
          </span>
        ) : null}
      </div>

      {/* Mini Turn Timer if active turn */}
      {isActiveTurn && (
        <div className="opponent-timer-wrap">
          <TurnTimer totalDurationMs={turnTimeoutMs} />
        </div>
      )}
    </div>
  );
};
