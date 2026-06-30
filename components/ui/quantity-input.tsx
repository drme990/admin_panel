'use client';

import { LuMinus, LuPlus } from 'react-icons/lu';
import Button from '@/components/ui/button';

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

  const btnSize = compact ? 'h-6 w-6' : 'h-7 w-7';
  const iconSize = compact ? 14 : 16;
  const inputPadding = compact ? 'px-7 py-2 text-sm' : 'px-10 py-2';

  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-medium text-foreground mb-2">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="custom"
          className={`absolute left-1.5 z-10 ${btnSize} p-0 text-secondary hover:text-foreground`}
          onClick={decrement}
          disabled={disabled || value <= min}
          aria-label="Decrease quantity"
        >
          <LuMinus size={iconSize} />
        </Button>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))}
          className={`w-full ${inputPadding} rounded-lg border border-stroke bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-success disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <Button
          type="button"
          variant="ghost"
          size="custom"
          className={`absolute right-1.5 z-10 ${btnSize} p-0 text-secondary hover:text-foreground`}
          onClick={increment}
          disabled={disabled || (max !== undefined && value >= max)}
          aria-label="Increase quantity"
        >
          <LuPlus size={iconSize} />
        </Button>
      </div>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
}
