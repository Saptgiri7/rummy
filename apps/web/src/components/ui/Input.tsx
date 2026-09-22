import React, { forwardRef, InputHTMLAttributes, ReactNode, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  isRequired?: boolean;
  showPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      isRequired = false,
      showPasswordToggle = false,
      type = 'text',
      id,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const effectiveType = type === 'password' && isPasswordVisible ? 'text' : type;
    const isPasswordField = type === 'password' && showPasswordToggle;

    return (
      <div className={`ui-input-group ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        {label && (
          <label htmlFor={inputId} className="ui-input-label">
            {label}
            {isRequired && <span className="ui-input-required-mark">*</span>}
          </label>
        )}

        <div className="ui-input-wrapper">
          {leftIcon && <span className="ui-input-icon-left">{leftIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            type={effectiveType}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`ui-input ${leftIcon ? 'with-left-icon' : ''} ${rightIcon || isPasswordField ? 'with-right-icon' : ''} ${className}`.trim()}
            {...props}
          />
          {isPasswordField ? (
            <button
              type="button"
              className="ui-input-password-toggle"
              onClick={() => setIsPasswordVisible((v) => !v)}
              tabIndex={-1}
              aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px'
              }}
            >
              {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : (
            rightIcon && <span className="ui-input-icon-right">{rightIcon}</span>
          )}
        </div>

        {error && (
          <p id={errorId} className="ui-input-error" role="alert">
            <svg
              className="ui-input-error-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="ui-input-helper">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
