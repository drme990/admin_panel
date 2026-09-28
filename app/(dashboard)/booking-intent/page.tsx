'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuSearch,
  LuRefreshCw,
  LuPhoneOutgoing,
  LuUserCheck,
  LuUserMinus,
  LuRotateCcw,
  LuEye,
  LuTrophy,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa';

import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Tabs from '@/components/ui/tabs';
import Dropdown from '@/components/ui/dropdown';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Modal from '@/components/ui/modal';
import Textarea from '@/components/ui/textarea';
import RadioButton from '@/components/ui/radio-button';
import CustomDatePicker from '@/components/ui/custom-date-picker';

import { useAuth } from '@/components/providers/auth-provider';
import OrderDetailModal from '@/components/order/order-detail-modal';
import CountrySelector from '@/components/shared/country-selector';
import ReferralFilter, {
  type ReferralFilterItem,
} from '@/components/shared/referral-filter';
import {
  getRelativeIsoDate,
  normalizeWhatsappPhone,
} from '@/lib/order/order-utils';
import { buildBookingIntentWhatsappMessage } from '@/lib/order-whatsapp';
import { RESERVATION_FIELD_PRESETS } from '@/lib/reservation-fields';
import type { Category } from '@/types/Category';
import type { Order } from '@/types/Order';

type IntentStatus = 'new' | 'contacted' | 'refused' | 'converted' | 'closed';
type StatusTab = 'all' | 'new' | 'contacted' | 'refused' | 'converted';
type DateQuickPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'custom';

interface IntentAdmin {
  adminId: string;
  name: string;
  email: string;
}

interface BookingIntentRow {
  _id: string;
  orderId: string;
  orderNumber: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
  };
  items: { productName: { ar: string; en: string }; quantity: number }[];
  itemsSummary: string;
  reservationName?: string;
  amount: number;
  currency: string;
  source?: 'manasik' | 'ghadaq';
  paymentAttemptCount: number;
  /** How many orders the customer abandoned for this product set. */
  attemptCount: number;
  orderCreatedAt: string;
  status: IntentStatus;
  assignedTo?: IntentAdmin;
  assignedAt?: string;
  resolvedAt?: string;
  resolvedBy?: 'admin' | 'auto';
  autoReason?: 'paid' | 'purchased_elsewhere' | 'cancelled';
  note?: string;
  openIntentCount: number;
}

interface IntentListResponse {
  intents: BookingIntentRow[];
  statusCounts: Record<string, number>;
  assignedAdmins: { adminId: string; name: string }[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalIntents: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  displayDelayMinutes: number;
}

interface AdminStats {
  adminId: string;
  name: string;
  email: string;
  claimed: number;
  contacted: number;
  converted: number;
  refused: number;
  conversionRate: number;
}

const STATUS_BADGE: Record<IntentStatus, string> = {
  new: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  contacted:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  refused: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  converted:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function formatAttemptedAt(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function relativeAge(value: string): { count: number; unit: 'm' | 'h' | 'd' } {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return { count: Math.max(minutes, 1), unit: 'm' };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { count: hours, unit: 'h' };
  return { count: Math.floor(hours / 24), unit: 'd' };
}

export default function BookingIntentPage() {
  const t = useTranslations('admin.bookingIntent');
  const locale = useLocale();
  const { user } = useAuth();
  const canSeeStats =
    user?.role === 'super_admin' ||
    (user?.allowedActions?.includes('achievements') ?? false);
  const tooltipPos = (locale === 'ar' ? 'right' : 'left') as
    | 'left'
    | 'right';

  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [intentionFilter, setIntentionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [referralFilter, setReferralFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => getRelativeIsoDate(0));
  const [toDate, setToDate] = useState(() => getRelativeIsoDate(0));
  const [activeDatePreset, setActiveDatePreset] =
    useState<DateQuickPreset>('today');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(52);
  const [categories, setCategories] = useState<Category[]>([]);
  const [referrals, setReferrals] = useState<ReferralFilterItem[]>([]);

  const [data, setData] = useState<IntentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

  const [resolveTarget, setResolveTarget] =
    useState<BookingIntentRow | null>(null);
  const [resolveOutcome, setResolveOutcome] =
    useState<'refused' | 'converted'>('refused');
  const [resolveNote, setResolveNote] = useState('');
  const [resolveBusy, setResolveBusy] = useState(false);

  // Debounce the search box so we don't hit the API per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchIntents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          status: statusTab,
          page: String(page),
          limit: String(pageSize),
        });
        if (assignedFilter !== 'all')
          params.set('assignedTo', assignedFilter);
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (categoryFilter !== 'all')
          params.set('category', categoryFilter);
        if (intentionFilter !== 'all')
          params.set('intention', intentionFilter);
        if (countryFilter) params.set('country', countryFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (search) params.set('search', search);
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);

        const res = await fetch(`/api/booking-intents?${params}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          toast.error(t('loadFailed'));
        }
      } catch {
        toast.error(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [statusTab, assignedFilter, sourceFilter, categoryFilter, intentionFilter, countryFilter, referralFilter, search, fromDate, toDate, page, pageSize, t],
  );

  const fetchStats = useCallback(async () => {
    if (!canSeeStats) return;
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      const res = await fetch(`/api/booking-intents/stats?${params}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setStats(json.data.admins);
    } catch {
      // Stats are additive — failures don't block the page.
    } finally {
      setStatsLoading(false);
    }
  }, [canSeeStats, fromDate, toDate]);

  useEffect(() => {
    void fetchIntents();
  }, [fetchIntents]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // Filter option sources — same endpoints the execution page uses.
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCategories(data.data.categories);
      })
      .catch((err) => console.error('Error fetching categories:', err));
    fetch('/api/referrals?limit=100', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setReferrals(data.data.referrals);
      })
      .catch((err) => console.error('Error fetching referrals:', err));
  }, []);

  const applyDatePreset = (preset: DateQuickPreset) => {
    setActiveDatePreset(preset);
    setPage(1);
    if (preset === 'all' || preset === 'custom') {
      if (preset === 'all') {
        setFromDate('');
        setToDate('');
      }
      return;
    }
    const offsets: Record<string, [number, number]> = {
      today: [0, 0],
      yesterday: [-1, -1],
      last7Days: [-6, 0],
    };
    const [fromOffset, toOffset] = offsets[preset];
    setFromDate(getRelativeIsoDate(fromOffset));
    setToDate(getRelativeIsoDate(toOffset));
  };

  const isMine = useCallback(
    (intent: BookingIntentRow) =>
      intent.assignedTo?.adminId === user?._id,
    [user?._id],
  );

  // ── Actions ────────────────────────────────────────────────────────

  const openWhatsApp = (intent: BookingIntentRow) => {
    const phone = normalizeWhatsappPhone(intent.customer.phone);
    if (!phone) {
      toast.error(t('noPhone'));
      return;
    }
    const firstItem = intent.items[0];
    const message = buildBookingIntentWhatsappMessage({
      source: intent.source,
      customerName: intent.customer.fullName,
      productName: firstItem?.productName.ar || firstItem?.productName.en,
      reservationName: intent.reservationName,
    });
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
    );
  };

  const openOrderDetails = async (intent: BookingIntentRow) => {
    setOrderModalOpen(true);
    setSelectedOrder(null);
    setLoadingOrderDetails(true);
    try {
      const res = await fetch(`/api/orders/${intent.orderId}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setSelectedOrder(json.data);
      } else {
        toast.error(t('loadFailed'));
      }
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const runAction = async (
    intent: BookingIntentRow,
    path: 'claim' | 'release' | 'reopen',
    body?: Record<string, unknown>,
  ) => {
    setActionBusy(`${intent._id}:${path}`);
    try {
      const res = await fetch(`/api/booking-intents/${intent._id}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!json.success) {
        if (res.status === 409 && json.claimedBy?.name) {
          toast.error(t('claimedByOther', { name: json.claimedBy.name }));
        } else {
          toast.error(t('actionFailed'));
        }
        return;
      }
      toast.success(t('actionSuccess'));
      void fetchIntents(true);
      void fetchStats();
    } catch {
      toast.error(t('actionFailed'));
    } finally {
      setActionBusy(null);
    }
  };

  const submitResolve = async () => {
    if (!resolveTarget) return;
    setResolveBusy(true);
    try {
      const res = await fetch(
        `/api/booking-intents/${resolveTarget._id}/resolve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outcome: resolveOutcome,
            note: resolveNote.trim() || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!json.success) {
        toast.error(t('actionFailed'));
        return;
      }
      toast.success(t('resolveSuccess'));
      setResolveTarget(null);
      void fetchIntents(true);
      void fetchStats();
    } catch {
      toast.error(t('actionFailed'));
    } finally {
      setResolveBusy(false);
    }
  };

  // ── Filter option lists ────────────────────────────────────────────

  const tabOptions = useMemo(() => {
    const counts = data?.statusCounts;
    const label = (key: StatusTab) =>
      counts ? `${t(`status.${key}`)} (${counts[key] ?? 0})` : t(`status.${key}`);
    const base =
      'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground';
    const active = 'bg-foreground text-background shadow-sm';
    return [
      { value: 'all' as const, label: label('all'), className: base, activeClassName: active },
      { value: 'new' as const, label: label('new'), className: base, activeClassName: active },
      { value: 'contacted' as const, label: label('contacted'), className: base, activeClassName: active },
      { value: 'refused' as const, label: label('refused'), className: base, activeClassName: active },
      { value: 'converted' as const, label: label('converted'), className: base, activeClassName: active },
    ];
  }, [data?.statusCounts, t]);

  const assignedOptions = useMemo(() => {
    const options = [
      { label: t('filters.assignedAll'), value: 'all' },
      { label: t('filters.assignedMe'), value: 'me' },
      { label: t('filters.assignedNone'), value: 'none' },
    ];
    for (const admin of data?.assignedAdmins ?? []) {
      options.push({ label: admin.name || admin.adminId, value: admin.adminId });
    }
    return options;
  }, [data?.assignedAdmins, t]);

  const sourceOptions = useMemo(
    () => [
      { label: t('filters.sourceAll'), value: 'all' },
      { label: 'Manasik', value: 'manasik' },
      { label: 'Ghadaq', value: 'ghadaq' },
    ],
    [t],
  );

  const intentionOptions = useMemo(() => {
    const preset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'intention');
    return [
      { label: t('filters.allIntentions'), value: 'all' },
      ...(preset?.options?.map((option) => ({
        label: locale === 'ar' ? option.ar : option.en,
        value: locale === 'ar' ? option.ar : option.en,
      })) ?? []),
    ];
  }, [locale, t]);

  const categoryTabOptions = useMemo(() => {
    const base =
      'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground';
    const active = 'bg-foreground text-background shadow-sm';
    return [
      { label: t('filters.allCategories'), value: 'all', className: base, activeClassName: active },
      ...categories.map((cat) => ({
        label: cat.name,
        value: cat._id,
        className: base,
        activeClassName: active,
      })),
    ];
  }, [categories, t]);

  const datePresetOptions = useMemo(
    () =>
      (
        [
          'dateModeAll',
          'today',
          'yesterday',
          'last7Days',
        ] as const
      ).map((key) => ({
        label: t(`filters.${key}`),
        value: (key === 'dateModeAll' ? 'all' : key) as DateQuickPreset,
      })),
    [t],
  );

  // ── Table columns ──────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        header: t('colCustomer'),
        accessor: (row: BookingIntentRow) => (
          <div className="space-y-0.5">
            <p className="font-medium text-foreground">
              {row.customer.fullName || '—'}
            </p>
            <p className="text-xs text-secondary">
              <span dir="ltr">{row.customer.phone || '—'}</span>
            </p>
            <p className="text-xs text-secondary">
              {row.customer.email || '—'}
            </p>
            <p className="text-xs text-secondary">
              {row.customer.country || '—'}
            </p>
          </div>
        ),
      },
      {
        header: t('colOrder'),
        accessor: (row: BookingIntentRow) => (
          <div className="space-y-0.5">
            <p className="text-xs font-mono text-foreground">
              <span dir="ltr">{row.orderNumber}</span>
            </p>
            <p className="text-xs text-secondary">{row.itemsSummary}</p>
            <p className="text-xs text-secondary">
              {t('attempts', { count: row.paymentAttemptCount })}
            </p>
            {row.attemptCount > 1 && (
              <p className="text-xs font-medium text-info">
                {t('tries', { count: row.attemptCount })}
              </p>
            )}
          </div>
        ),
      },
      {
        header: t('colAmount'),
        accessor: (row: BookingIntentRow) => (
          <span className="text-sm font-medium text-foreground" dir="ltr">
            {row.amount.toLocaleString()} {row.currency}
          </span>
        ),
      },
      {
        header: t('colWhen'),
        accessor: (row: BookingIntentRow) => {
          const age = relativeAge(row.orderCreatedAt);
          return (
            <div className="space-y-0.5">
              <p className="text-xs text-foreground">
                {formatAttemptedAt(row.orderCreatedAt, locale)}
              </p>
              <p className="text-xs text-secondary">
                {t(`age.${age.unit}`, { count: age.count })}
              </p>
            </div>
          );
        },
      },
      {
        header: t('colStatus'),
        accessor: (row: BookingIntentRow) => (
          <div className="space-y-1">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[row.status]}`}
            >
              {row.status === 'closed'
                ? t('status.closed')
                : t(`status.${row.status}`)}
            </span>
            {row.autoReason && (
              <p className="text-xs text-secondary">
                {t(`auto.${row.autoReason}`)}
              </p>
            )}
          </div>
        ),
      },
      {
        header: t('colTalkingTo'),
        accessor: (row: BookingIntentRow) =>
          row.assignedTo ? (
            <span className="text-xs text-foreground">
              {row.assignedTo.name}
            </span>
          ) : (
            <span className="text-xs text-secondary">—</span>
          ),
      },
      {
        header: t('colActions'),
        accessor: (row: BookingIntentRow) => {
          const claimTip = t('actions.claim');
          const spinner = (
            <LuRefreshCw size={16} className="animate-spin" />
          );

          const canWhatsapp = isMine(row) || user?.role === 'super_admin';

          return (
            <div className="flex flex-row flex-wrap items-center gap-2">
              {canWhatsapp && (
                <Tooltip position={tooltipPos} content={t('actions.whatsapp')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openWhatsApp(row);
                    }}
                    aria-label={t('actions.whatsapp')}
                  >
                    <FaWhatsapp size={16} />
                  </Button>
                </Tooltip>
              )}

              {row.status === 'new' && (
                <Tooltip position={tooltipPos} content={claimTip}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    type="button"
                    disabled={Boolean(actionBusy)}
                    onClick={(e) => {
                      e.stopPropagation();
                      void runAction(row, 'claim');
                    }}
                    aria-label={claimTip}
                  >
                    {actionBusy === `${row._id}:claim`
                      ? spinner
                      : <LuPhoneOutgoing size={16} />}
                  </Button>
                </Tooltip>
              )}

              {row.status === 'contacted' && isMine(row) && (
                <>
                  <Tooltip position={tooltipPos} content={t('actions.resolve')}>
                    <Button
                      variant="icon-primary"
                      size="custom"
                      type="button"
                      disabled={Boolean(actionBusy)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setResolveTarget(row);
                        setResolveOutcome('refused');
                        setResolveNote('');
                      }}
                      aria-label={t('actions.resolve')}
                    >
                      <LuUserCheck size={16} />
                    </Button>
                  </Tooltip>
                  <Tooltip position={tooltipPos} content={t('actions.release')}>
                    <Button
                      variant="icon-danger"
                      size="custom"
                      type="button"
                      disabled={Boolean(actionBusy)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void runAction(row, 'release');
                      }}
                      aria-label={t('actions.release')}
                    >
                      {actionBusy === `${row._id}:release`
                        ? spinner
                        : <LuUserMinus size={16} />}
                    </Button>
                  </Tooltip>
                </>
              )}

              {row.status === 'contacted' &&
                !isMine(row) &&
                row.assignedTo && (
                  <span className="text-xs text-secondary">
                    {t('talkingWith', { name: row.assignedTo.name })}
                  </span>
                )}

              {row.status === 'refused' && (
                <Tooltip position={tooltipPos} content={t('actions.reopen')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    type="button"
                    disabled={Boolean(actionBusy)}
                    onClick={(e) => {
                      e.stopPropagation();
                      void runAction(row, 'reopen');
                    }}
                    aria-label={t('actions.reopen')}
                  >
                    {actionBusy === `${row._id}:reopen`
                      ? spinner
                      : <LuRotateCcw size={16} />}
                  </Button>
                </Tooltip>
              )}

              <Tooltip position={tooltipPos} content={t('actions.viewOrder')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void openOrderDetails(row);
                  }}
                  aria-label={t('actions.viewOrder')}
                >
                  <LuEye size={16} />
                </Button>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, tooltipPos, actionBusy, isMine, data, user?.role],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">
            {t('description', {
              minutes: data?.displayDelayMinutes ?? 60,
            })}
          </p>
        </div>
        <Button
          variant="icon-primary"
          size="custom"
          onClick={() => {
            void fetchIntents();
            void fetchStats();
          }}
        >
          <LuRefreshCw size={18} />
        </Button>
      </div>

      {/* Filters — same set as the execution page */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <LuSearch
              size={16}
              className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
            />
            <input
              type="text"
              placeholder={t('filters.search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
          </div>
          <Dropdown
            value={assignedFilter}
            options={assignedOptions}
            onChange={(v) => {
              setAssignedFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.assigned')}
            className="w-full sm:w-44"
          />
          <Dropdown
            value={sourceFilter}
            options={sourceOptions}
            onChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.source')}
            className="w-full sm:w-36"
          />
          <Dropdown
            value={intentionFilter}
            options={intentionOptions}
            onChange={(v) => {
              setIntentionFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.intention')}
            className="w-full sm:w-40"
          />
          <CountrySelector
            value={countryFilter}
            onChange={(v) => {
              setCountryFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.country')}
            allowClear
            clearLabel={t('filters.allCountries')}
            className="w-full sm:w-48"
          />
        </div>

        <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomDatePicker
              value={fromDate}
              onChange={(v) => {
                setFromDate(v);
                setActiveDatePreset('custom');
                setPage(1);
              }}
              locale={locale}
              label={t('filters.fromDate')}
              placeholder={t('filters.fromDate')}
            />
            <CustomDatePicker
              value={toDate}
              onChange={(v) => {
                setToDate(v);
                setActiveDatePreset('custom');
                setPage(1);
              }}
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
                onClick={() => applyDatePreset(preset.value)}
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

        <ReferralFilter
          value={referralFilter}
          onChange={(v) => {
            setReferralFilter(v);
            setPage(1);
          }}
          referrals={referrals}
          allLabel={t('filters.allReferrals')}
        />

        <div className="overflow-x-auto pb-1">
          <Tabs<string>
            value={categoryFilter}
            options={categoryTabOptions}
            onChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
            className="min-w-max"
          />
        </div>

        <div className="overflow-x-auto pb-1">
          <Tabs<StatusTab>
            value={statusTab}
            options={tabOptions}
            onChange={(v) => {
              setStatusTab(v);
              setPage(1);
            }}
            className="min-w-max"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-secondary">
          <span>
            {t('filters.total')}: {data?.pagination.totalIntents ?? 0}
          </span>
        </div>
      </div>

      {/* Table */}
      <Table<BookingIntentRow>
        columns={columns}
        data={data?.intents ?? []}
        loading={loading}
        emptyMessage={t('empty')}
      />

      <Pagination
        currentPage={data?.pagination.currentPage ?? page}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        hasNextPage={data?.pagination.hasNextPage}
        hasPrevPage={data?.pagination.hasPrevPage}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* Stats strip — customers permission only */}
      {canSeeStats && (
        <div className="bg-card-bg border border-stroke rounded-site p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LuTrophy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('stats.title')}</h2>
              <p className="text-sm text-secondary">{t('stats.hint')}</p>
            </div>
          </div>
          {statsLoading && !stats ? (
            <p className="text-sm text-secondary">{t('loading')}</p>
          ) : !stats || stats.length === 0 ? (
            <p className="text-sm text-secondary">{t('stats.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stroke">
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.admin')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.claimed')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.contacted')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.converted')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.refused')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.rate')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {stats.map((row) => (
                    <tr key={row.adminId}>
                      <td className="px-3 py-2 text-sm font-medium text-foreground">
                        {row.name || row.email}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.claimed}</td>
                      <td className="px-3 py-2 text-sm">
                        {row.contacted}
                      </td>
                      <td className="px-3 py-2 text-sm text-success">
                        {row.converted}
                      </td>
                      <td className="px-3 py-2 text-sm text-error">
                        {row.refused}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {row.conversionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order details — the order that put this customer on the page */}
      <OrderDetailModal
        isOpen={orderModalOpen}
        onClose={() => {
          setOrderModalOpen(false);
          setSelectedOrder(null);
        }}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
      />

      {/* Resolve modal */}
      <Modal
        isOpen={resolveTarget !== null}
        onClose={() => setResolveTarget(null)}
        title={t('resolveModal.title')}
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setResolveTarget(null)}
              disabled={resolveBusy}
            >
              {t('resolveModal.cancel')}
            </Button>
            <Button onClick={submitResolve} disabled={resolveBusy}>
              {resolveBusy ? t('saving') : t('resolveModal.submit')}
            </Button>
          </div>
        }
      >
        {resolveTarget && (
          <div className="space-y-4">
            <p className="text-sm text-secondary">
              {t('resolveModal.for', {
                name: resolveTarget.customer.fullName || '—',
                order: resolveTarget.orderNumber,
              })}
            </p>
            <div className="space-y-3">
              <RadioButton
                id="resolve-refused"
                name="resolve-outcome"
                value="refused"
                label={t('status.refused')}
                description={t('resolveModal.refusedHint')}
                checked={resolveOutcome === 'refused'}
                onChange={() => setResolveOutcome('refused')}
              />
              <RadioButton
                id="resolve-converted"
                name="resolve-outcome"
                value="converted"
                label={t('status.converted')}
                description={t('resolveModal.convertedHint')}
                checked={resolveOutcome === 'converted'}
                onChange={() => setResolveOutcome('converted')}
              />
            </div>
            <Textarea
              value={resolveNote}
              onChange={setResolveNote}
              label={t('resolveModal.note')}
              placeholder={t('resolveModal.notePlaceholder')}
              rows={3}
              maxLength={2000}
              showCount
            />
            {resolveTarget.openIntentCount > 1 && (
              <p className="text-xs text-secondary">
                {t('resolveModal.applyToAll', {
                  count: resolveTarget.openIntentCount,
                })}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
