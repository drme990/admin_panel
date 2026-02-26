import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  /**
   * Size of the loading spinner
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Text to display alongside the loading indicator
   */
  text?: string;
  /**
   * Whether to show the loading indicator inline
   * @default false
   */
  inline?: boolean;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Custom className for the spinner
   */
  spinnerClassName?: string;
  /**
   * Custom className for the text
   */
  textClassName?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

const textSizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

export default function Loading({
  size = 'md',
  text,
  inline = false,
  className,
  spinnerClassName,
  textClassName,
}: LoadingProps) {
  if (inline) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <Loader2
          className={cn(
            'animate-spin text-primary',
            sizeClasses[size],
            spinnerClassName,
          )}
        />
        {text && (
          <span className={cn(textSizeClasses[size], textClassName)}>
            {text}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 p-4',
        className,
      )}
    >
      <Loader2
        className={cn(
          'animate-spin text-primary',
          sizeClasses[size],
          spinnerClassName,
        )}
      />
      {text && (
        <span
          className={cn('text-center', textSizeClasses[size], textClassName)}
        >
          {text}
        </span>
      )}
    </div>
  );
}

// Page-level loading component
export function PageLoading({
  text,
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('min-h-screen flex items-center justify-center', className)}
    >
      <Loading size="lg" text={text} />
    </div>
  );
}

// Inline loading component for buttons/forms
export function InlineLoading({
  size = 'sm',
  text,
  className,
}: Omit<LoadingProps, 'inline'>) {
  return <Loading size={size} text={text} inline className={className} />;
}
