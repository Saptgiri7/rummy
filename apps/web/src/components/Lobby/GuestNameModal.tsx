import React, { useState, useEffect } from 'react';
import { User, ArrowRight, LogIn } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export interface GuestNameModalProps {
  isOpen: boolean;
  currentName: string;
  onClose: () => void;
  onConfirm: (chosenName: string) => void;
  onOpenAuthModal?: () => void;
}

export const GuestNameModal: React.FC<GuestNameModalProps> = ({
  isOpen,
  currentName,
  onClose,
  onConfirm,
  onOpenAuthModal
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || clean.length < 3) {
      setError('Display name must be at least 3 characters.');
      return;
    }
    if (clean.length > 20) {
      setError('Display name cannot exceed 20 characters.');
      return;
    }
    onConfirm(clean);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Your Display Name"
      subtitle="Enter the name that will be displayed at the table. No account required."
      icon={<User size={20} />}
      maxWidth="440px"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Input
          id="input-guest-display-name"
          label="In-Game Player Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. RoyalAce77"
          leftIcon={<User size={18} />}
          error={error}
          helperText="3 to 20 characters. Letters, numbers, and underscores."
          isRequired
          autoFocus
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          <Button
            id="btn-confirm-guest-name"
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            rightIcon={<ArrowRight size={18} />}
          >
            Continue as Guest
          </Button>

          {onOpenAuthModal && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<LogIn size={15} />}
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
              >
                Already have an account? Sign In
              </Button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
