import React, { useState, useEffect } from 'react';
import { Users, User, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export interface RoomCreationModalProps {
  isOpen: boolean;
  isConnected?: boolean;
  currentUsername?: string;
  isGuest?: boolean;
  onClose: () => void;
  onCreate: (maxPlayers: 2 | 6, chosenName?: string) => void;
}

export const RoomCreationModal: React.FC<RoomCreationModalProps> = ({
  isOpen,
  isConnected = true,
  currentUsername = '',
  isGuest = false,
  onClose,
  onCreate
}) => {
  const [maxPlayers, setMaxPlayers] = useState<2 | 6>(2);
  const [displayName, setDisplayName] = useState(currentUsername);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUsername);
    }
  }, [isOpen, currentUsername]);

  const handleConfirm = () => {
    onCreate(maxPlayers, displayName.trim() || currentUsername);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Private Table"
      subtitle="Select table capacity and confirm your player name. You'll receive a 6-character code."
      icon={<Users size={20} />}
      maxWidth="460px"
    >
      <div data-testid="room-creation-modal" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* In-game display name for guests */}
        {isGuest && (
          <Input
            id="input-create-display-name"
            label="In-Game Display Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. AcePlayer"
            leftIcon={<User size={16} />}
            helperText="What other players will see during this match (no registration required)"
          />
        )}

        <div>
          <label className="ui-input-label" style={{ marginBottom: '8px', display: 'block' }}>
            Table Capacity
          </label>
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
        </div>

        <Button
          id="btn-confirm-create-room"
          type="button"
          variant="gold"
          size="lg"
          fullWidth
          disabled={!isConnected}
          isLoading={!isConnected}
          rightIcon={<ArrowRight size={18} />}
          onClick={handleConfirm}
        >
          {isConnected ? 'Create Room & Get Code' : 'Connecting to Server...'}
        </Button>
      </div>
    </Modal>
  );
};
