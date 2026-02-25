import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      className,
      id,
      type = 'text',
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cn(
            'w-full px-4 py-2 rounded-lg border bg-background text-foreground',
            'focus:outline-none focus:ring-2 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:text-secondary/50',
            error
              ? 'border-error focus:ring-error/20 focus:border-error'
              : 'border-stroke focus:ring-success/20 focus:border-success',
            className,
          )}
          {...props}
        />
        {(error || helperText) && (
          <p className={cn('text-sm', error ? 'text-error' : 'text-secondary')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';

export default Input;
