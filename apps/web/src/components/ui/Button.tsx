import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClass = 'ui-btn';
    const variantClass = `ui-btn-${variant}`;
    const sizeClass = `ui-btn-${size}`;
    const widthClass = fullWidth ? 'ui-btn-full' : '';
    const loadingClass = isLoading ? 'ui-btn-loading' : '';

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={`${baseClass} ${variantClass} ${sizeClass} ${widthClass} ${loadingClass} ${className}`.trim()}
        {...props}
      >
        {isLoading && (
          <span className="ui-btn-spinner" aria-hidden="true">
            <svg
              className="ui-spinner-svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                strokeLinecap="round"
                strokeOpacity="0.9"
              />
            </svg>
          </span>
        )}
        {!isLoading && leftIcon && <span className="ui-btn-icon-left">{leftIcon}</span>}
        <span className="ui-btn-label">{children}</span>
        {!isLoading && rightIcon && <span className="ui-btn-icon-right">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
