import React, { useState, useEffect } from 'react';
import { LogIn, ArrowRight, Hash, User } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface RoomJoinModalProps {
  isOpen: boolean;
  isConnected?: boolean;
  currentUsername?: string;
  isGuest?: boolean;
  onClose: () => void;
  onJoin: (roomCode: string, chosenName?: string) => void;
}

export const RoomJoinModal: React.FC<RoomJoinModalProps> = ({
  isOpen,
  isConnected = true,
  currentUsername = '',
  isGuest = false,
  onClose,
  onJoin
}) => {
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(currentUsername);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentUsername);
    }
  }, [isOpen, currentUsername]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length >= 3) {
      onJoin(code.trim().toUpperCase(), displayName.trim() || currentUsername);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Join Friend's Table"
      subtitle="Enter the 6-character room code shared by the table host (e.g. RUM782)."
      icon={<LogIn size={20} />}
      maxWidth="440px"
    >
      <div data-testid="room-join-modal">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isGuest && (
            <Input
              id="input-join-display-name"
              label="In-Game Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. AcePlayer"
              leftIcon={<User size={16} />}
              helperText="How other players will identify you at the table"
            />
          )}

          <Input
            id="input-room-code"
            label="Table Room Code"
            type="text"
            placeholder="e.g. RUM782"
            value={code}
            maxLength={10}
            autoFocus
            leftIcon={<Hash size={18} />}
            helperText="6 uppercase alphanumeric characters"
            isRequired
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />

          <Button
            id="btn-confirm-join-room"
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            disabled={code.trim().length < 3 || !isConnected}
            isLoading={!isConnected}
            rightIcon={<ArrowRight size={18} />}
          >
            {isConnected ? 'Join Table' : 'Connecting to Server...'}
          </Button>
        </form>
      </div>
    </Modal>
  );
};
