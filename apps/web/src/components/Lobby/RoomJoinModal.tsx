import React, { useState } from 'react';

export interface RoomJoinModalProps {
  isOpen: boolean;
  isConnected?: boolean;
  onClose: () => void;
  onJoin: (roomCode: string) => void;
}

export const RoomJoinModal: React.FC<RoomJoinModalProps> = ({
  isOpen,
  isConnected = true,
  onClose,
  onJoin
}) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length >= 3) {
      onJoin(code.trim().toUpperCase());
    }
  };

  return (
    <div className="modal-overlay" data-testid="room-join-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Join Friend's Table</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Enter the 6-character Room Code shared by your friend (e.g. RUM782).
        </p>

        <form onSubmit={handleSubmit}>
          <input
            id="input-room-code"
            type="text"
            className="input-field"
            placeholder="e.g. RUM782"
            value={code}
            maxLength={10}
            autoFocus
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />

          <button
            id="btn-confirm-join-room"
            type="submit"
            disabled={code.trim().length < 3 || !isConnected}
            className="quick-match-btn"
            style={{ opacity: !isConnected || code.trim().length < 3 ? 0.6 : 1, cursor: !isConnected ? 'not-allowed' : 'pointer' }}
          >
            {isConnected ? 'Join Table' : 'Connecting to Server...'}
          </button>
        </form>
      </div>
    </div>
  );
};
