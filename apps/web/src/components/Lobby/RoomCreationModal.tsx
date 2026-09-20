import React, { useState } from 'react';

export interface RoomCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (maxPlayers: 2 | 6) => void;
}

export const RoomCreationModal: React.FC<RoomCreationModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [maxPlayers, setMaxPlayers] = useState<2 | 6>(2);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" data-testid="room-creation-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create Private Table</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Select the table capacity. You will receive a 6-character Room Code to invite your friends.
        </p>

        <div className="player-count-selector">
          <button
            id="select-2-players"
            type="button"
            className={`count-option-btn ${maxPlayers === 2 ? 'selected' : ''}`}
            onClick={() => setMaxPlayers(2)}
          >
            <span style={{ fontSize: '1.25rem' }}>👥</span>
            <span>2 Players</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Head to Head</span>
          </button>

          <button
            id="select-6-players"
            type="button"
            className={`count-option-btn ${maxPlayers === 6 ? 'selected' : ''}`}
            onClick={() => setMaxPlayers(6)}
          >
            <span style={{ fontSize: '1.25rem' }}>👥👥</span>
            <span>6 Players</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Full Table</span>
          </button>
        </div>

        <button
          id="btn-confirm-create-room"
          type="button"
          className="quick-match-btn"
          onClick={() => onCreate(maxPlayers)}
        >
          Create Room & Get Code
        </button>
      </div>
    </div>
  );
};
