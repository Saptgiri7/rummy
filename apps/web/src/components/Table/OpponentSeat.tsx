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

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
          {username}
        </div>
        {isDisconnected ? (
          <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>
            Disconnected
          </span>
        ) : isActiveTurn ? (
          <span style={{ fontSize: '0.7rem', color: '#d4af37', fontWeight: 700 }}>
            Thinking...
          </span>
        ) : null}
      </div>

      {/* Mini Turn Timer if active turn */}
      {isActiveTurn && (
        <div style={{ transform: 'scale(0.65)', marginTop: '-8px', marginBottom: '-8px' }}>
          <TurnTimer totalDurationMs={turnTimeoutMs} />
        </div>
      )}
    </div>
  );
};
