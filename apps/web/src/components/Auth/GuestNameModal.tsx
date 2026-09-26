import React, { useState, useEffect } from 'react';
import { User, Sparkles, LogIn } from 'lucide-react';
import { Modal, Input, Button, Badge } from '../ui/index.js';

export interface GuestNameModalProps {
  isOpen: boolean;
  currentName: string;
  onConfirm: (customName: string) => void;
  onClose: () => void;
  onOpenAuthModal?: () => void;
  actionTitle?: string;
}

export const GuestNameModal: React.FC<GuestNameModalProps> = ({
  isOpen,
  currentName,
  onConfirm,
  onClose,
  onOpenAuthModal,
  actionTitle = 'Join Table'
}) => {
  const [displayName, setDisplayName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(currentName);
      setError(null);
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = displayName.trim();

    if (clean.length < 3) {
      setError('Display name must be at least 3 characters.');
      return;
    }

    if (clean.length > 16) {
      setError('Display name cannot exceed 16 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_ ]+$/.test(clean)) {
      setError('Display name can only contain letters, numbers, and spaces.');
      return;
    }

    setError(null);
    onConfirm(clean);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Your Table Name"
      subtitle="Playing as Guest. Zero chips, pure skill"
      icon={<Sparkles size={20} />}
      maxWidth="440px"
    >
      <form onSubmit={handleSubmit} className="guest-name-form">
        <div style={{ marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Badge variant="emerald" size="sm">Guest Mode</Badge>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No account required</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
            Set the display name your opponents will see at the table for this session:
          </p>
        </div>

        <Input
          id="guest-display-name-input"
          label="Your Display Name"
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. AceKing_99"
          error={error}
          leftIcon={<User size={18} />}
          isRequired
          autoFocus
          maxLength={16}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <Button
            id="btn-confirm-guest-name"
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
          >
            Continue to {actionTitle}
          </Button>

          {onOpenAuthModal && (
            <Button
              id="btn-switch-to-login"
              type="button"
              variant="ghost"
              size="md"
              fullWidth
              leftIcon={<LogIn size={16} />}
              onClick={() => {
                onClose();
                onOpenAuthModal();
              }}
            >
              Have an account? Sign In / Register
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};
