'use client';

import { useTranslations, useLocale } from 'next-intl';

import Tabs from '@/components/ui/tabs';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { LuSearch, LuRefreshCw } from 'react-icons/lu';

import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/order';
import type { ReviewFilter } from '../lib/invoice-utils';

type DateQuickPreset = 'today' | 'yesterday' | 'last7Days' | 'all';

interface Props {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  reviewFilter: ReviewFilter;
  onReviewChange: (value: ReviewFilter) => void;
  paymentMethodFilter: string;
  onPaymentMethodChange: (value: string) => void;
  onRefresh: () => void;
  fromDateFilter: string;
  toDateFilter: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  activeDatePreset: DateQuickPreset | 'custom';
  onDatePreset: (preset: DateQuickPreset) => void;
  locale: string;
  totalInvoices: number;
}

export default function InvoiceFilters({
  searchInput,
  onSearchChange,
  sourceFilter,
  onSourceChange,
  reviewFilter,
  onReviewChange,
  paymentMethodFilter,
  onPaymentMethodChange,
  onRefresh,
  fromDateFilter,
  toDateFilter,
  onFromDateChange,
  onToDateChange,
  activeDatePreset,
  onDatePreset,
  locale,
  totalInvoices,
}: Props) {
  const t = useTranslations('admin.invoices');

  const sourceOptions = [
    { label: t('allSources'), value: 'all' },
    { label: 'Manasik', value: 'manasik' },
    { label: 'Ghadaq', value: 'ghadaq' },
  ];

  const isAr = locale === 'ar';
  const paymentMethodOptions = [
    { label: t('allPaymentMethods'), value: 'all' },
    ...PAYMENT_METHODS.map((method) => ({
      label: isAr ? PAYMENT_METHOD_LABELS[method].ar : PAYMENT_METHOD_LABELS[method].en,
      value: method,
    })),
  ];

  const datePresetOptions: Array<{ label: string; value: DateQuickPreset }> = [
    { label: t('filters.dateModeAll'), value: 'all' },
    { label: t('filters.today'), value: 'today' },
    { label: t('filters.yesterday'), value: 'yesterday' },
    { label: t('filters.last7Days'), value: 'last7Days' },
  ];

  const reviewTabs = [
    {
      label: t('filterAll'),
      value: 'all' as ReviewFilter,
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: t('status.confirmed'),
      value: 'confirmed' as ReviewFilter,
      className: 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-300',
      activeClassName: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: t('status.waiting'),
      value: 'waiting' as ReviewFilter,
      className: 'border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-300',
      activeClassName: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    },
    {
      label: t('status.pending'),
      value: 'pending' as ReviewFilter,
      className: 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300',
      activeClassName: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    },
    {
      label: t('status.rejected'),
      value: 'rejected' as ReviewFilter,
      className: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300',
      activeClassName: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search + source + refresh */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <LuSearch size={16} className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
          />
        </div>

        <Dropdown
          value={sourceFilter}
          options={sourceOptions}
          onChange={onSourceChange}
          className="w-full sm:w-40"
        />

        <Dropdown
          value={paymentMethodFilter}
          options={paymentMethodOptions}
          onChange={onPaymentMethodChange}
          className="w-full sm:w-48"
        />

        <Button variant="icon-primary" size="custom" onClick={onRefresh} className="shrink-0">
          <LuRefreshCw size={18} />
        </Button>
      </div>

      {/* Date presets + pickers */}
      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CustomDatePicker
            value={fromDateFilter}
            onChange={onFromDateChange}
            locale={locale}
            label={t('filters.fromDate')}
            placeholder={t('filters.fromDate')}
          />
          <CustomDatePicker
            value={toDateFilter}
            onChange={onToDateChange}
            locale={locale}
            label={t('filters.toDate')}
            placeholder={t('filters.toDate')}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {datePresetOptions.map((preset) => (
            <Button
              key={preset.value}
              variant="custom"
              type="button"
              size="custom"
              onClick={() => onDatePreset(preset.value)}
              className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${activeDatePreset === preset.value
                ? 'bg-foreground border-foreground text-background shadow-sm'
                : 'bg-background border-stroke text-foreground hover:bg-foreground/5'
                }`}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Invoice status tabs */}
      <div className="overflow-x-auto pb-1">
        <Tabs<ReviewFilter>
          value={reviewFilter}
          options={reviewTabs}
          onChange={onReviewChange}
          className="min-w-max"
        />
      </div>

      {/* Total count */}
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>
          {t('total')}: {totalInvoices}
        </span>
      </div>
    </div>
  );
}
