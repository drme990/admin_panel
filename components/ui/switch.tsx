import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface SwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, onChange, checked, disabled, id, label }, ref) => {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          ref={ref}
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300',
            'focus:outline-none focus:ring-2 focus:ring-success focus:ring-offset-2',
            checked ? 'bg-success' : 'bg-stroke',
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          <span
            className={cn(
              'absolute left-1 h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-300',
              checked ? 'translate-x-5' : 'translate-x-0',
            )}
          />
        </button>

        {label && (
          <label
            htmlFor={id}
            className={cn(
              'text-sm text-foreground',
              disabled ? 'opacity-50' : 'cursor-pointer',
            )}
            onClick={() => !disabled && onChange(!checked)}
          >
            {label}
          </label>
        )}
      </div>
    );
  },
);

Switch.displayName = 'Switch';

export default Switch;
