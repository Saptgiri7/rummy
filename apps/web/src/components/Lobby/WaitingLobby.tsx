import React, { useState } from 'react';
import { RoomPlayerSummary } from '@rummy/shared';

export interface WaitingLobbyProps {
  roomId: string;
  roomCode: string;
  maxPlayers: number;
  players: RoomPlayerSummary[];
  isHost: boolean;
  canStart: boolean;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export const WaitingLobby: React.FC<WaitingLobbyProps> = ({
  roomCode,
  maxPlayers,
  players,
  isHost,
  canStart,
  onStartGame,
  onLeaveRoom
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const slots = Array.from({ length: maxPlayers }, (_, idx) => players[idx] ?? null);

  return (
    <div className="waiting-lobby-container" data-testid="waiting-lobby">
      <h2>Table Waiting Lobby</h2>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px' }}>
        Share this room code with your friends to join the game!
      </p>

      {/* Shareable Room Code Banner */}
      <div className="room-code-banner">
        <span className="room-code-text">{roomCode}</span>
        <button
          id="btn-copy-room-code"
          type="button"
          className="copy-btn"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
      </div>

      {/* Players Slot Grid */}
      <div className="lobby-slots-grid">
        {slots.map((player, idx) => (
          <div
            key={`slot-${idx}`}
            className={`lobby-slot ${player ? 'filled' : ''}`}
          >
            {player ? (
              <>
                <div className={`slot-avatar ${player.isHost ? 'host' : ''}`}>
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {player.username}
                </div>
                {player.isHost && (
                  <span style={{ fontSize: '0.65rem', color: '#d4af37', fontWeight: 800 }}>
                    👑 HOST
                  </span>
                )}
              </>
            ) : (
              <>
                <div
                  className="slot-avatar"
                  style={{ background: 'transparent', border: '1px dashed rgba(255,255,255,0.2)' }}
                >
                  ?
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
                  Empty Slot
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isHost ? (
          <button
            id="btn-host-start-game"
            type="button"
            disabled={!canStart}
            className="quick-match-btn"
            onClick={onStartGame}
          >
            {canStart
              ? `Start Game (${players.length}/${maxPlayers})`
              : `Waiting for players... (min 2)`}
          </button>
        ) : (
          <div
            style={{
              padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              color: '#d4af37',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            Waiting for host to start the game...
          </div>
        )}

        <button
          id="btn-leave-lobby"
          type="button"
          onClick={onLeaveRoom}
          style={{
            padding: '10px',
            background: 'transparent',
            color: '#ef4444',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          Leave Table
        </button>
      </div>
    </div>
  );
};
