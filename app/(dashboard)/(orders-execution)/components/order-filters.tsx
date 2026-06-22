import { useTranslations } from 'next-intl';

import Tabs from '@/components/ui/tabs';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { Referral } from '@/types/Referral';
import { OrderStatus } from '@/types/Order';
import { LuSearch, LuRefreshCw } from 'react-icons/lu';
import { STATUS_COLORS } from '../lib/order-status';

type StatusTabValue = 'all' | OrderStatus;
type WhatsappFilterValue = 'all' | 'clicked' | 'not-clicked' | 'no-need-to-click';
type DateQuickPreset = 'today' | 'yesterday' | 'last7Days' | 'all';

interface Props {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sourceFilter: string;
  onSourceChange: (value: string) => void;
  whatsappFilter: WhatsappFilterValue;
  onWhatsappChange: (value: WhatsappFilterValue) => void;
  onRefresh: () => void;
  fromDateFilter: string;
  toDateFilter: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  activeDatePreset: DateQuickPreset | 'custom';
  onDatePreset: (preset: DateQuickPreset) => void;
  locale: string;
  referralFilter: string;
  onReferralChange: (value: string) => void;
  referrals: Referral[];
  statusFilter: StatusTabValue;
  onStatusChange: (value: StatusTabValue) => void;
  totalOrders: number;
}

export default function OrderFilters({
  searchInput,
  onSearchChange,
  sourceFilter,
  onSourceChange,
  whatsappFilter,
  onWhatsappChange,
  onRefresh,
  fromDateFilter,
  toDateFilter,
  onFromDateChange,
  onToDateChange,
  activeDatePreset,
  onDatePreset,
  locale,
  referralFilter,
  onReferralChange,
  referrals,
  statusFilter,
  onStatusChange,
  totalOrders,
}: Props) {
  const t = useTranslations('orders');

  const sourceOptions = [
    { label: t('filters.allSources'), value: '' },
    { label: t('filters.manasikSource'), value: 'manasik' },
    { label: t('filters.ghadaqSource'), value: 'ghadaq' },
  ];

  const datePresetOptions: Array<{ label: string; value: DateQuickPreset }> = [
    { label: t('filters.dateModeAll'), value: 'all' },
    { label: t('filters.today'), value: 'today' },
    { label: t('filters.yesterday'), value: 'yesterday' },
    { label: t('filters.last7Days'), value: 'last7Days' },
  ];

  const referralTabOptions = [
    {
      label: t('filters.allReferrals'),
      value: '',
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: 'MNK-D',
      value: 'MNK-D',
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: 'GHD-D',
      value: 'GHD-D',
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    ...referrals.map((referral) => ({
      label: `${referral.name} (${referral.referralId})`,
      value: referral.referralId,
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    })),
  ];

  const statusTabOptions = [
    {
      label: t('filters.all'),
      value: 'all' as const,
      className: 'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: t('status.paid'),
      value: 'paid' as const,
      className: 'border border-green-200 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-300',
      activeClassName: STATUS_COLORS.paid,
    },
    {
      label: t('status.partial-paid'),
      value: 'partial-paid' as const,
      className: 'border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-300',
      activeClassName: STATUS_COLORS['partial-paid'],
    },
    {
      label: t('status.completed'),
      value: 'completed' as const,
      className: 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300',
      activeClassName: STATUS_COLORS.completed,
    },
    {
      label: t('status.failed'),
      value: 'failed' as const,
      className: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300',
      activeClassName: STATUS_COLORS.failed,
    },
    {
      label: t('status.processing'),
      value: 'processing' as const,
      className: 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300',
      activeClassName: STATUS_COLORS.processing,
    },
    {
      label: t('status.pending'),
      value: 'pending' as const,
      className: 'border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/60 dark:bg-yellow-900/20 dark:text-yellow-300',
      activeClassName: STATUS_COLORS.pending,
    },
    {
      label: t('status.refunded'),
      value: 'refunded' as const,
      className: 'border border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800/60 dark:bg-purple-900/20 dark:text-purple-300',
      activeClassName: STATUS_COLORS.refunded,
    },
    {
      label: t('status.cancelled'),
      value: 'cancelled' as const,
      className: 'border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800/60 dark:bg-gray-900/20 dark:text-gray-300',
      activeClassName: STATUS_COLORS.cancelled,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Search + source + whatsapp + refresh */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <LuSearch size={16} className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary" />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
          />
        </div>

        <Dropdown
          value={sourceFilter}
          options={sourceOptions}
          onChange={onSourceChange}
          placeholder={t('filters.source')}
          className="w-full sm:w-40"
        />

        <Dropdown
          value={whatsappFilter}
          options={[
            { label: t('filters.whatsappStateAll'), value: 'all' },
            { label: t('filters.whatsappStateClicked'), value: 'clicked' },
            { label: t('filters.whatsappStateNotClicked'), value: 'not-clicked' },
          ]}
          onChange={(val) => onWhatsappChange(val as WhatsappFilterValue)}
          placeholder={t('filters.whatsappState')}
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

      {/* Referral tabs */}
      <div className="overflow-x-auto pb-1">
        <Tabs<string>
          value={referralFilter}
          options={referralTabOptions}
          onChange={onReferralChange}
          className="min-w-max"
        />
      </div>

      {/* Status tabs */}
      <div className="overflow-x-auto pb-1">
        <Tabs<StatusTabValue>
          value={statusFilter}
          options={statusTabOptions}
          onChange={onStatusChange}
          className="min-w-max"
        />
      </div>

      {/* Total count */}
      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>
          {t('total')}: {totalOrders}
        </span>
      </div>
    </div>
  );
}
