import React, { ReactNode } from 'react';

export type BadgeVariant = 'gold' | 'emerald' | 'amber' | 'slate' | 'rose';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'slate',
  size = 'md',
  icon,
  children,
  className = ''
}) => {
  return (
    <span className={`ui-badge ui-badge-${variant} ui-badge-${size} ${className}`.trim()}>
      {icon && <span className="ui-badge-icon">{icon}</span>}
      <span className="ui-badge-text">{children}</span>
    </span>
  );
};
