'use client';

import { cn } from '@/lib/utils';
import { LuCheck } from 'react-icons/lu';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export default function Checkbox({
  checked,
  onChange,
  onClick,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
  id,
}: CheckboxProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (!disabled) {
      onChange(!checked);
    }

    onClick?.(e);
  };

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center rounded-md border-2 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-success/30',
          'active:scale-95',
          sizes[size],

          checked
            ? 'bg-success border-success'
            : 'bg-background border-stroke hover:border-success/60',

          disabled && 'opacity-50 cursor-not-allowed',
          !disabled && 'cursor-pointer',
        )}
      >
        {/* Animated Check */}
        <LuCheck
          size={iconSizes[size]}
          strokeWidth={3}
          className={cn(
            'text-white transition-all duration-200',
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </button>

      {(label || description) && (
        <div
          className={cn(
            'flex flex-col gap-0.5',
            !disabled && 'cursor-pointer',
            disabled && 'opacity-50',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(!checked);
          }}
        >
          {label && (
            <span className="text-sm font-medium text-foreground leading-tight">
              {label}
            </span>
          )}

          {description && (
            <span className="text-xs text-secondary leading-tight">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
