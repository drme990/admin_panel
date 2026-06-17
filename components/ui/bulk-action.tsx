'use client';

import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import { LuSquareCheck, LuX } from 'react-icons/lu';
import { cn } from '@/lib/utils';

interface BulkActionOption {
  label: string;
  value: string;
}

interface BulkActionProps {
  selectedCount: number;
  value: string;
  options: BulkActionOption[];
  onValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  applyLabel: string;
  applyingLabel: string;
  clearLabel: string;
  selectionLabel: string;
  dropdownLabel: string;
  disabled?: boolean;
  loading?: boolean;
}

export default function BulkAction({
  selectedCount,
  value,
  options,
  onValueChange,
  onApply,
  onClear,
  applyLabel,
  applyingLabel,
  clearLabel,
  selectionLabel,
  dropdownLabel,
  disabled = false,
  loading = false,
}: BulkActionProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'relative rounded-xl border border-stroke',
        'bg-card-bg shadow-sm',
        'animate-in fade-in slide-in-from-top-2 duration-200',
      )}
    >
      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <LuSquareCheck size={22} />
          </div>

          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectionLabel.replace('{count}', String(selectedCount))}
            </p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-55 sm:min-w-65">
            <Dropdown
              label={dropdownLabel}
              value={value}
              options={options}
              onChange={onValueChange}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClear}
              className="flex items-center gap-2"
            >
              <LuX size={14} />
              {clearLabel}
            </Button>

            <Button
              type="button"
              variant="primary"
              onClick={onApply}
              disabled={disabled || loading || !value}
              className="min-w-32 flex items-center justify-center gap-2"
            >
              <LuSquareCheck size={16} />
              {loading ? applyingLabel : applyLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
