'use client';

import { cn } from '@/lib/utils';
import Button from './button';

interface RadioButtonProps {
  id: string;
  name: string;
  value: string;
  label?: string | React.ReactNode;
  description?: string;
  checked: boolean;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function RadioButton({
  id,
  name,
  value,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className,
}: RadioButtonProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const handleToggle = () => {
    if (!disabled) {
      onChange(value);
    }
  };

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <Button
        variant="custom"
        size="custom"
        type="button"
        role="radio"
        id={id}
        name={name}
        aria-checked={checked}
        aria-disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'relative flex items-center justify-center rounded-full border-2 transition-all duration-200',
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
        <div
          className={cn(
            'rounded-full bg-white transition-all duration-200',
            dotSizes[size],
            checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
          )}
        />
      </Button>

      {(label || description) && (
        <div
          className={cn(
            'flex flex-col gap-0.5',
            !disabled && 'cursor-pointer',
            disabled && 'opacity-50',
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onChange(value);
          }}
        >
          {label && (
            <div className="text-sm font-medium text-foreground leading-tight">
              {typeof label === 'string' ? <span>{label}</span> : label}
            </div>
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
