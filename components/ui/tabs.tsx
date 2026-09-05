'use client';

import { cn } from '@/lib/utils';
import Tooltip from './tooltip';

import type { ReactNode } from 'react';

type TabValue = string;

interface TabsOption<T extends TabValue> {
  value: T;
  label: ReactNode;
  ariaLabel?: string;
  className?: string;
  activeClassName?: string;
  tooltip?: string;
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

interface TabsProps<T extends TabValue> {
  value: T;
  options: Array<TabsOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Tabs<T extends TabValue>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: TabsProps<T>) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-[11px]',
    md: 'px-3 py-1.5 text-xs',
    lg: 'px-4 py-2 text-sm',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-md',
        className,
      )}
      role="tablist"
      aria-label="tabs"
    >
      {options.map((option) => {
        const active = option.value === value;

        const button = (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg font-medium transition',
              sizeClasses[size],
              active
                ? option.activeClassName || 'gradient-site gradient-text'
                : option.className || 'text-white/80 hover:bg-white/10',
            )}
          >
            {option.label}
          </button>
        );

        if (option.tooltip) {
          return (
            <Tooltip
              key={option.value}
              position={option.tooltipPosition || 'top'}
              content={option.tooltip}
            >
              {button}
            </Tooltip>
          );
        }

        return button;
      })}
    </div>
  );
}
