'use client';

import { type ReactNode } from 'react';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { LuSquareCheck, LuRefreshCw, LuX } from 'react-icons/lu';
import { cn } from '@/lib/utils';

interface BulkActionOption {
  label: string;
  value: string;
  icon?: ReactNode;
}

interface BulkActionProps {
  selectedCount: number;
  onApply?: () => void;
  onApplyOption?: (value: string) => void;
  extraLabel?: string;
  onExtraApply?: () => void;
  extraIcon?: ReactNode;
  extraLoading?: boolean;
  extraDisabled?: boolean;
  onClear: () => void;
  applyLabel?: string;
  applyingLabel?: string;
  /** Accessible label for the small "X" clear button (not shown as text). */
  clearLabel: string;
  selectionLabel: string;
  /**
   * Set to `true` to hide the dropdown/date-picker selector and render a
   * simple "N selected — Apply / Clear" bar. Used for actions that don't
   * need a value picked first (e.g. bulk-downloading selected items).
   */
  hideSelector?: boolean;
  value?: string;
  options?: BulkActionOption[];
  applyOptions?: BulkActionOption[];
  onValueChange?: (value: string) => void;
  dropdownLabel?: string;
  /** Icon shown on the apply button (defaults to a checkmark). */
  applyIcon?: ReactNode;
  locale?: string;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Floating bulk-action bar — pinned to the bottom of the viewport so it
 * stays visible while the admin scrolls through a long list/grid. Used
 * by every page with multi-select (orders, execution, invoices,
 * customers, order-designs, ...) so the bulk-action UX stays consistent.
 */
export default function BulkAction({
  selectedCount,
  value = '',
  options = [],
  applyOptions = [],
  onValueChange,
  onApply,
  onApplyOption,
  extraLabel,
  onExtraApply,
  extraIcon,
  extraLoading,
  extraDisabled,
  onClear,
  applyLabel,
  applyingLabel,
  clearLabel,
  selectionLabel,
  dropdownLabel,
  hideSelector = false,
  applyIcon,
  locale = 'en',
  disabled = false,
  loading = false,
}: BulkActionProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="w-full mb-4">
      <div
        className={cn(
          'flex flex-col gap-3 rounded-2xl border border-stroke bg-card-bg p-3 shadow-lg sm:flex-row sm:items-center',
        )}
      >
        {/* Clear selection — icon-only, at the start */}
        <button
          type="button"
          onClick={onClear}
          disabled={loading}
          aria-label={clearLabel}
          title={clearLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary hover:text-foreground hover:bg-background transition-colors disabled:opacity-60"
        >
          <LuX size={16} />
        </button>

        {/* Selection count */}
        <p className="text-sm font-semibold text-foreground whitespace-nowrap">
          {selectionLabel.replace('{count}', String(selectedCount))}
        </p>

        {/* Optional selector (dropdown / date picker) */}
        {!hideSelector && (
          <div className="min-w-55 sm:min-w-65">
            {options.length === 0 ? (
              <CustomDatePicker
                value={value}
                onChange={(v) => onValueChange?.(v)}
                locale={locale}
                placeholder={dropdownLabel}
              />
            ) : (
              <Dropdown
                label={dropdownLabel}
                value={value}
                options={options}
                onChange={(v) => onValueChange?.(v)}
              />
            )}
          </div>
        )}

        {(onApply || applyOptions.length > 0) && (
          applyOptions.length > 0 ? (
            <div className="min-w-40">
              <Dropdown
                value=""
                options={applyOptions}
                onChange={(v) => onApplyOption?.(v)}
                placeholder={applyLabel}
                disabled={disabled || loading || selectedCount === 0}
              />
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => onApply?.()}
              disabled={disabled || loading || (!hideSelector && !value)}
              className="min-w-32 flex items-center justify-center gap-2"
            >
              {loading ? (
                <LuRefreshCw size={16} className="animate-spin" />
              ) : (
                applyIcon ?? <LuSquareCheck size={16} />
              )}
              {loading ? applyingLabel : applyLabel}
            </Button>
          )
        )}

        {onExtraApply && extraLabel && (
          <Button
            type="button"
            variant="outline"
            onClick={onExtraApply}
            disabled={extraDisabled || extraLoading || selectedCount === 0}
            className="min-w-32 flex items-center justify-center gap-2"
          >
            {extraLoading ? (
              <LuRefreshCw size={16} className="animate-spin" />
            ) : (
              extraIcon ?? <LuSquareCheck size={16} />
            )}
            {extraLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
