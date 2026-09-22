import React, { useEffect, useRef, ReactNode } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  maxWidth = '480px',
  showCloseButton = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'ui-modal-title' : undefined}
        className="ui-modal-card"
        style={{ maxWidth }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="ui-modal-header">
            <div className="ui-modal-title-group">
              {icon && <span className="ui-modal-header-icon">{icon}</span>}
              <div>
                {title && (
                  <h3 id="ui-modal-title" className="ui-modal-title">
                    {title}
                  </h3>
                )}
                {subtitle && <p className="ui-modal-subtitle">{subtitle}</p>}
              </div>
            </div>

            {showCloseButton && (
              <button
                type="button"
                className="ui-modal-close-btn"
                aria-label="Close dialog"
                onClick={onClose}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body Content */}
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
};
