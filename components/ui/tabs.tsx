'use client';

import { cn } from '@/lib/utils';

type TabValue = string;

interface TabsOption<T extends TabValue> {
  value: T;
  label: string;
}

interface TabsProps<T extends TabValue> {
  value: T;
  options: Array<TabsOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function Tabs<T extends TabValue>({
  value,
  options,
  onChange,
  className,
  size = 'md',
}: TabsProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-stroke bg-background p-1',
        className,
      )}
      role="tablist"
      aria-label="tabs"
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              active
                ? 'bg-secondary text-foreground'
                : 'text-secondary hover:bg-card-bg hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
