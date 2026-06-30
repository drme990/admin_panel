'use client';

import { LuMinus, LuPlus } from 'react-icons/lu';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
}

export default function QuantityInput({
  value,
  onChange,
  min = 0,
  max,
  label,
  error,
  disabled,
  compact = false,
}: QuantityInputProps) {
  const clamp = (n: number) => {
    let v = Number.isFinite(n) ? n : min;
    if (v < min) v = min;
    if (max !== undefined && v > max) v = max;
    return v;
  };

  const decrement = () => onChange(clamp(value - 1));
  const increment = () => onChange(clamp(value + 1));

  const circleSize = compact ? 'w-7 h-7' : 'w-8 h-8';
  const iconSize = compact ? 14 : 16;
  const numText = compact ? 'text-base' : 'text-xl';
  const numWidth = compact ? 'w-4' : 'w-6';

  return (
    <div className="flex flex-col items-center justify-center gap-2 h-full">
      {label && (
        <span className="text-foreground font-medium text-sm">{label}</span>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={increment}
          disabled={disabled || (max !== undefined && value >= max)}
          aria-label="Increase quantity"
          className={`${circleSize} rounded-full bg-primary text-primary-text flex items-center justify-center hover:bg-primary/80 transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <LuPlus size={iconSize} />
        </button>
        <span className={`${numText} font-bold text-foreground ${numWidth} text-center`}>
          {value}
        </span>
        <button
          type="button"
          onClick={decrement}
          disabled={disabled || value <= min}
          aria-label="Decrease quantity"
          className={`${circleSize} rounded-full bg-primary text-primary-text flex items-center justify-center hover:bg-primary/80 transition-colors shadow disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <LuMinus size={iconSize} />
        </button>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
