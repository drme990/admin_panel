'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { LuClock } from 'react-icons/lu';

interface TimePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

const TimePicker = forwardRef<HTMLInputElement, TimePickerProps>(
  (
    {
      label,
      error,
      helperText,
      fullWidth = true,
      className,
      id,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const hasValue = Boolean(value && String(value).trim());

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {props.required && <span className="text-error ml-1">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type="time"
            value={value}
            onChange={onChange}
            className={cn(
              'w-full px-4 py-2 rounded-lg border bg-background text-foreground',
              'focus:outline-none focus:ring-2 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'placeholder:text-secondary/50',
              '[&::-webkit-calendar-picker-indicator]:opacity-0',
              '[&::-webkit-calendar-picker-indicator]:absolute',
              '[&::-webkit-calendar-picker-indicator]:right-0',
              '[&::-webkit-calendar-picker-indicator]:w-full',
              '[&::-webkit-calendar-picker-indicator]:h-full',
              '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
              error
                ? 'border-error focus:ring-error/20 focus:border-error'
                : 'border-stroke focus:ring-primary focus:border-success',
              className,
            )}
            {...props}
          />
          <div className="absolute right-3 flex items-center pointer-events-none">
            {hasValue ? (
              <span className="text-sm font-semibold text-foreground">
                {String(value)}
              </span>
            ) : (
              <LuClock size={18} className="text-secondary" />
            )}
          </div>
        </div>
        {(error || helperText) && (
          <p className={cn('text-sm', error ? 'text-error' : 'text-secondary')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

TimePicker.displayName = 'TimePicker';

export default TimePicker;
