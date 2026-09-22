import React, { forwardRef, SelectHTMLAttributes, ReactNode, useId } from 'react';

export interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: DropdownOption[];
  helperText?: string;
  error?: string | null;
  leftIcon?: ReactNode;
}

export const Dropdown = forwardRef<HTMLSelectElement, DropdownProps>(
  (
    {
      label,
      options,
      helperText,
      error,
      leftIcon,
      id,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;

    return (
      <div className={`ui-dropdown-group ${error ? 'has-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        {label && (
          <label htmlFor={selectId} className="ui-input-label">
            {label}
          </label>
        )}

        <div className="ui-dropdown-wrapper">
          {leftIcon && <span className="ui-dropdown-icon-left">{leftIcon}</span>}
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={`ui-dropdown ${leftIcon ? 'with-left-icon' : ''} ${className}`.trim()}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="ui-dropdown-chevron" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {error && <p className="ui-input-error">{error}</p>}
        {!error && helperText && <p className="ui-input-helper">{helperText}</p>}
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';
