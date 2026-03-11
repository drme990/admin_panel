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
        'flex flex-col gap-4 rounded-xl border border-stroke',
        'bg-card-bg/90 backdrop-blur-sm',
        'p-4 shadow-sm',
        'animate-in fade-in slide-in-from-top-2 duration-200',
        'md:flex-row md:items-center md:justify-between',
      )}
    >
      {/* LEFT SIDE */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Selection Badge */}
        <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
          <LuSquareCheck size={16} />
          {selectionLabel.replace('{count}', String(selectedCount))}
        </div>

        {/* Status Dropdown */}
        <div className="min-w-50">
          <Dropdown
            label={dropdownLabel}
            value={value}
            options={options}
            onChange={onValueChange}
          />
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
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
          className="min-w-27.5"
        >
          {loading ? applyingLabel : applyLabel}
        </Button>
      </div>
    </div>
  );
}
