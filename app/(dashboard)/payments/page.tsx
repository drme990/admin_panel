'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useRef,
  type ReactNode,
} from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import {
  LuCopyPlus,
  LuWallet,
  LuSearch,
  LuCopy,
  LuLink2,
  LuRefreshCcw,
  LuCalendar,
  LuCircleDollarSign,
  LuTrash2,
} from 'react-icons/lu';
import { Tooltip } from '@/components/ui/tooltip';

type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

interface PaymentOrderRow {
  _id: string;
  orderNumber: string;
  status: PaymentStatus;
  source?: 'manasik' | 'ghadaq';
  currency: string;
  totalAmount: number;
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  billingData: {
    fullName: string;
    email: string;
  };
  createdAt: string;
}

interface PaymentsResponse {
  month: string;
  analytics: {
    totalCollected: number;
    totalPaid: number;
    totalRemaining: number;
    totalDiscount: number;
    ordersCount: number;
    paidOrdersCount: number;
  };
  orders: PaymentOrderRow[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface PaymentLinkRow {
  _id: string;
  id: string;
  kind: 'order' | 'custom';
  source: 'manasik' | 'ghadaq';
  orderNumber: string | null;
  amountRequested: number;
  currency: string;
  isUsed: boolean;
  isExpired: boolean;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy?: {
    userName?: string;
    userEmail?: string;
  };
}

interface PaymentLinksResponse {
  links: PaymentLinkRow[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface CountryLite {
  _id: string;
  currencyCode: string;
  isActive: boolean;
}

type FiltersState = {
  month: string;
  statusFilter: string;
  sourceFilter: string;
  searchQuery: string;
  page: number;
  linksUsageFilter: '' | 'used' | 'unused';
  linksKindFilter: '' | 'order' | 'custom';
};

type FiltersAction =
  | { type: 'setMonth'; payload: string }
  | { type: 'setStatusFilter'; payload: string }
  | { type: 'setSourceFilter'; payload: string }
  | { type: 'setSearchQuery'; payload: string }
  | { type: 'setPage'; payload: number }
  | { type: 'setLinksUsageFilter'; payload: '' | 'used' | 'unused' }
  | { type: 'setLinksKindFilter'; payload: '' | 'order' | 'custom' };

type PayLinkFormState = {
  orderNumber: string;
  customAmount: string;
  payLinkSource: 'manasik' | 'ghadaq';
  payLinkCurrencyCode: string;
};

type PayLinkFormAction =
  | { type: 'setOrderNumber'; payload: string }
  | { type: 'setCustomAmount'; payload: string }
  | { type: 'setPayLinkSource'; payload: 'manasik' | 'ghadaq' }
  | { type: 'setPayLinkCurrencyCode'; payload: string }
  | { type: 'reset'; defaultCurrency: string };

function filtersReducer(
  state: FiltersState,
  action: FiltersAction,
): FiltersState {
  switch (action.type) {
    case 'setMonth':
      return { ...state, month: action.payload, page: 1 };
    case 'setStatusFilter':
      return { ...state, statusFilter: action.payload, page: 1 };
    case 'setSourceFilter':
      return { ...state, sourceFilter: action.payload, page: 1 };
    case 'setSearchQuery':
      return { ...state, searchQuery: action.payload, page: 1 };
    case 'setPage':
      return { ...state, page: action.payload };
    case 'setLinksUsageFilter':
      return { ...state, linksUsageFilter: action.payload };
    case 'setLinksKindFilter':
      return { ...state, linksKindFilter: action.payload };
    default:
      return state;
  }
}

function payLinkFormReducer(
  state: PayLinkFormState,
  action: PayLinkFormAction,
): PayLinkFormState {
  switch (action.type) {
    case 'setOrderNumber':
      return { ...state, orderNumber: action.payload };
    case 'setCustomAmount':
      return { ...state, customAmount: action.payload };
    case 'setPayLinkSource':
      return { ...state, payLinkSource: action.payload };
    case 'setPayLinkCurrencyCode':
      return { ...state, payLinkCurrencyCode: action.payload };
    case 'reset':
      return {
        orderNumber: '',
        customAmount: '',
        payLinkSource: 'manasik',
        payLinkCurrencyCode: action.defaultCurrency,
      };
    default:
      return state;
  }
}

const STATUS_COLORS: Record<PaymentStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function PaymentsPage() {
  const t = useTranslations('admin.payments');
  const locale = useLocale();
  const [filters, dispatchFilters] = useReducer(filtersReducer, {
    month: currentMonthKey(),
    statusFilter: '',
    sourceFilter: '',
    searchQuery: '',
    page: 1,
    linksUsageFilter: '',
    linksKindFilter: '',
  });
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(true);
  const [orders, setOrders] = useState<PaymentOrderRow[]>([]);
  const [analytics, setAnalytics] = useState<PaymentsResponse['analytics']>({
    totalCollected: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalDiscount: 0,
    ordersCount: 0,
    paidOrdersCount: 0,
  });
  const [pagination, setPagination] = useState<PaymentsResponse['pagination']>({
    currentPage: 1,
    totalPages: 1,
    totalOrders: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [linksPagination, setLinksPagination] = useState<
    PaymentLinksResponse['pagination']
  >({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [payLinkForm, dispatchPayLinkForm] = useReducer(payLinkFormReducer, {
    orderNumber: '',
    customAmount: '',
    payLinkSource: 'manasik',
    payLinkCurrencyCode: 'SAR',
  });
  const [creatingPayLink, setCreatingPayLink] = useState(false);
  const [payLinkCurrencies, setPayLinkCurrencies] = useState<string[]>([]);
  const [payLinkData, setPayLinkData] = useState<{
    payLinkUrl: string;
    expiresAt: string;
    orderNumber: string | null;
    source: string;
    amountRequested: number;
    currency: string;
    remainingAmount: number | null;
  } | null>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const { confirm: confirmDelete, modalProps: deleteConfirmModalProps } =
    useConfirmModal();

  const defaultPayLinkCurrency = useMemo(
    () => payLinkCurrencies[0] || 'EGP',
    [payLinkCurrencies],
  );

  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const res = await fetch('/api/countries?active=true');
        const data = await res.json();
        if (!data.success || !Array.isArray(data.data)) return;

        const uniqueCurrencies = Array.from(
          new Set(
            (data.data as CountryLite[])
              .map((country) => country.currencyCode?.trim().toUpperCase())
              .filter(
                (code): code is string => !!code && /^[A-Z]{3}$/.test(code),
              ),
          ),
        );

        if (!uniqueCurrencies.length) return;

        setPayLinkCurrencies(uniqueCurrencies);

        if (!uniqueCurrencies.includes(payLinkForm.payLinkCurrencyCode)) {
          dispatchPayLinkForm({
            type: 'setPayLinkCurrencyCode',
            payload: uniqueCurrencies[0],
          });
        }
      } catch (error) {
        console.error('Error loading pay link currencies:', error);
      }
    };

    void loadCurrencies();
  }, [payLinkForm.payLinkCurrencyCode]);

  const formatDate = useCallback(
    (value: string) =>
      new Date(value).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  );

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: '20',
        month: filters.month,
      });
      if (filters.statusFilter) params.set('status', filters.statusFilter);
      if (filters.sourceFilter) params.set('source', filters.sourceFilter);
      if (filters.searchQuery.trim())
        params.set('search', filters.searchQuery.trim());

      const res = await fetch(`/api/payments?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch payments');
      }

      const payload = data.data as PaymentsResponse;
      setOrders(payload.orders || []);
      setAnalytics(payload.analytics);
      setPagination(payload.pagination);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error(t('messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    filters.page,
    filters.month,
    filters.statusFilter,
    filters.sourceFilter,
    filters.searchQuery,
    t,
  ]);

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(linksPagination.currentPage),
        limit: '10',
      });
      if (filters.sourceFilter) params.set('source', filters.sourceFilter);
      if (filters.linksUsageFilter)
        params.set('usage', filters.linksUsageFilter);
      if (filters.linksKindFilter) params.set('kind', filters.linksKindFilter);

      const res = await fetch(`/api/payments/links?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch payment links');
      }

      const payload = data.data as PaymentLinksResponse;
      setLinks(payload.links || []);
      setLinksPagination(payload.pagination);
    } catch (error) {
      console.error('Error fetching payment links:', error);
      toast.error(t('messages.linksLoadFailed'));
    } finally {
      setLinksLoading(false);
    }
  }, [
    linksPagination.currentPage,
    filters.linksUsageFilter,
    filters.linksKindFilter,
    filters.sourceFilter,
    t,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createPayLink = async () => {
    const trimmedOrder = payLinkForm.orderNumber.trim();
    const trimmedCurrency = payLinkForm.payLinkCurrencyCode
      .trim()
      .toUpperCase();

    let parsedCustomAmount: number | undefined;
    if (payLinkForm.customAmount.trim()) {
      const parsed = Number(payLinkForm.customAmount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error(t('messages.customAmountInvalid'));
        return;
      }
      parsedCustomAmount = parsed;
    }

    const isStandaloneCustomLink = !trimmedOrder;
    if (isStandaloneCustomLink) {
      if (parsedCustomAmount === undefined) {
        toast.error(t('messages.customAmountRequired'));
        return;
      }

      if (!/^[A-Z]{3}$/.test(trimmedCurrency)) {
        toast.error(t('messages.currencyRequired'));
        return;
      }
    }

    try {
      setCreatingPayLink(true);
      const res = await fetch('/api/payments/pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: trimmedOrder || undefined,
          customAmount: parsedCustomAmount,
          currencyCode: trimmedCurrency,
          source: payLinkForm.payLinkSource,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || t('messages.createFailed'));
      }

      setPayLinkData(data.data);
      await navigator.clipboard.writeText(data.data.payLinkUrl);
      toast.success(t('messages.createSuccess'));
      setLinksPagination((prev) => ({ ...prev, currentPage: 1 }));
    } catch (error) {
      console.error('Error creating pay link:', error);
      toast.error(
        error instanceof Error ? error.message : t('messages.createFailed'),
      );
    } finally {
      setCreatingPayLink(false);
    }
  };

  const copyPayLink = async () => {
    if (!payLinkData?.payLinkUrl) return;
    try {
      await navigator.clipboard.writeText(payLinkData.payLinkUrl);
      toast.success(t('messages.copied'));
    } catch {
      toast.error(t('messages.copyFailed'));
    }
  };

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('filters.allStatuses') },
      { value: 'pending', label: t('status.pending') },
      { value: 'processing', label: t('status.processing') },
      { value: 'paid', label: t('status.paid') },
      { value: 'completed', label: t('status.completed') },
      { value: 'failed', label: t('status.failed') },
      { value: 'refunded', label: t('status.refunded') },
      { value: 'cancelled', label: t('status.cancelled') },
    ],
    [t],
  );

  const sourceOptions = useMemo(
    () => [
      { value: '', label: t('filters.allSources') },
      { value: 'manasik', label: t('filters.manasikSource') },
      { value: 'ghadaq', label: t('filters.ghadaqSource') },
    ],
    [t],
  );

  const payLinkSourceOptions = useMemo(
    () => [
      { value: 'manasik', label: t('filters.manasikSource') },
      { value: 'ghadaq', label: t('filters.ghadaqSource') },
    ],
    [t],
  );

  const payLinkCurrencyOptions = useMemo(
    () =>
      payLinkCurrencies.map((currencyCode) => ({
        value: currencyCode,
        label: currencyCode,
      })),
    [payLinkCurrencies],
  );

  const deletePayLink = async (linkId: string) => {
    const confirmed = await confirmDelete({
      title: t('links.actions.deleteTitle'),
      message: t('links.actions.deleteConfirm'),
      type: 'danger',
      confirmText: t('links.actions.delete'),
      cancelText: t('links.actions.cancel'),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/payments/links/${linkId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || t('messages.deleteLinkFailed'));
      }

      toast.success(t('messages.deleteLinkSuccess'));
      setLinks((prev) => prev.filter((item) => item._id !== linkId));
      void fetchLinks();
    } catch (error) {
      console.error('Error deleting payment link:', error);
      toast.error(
        error instanceof Error ? error.message : t('messages.deleteLinkFailed'),
      );
    }
  };

  const columns = [
    {
      header: t('table.orderNumber'),
      accessor: (row: PaymentOrderRow) => (
        <span className="font-mono text-sm">{row.orderNumber}</span>
      ),
    },
    {
      header: t('table.customer'),
      accessor: (row: PaymentOrderRow) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {row.billingData.fullName}
          </span>
          <span className="text-xs text-secondary">
            {row.billingData.email}
          </span>
        </div>
      ),
    },
    {
      header: t('table.source'),
      accessor: (row: PaymentOrderRow) => (
        <span className="text-sm">{row.source || 'manasik'}</span>
      ),
    },
    {
      header: t('table.paid'),
      accessor: (row: PaymentOrderRow) => (
        <span className="font-semibold text-success">
          {(row.paidAmount ?? row.totalAmount).toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('table.remaining'),
      accessor: (row: PaymentOrderRow) => (
        <span className="font-medium text-warning">
          {(row.remainingAmount ?? 0).toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('table.status'),
      accessor: (row: PaymentOrderRow) => (
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status]}`}
        >
          {t(`status.${row.status}`)}
        </span>
      ),
    },
    {
      header: t('table.date'),
      accessor: (row: PaymentOrderRow) => (
        <span className="text-sm text-secondary">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (row: PaymentOrderRow) => (
        <Tooltip content={t('table.useOrder')} position="left">
          <Button
            variant="icon-primary"
            size="custom"
            onClick={(e) => {
              e.stopPropagation();
              dispatchPayLinkForm({
                type: 'setOrderNumber',
                payload: row.orderNumber,
              });
              if (targetRef.current) {
                targetRef.current.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }
            }}
          >
            <LuCopyPlus size={14} />
          </Button>
        </Tooltip>
      ),
    },
  ];

  const linksUsageOptions = useMemo(
    () => [
      { value: '', label: t('links.filters.allUsage') },
      { value: 'used', label: t('links.filters.usedOnly') },
      { value: 'unused', label: t('links.filters.unusedOnly') },
    ],
    [t],
  );

  const linksKindOptions = useMemo(
    () => [
      { value: '', label: t('links.filters.allKinds') },
      { value: 'order', label: t('links.kind.order') },
      { value: 'custom', label: t('links.kind.custom') },
    ],
    [t],
  );

  const linkStatusBadge = (row: PaymentLinkRow) => {
    if (row.isUsed) {
      return (
        <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('links.status.used')}
        </span>
      );
    }

    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        {t('links.status.unused')}
      </span>
    );
  };

  const linksColumns = [
    {
      header: t('links.table.type'),
      accessor: (row: PaymentLinkRow) => t(`links.kind.${row.kind}`),
    },
    {
      header: t('links.table.source'),
      accessor: (row: PaymentLinkRow) => row.source,
    },
    {
      header: t('links.table.orderNumber'),
      accessor: (row: PaymentLinkRow) => (
        <span className="font-mono text-sm">{row.orderNumber || '-'}</span>
      ),
    },
    {
      header: t('links.table.amount'),
      accessor: (row: PaymentLinkRow) => (
        <span className="font-semibold">
          {row.amountRequested.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('links.table.status'),
      accessor: (row: PaymentLinkRow) => linkStatusBadge(row),
    },
    {
      header: t('links.table.usedAt'),
      accessor: (row: PaymentLinkRow) =>
        row.usedAt ? formatDate(row.usedAt) : '-',
    },
    {
      header: t('links.table.expiresAt'),
      accessor: (row: PaymentLinkRow) => formatDate(row.expiresAt),
    },
    {
      header: t('links.table.createdAt'),
      accessor: (row: PaymentLinkRow) => formatDate(row.createdAt),
    },
    {
      header: t('links.table.actions'),
      accessor: (row: PaymentLinkRow) => (
        <Tooltip content={t('links.actions.delete')} position="left">
          <Button
            variant="icon-danger"
            size="custom"
            onClick={(e) => {
              e.stopPropagation();
              void deletePayLink(row._id);
            }}
            aria-label={t('links.actions.delete')}
          >
            <LuTrash2 size={14} />
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <AnalyticsCard
          title={t('analytics.totalPaid')}
          value={analytics.totalPaid}
          icon={<LuCircleDollarSign size={18} />}
          suffix={t('analytics.currencyHint')}
        />
        <AnalyticsCard
          title={t('analytics.totalCollected')}
          value={analytics.totalCollected}
          icon={<LuWallet size={18} />}
          suffix={t('analytics.currencyHint')}
        />
        <AnalyticsCard
          title={t('analytics.totalRemaining')}
          value={analytics.totalRemaining}
          icon={<LuCircleDollarSign size={18} />}
          suffix={t('analytics.currencyHint')}
        />
        <AnalyticsCard
          title={t('analytics.paidOrdersCount')}
          value={analytics.paidOrdersCount}
          icon={<LuCalendar size={18} />}
        />
      </div>

      <div
        ref={targetRef}
        className="rounded-site border border-stroke bg-card-bg p-4 space-y-3"
      >
        <h2 className="text-lg font-semibold">{t('payLink.title')}</h2>
        <p className="text-sm text-secondary">{t('payLink.description')}</p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-secondary">
              {t('payLink.orderNumber')}
            </label>
            <input
              value={payLinkForm.orderNumber}
              onChange={(e) =>
                dispatchPayLinkForm({
                  type: 'setOrderNumber',
                  payload: e.target.value,
                })
              }
              placeholder={t('payLink.orderNumberPlaceholder')}
              className="mt-1 w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('payLink.customAmount')}
            </label>
            <input
              value={payLinkForm.customAmount}
              onChange={(e) =>
                dispatchPayLinkForm({
                  type: 'setCustomAmount',
                  payload: e.target.value,
                })
              }
              placeholder={t('payLink.customAmountPlaceholder')}
              className="mt-1 w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('payLink.currencyCode')}
            </label>
            <Dropdown
              value={payLinkForm.payLinkCurrencyCode}
              options={payLinkCurrencyOptions}
              onChange={(value) =>
                dispatchPayLinkForm({
                  type: 'setPayLinkCurrencyCode',
                  payload: value,
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('table.source')}
            </label>
            <Dropdown
              value={payLinkForm.payLinkSource}
              options={payLinkSourceOptions}
              onChange={(value) =>
                dispatchPayLinkForm({
                  type: 'setPayLinkSource',
                  payload: value as 'manasik' | 'ghadaq',
                })
              }
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={createPayLink} disabled={creatingPayLink}>
            <LuLink2 size={16} />
            {creatingPayLink
              ? t('payLink.creating')
              : t('payLink.createButton')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              dispatchPayLinkForm({
                type: 'reset',
                defaultCurrency: defaultPayLinkCurrency,
              });
              setPayLinkData(null);
            }}
          >
            {t('payLink.reset')}
          </Button>
        </div>

        {payLinkData && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={payLinkData.payLinkUrl}
                className="w-full rounded-md border border-stroke bg-background px-2 py-1 text-xs"
              />
              <Button variant="icon-primary" size="sm" onClick={copyPayLink}>
                <LuCopy size={14} />
              </Button>
            </div>
            <p className="text-xs text-secondary">
              {payLinkData.orderNumber
                ? t('payLink.meta', {
                    orderNumber: payLinkData.orderNumber,
                    amount: payLinkData.amountRequested.toFixed(2),
                    currency: payLinkData.currency,
                    expiresAt: formatDate(payLinkData.expiresAt),
                  })
                : t('payLink.customMeta', {
                    source: payLinkData.source,
                    amount: payLinkData.amountRequested.toFixed(2),
                    currency: payLinkData.currency,
                    expiresAt: formatDate(payLinkData.expiresAt),
                  })}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <LuSearch
            size={16}
            className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
          />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => {
              dispatchFilters({
                type: 'setSearchQuery',
                payload: e.target.value,
              });
            }}
            placeholder={t('filters.search')}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background text-sm"
          />
        </div>

        <input
          type="month"
          value={filters.month}
          onChange={(e) => {
            dispatchFilters({
              type: 'setMonth',
              payload: e.target.value || currentMonthKey(),
            });
          }}
          className="w-full lg:w-40 rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
        />

        <Dropdown
          value={filters.statusFilter}
          options={statusOptions}
          onChange={(value) =>
            dispatchFilters({ type: 'setStatusFilter', payload: value })
          }
          className="w-full lg:w-44"
        />

        <Dropdown
          value={filters.sourceFilter}
          options={sourceOptions}
          onChange={(value) =>
            dispatchFilters({ type: 'setSourceFilter', payload: value })
          }
          className="w-full lg:w-40"
        />

        <Tooltip content={t('links.filters.refresh')} position="left">
          <Button
            variant="icon-primary"
            size="custom"
            onClick={fetchPayments}
            aria-label={t('links.filters.refresh')}
          >
            <LuRefreshCcw size={18} />
          </Button>
        </Tooltip>
      </div>

      <Table
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={(value) =>
          dispatchFilters({ type: 'setPage', payload: value })
        }
        hasNextPage={pagination.hasNextPage}
        hasPrevPage={pagination.hasPrevPage}
      />

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('links.title')}</h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <Dropdown
            value={filters.linksUsageFilter}
            options={linksUsageOptions}
            onChange={(value) => {
              dispatchFilters({
                type: 'setLinksUsageFilter',
                payload: value as '' | 'used' | 'unused',
              });
              setLinksPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
            className="w-full lg:w-48"
          />

          <Dropdown
            value={filters.linksKindFilter}
            options={linksKindOptions}
            onChange={(value) => {
              dispatchFilters({
                type: 'setLinksKindFilter',
                payload: value as '' | 'order' | 'custom',
              });
              setLinksPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
            className="w-full lg:w-44"
          />

          <Tooltip content={t('links.filters.refresh')} position="left">
            <Button
              variant="icon-primary"
              size="custom"
              onClick={fetchLinks}
              aria-label={t('links.filters.refresh')}
            >
              <LuRefreshCcw size={18} />
            </Button>
          </Tooltip>
        </div>

        <Table
          columns={linksColumns}
          data={links}
          loading={linksLoading}
          emptyMessage={t('links.emptyMessage')}
        />

        <Pagination
          currentPage={linksPagination.currentPage}
          totalPages={linksPagination.totalPages}
          onPageChange={(value) =>
            setLinksPagination((prev) => ({ ...prev, currentPage: value }))
          }
          hasNextPage={linksPagination.hasNextPage}
          hasPrevPage={linksPagination.hasPrevPage}
        />
      </div>

      <ConfirmModal {...deleteConfirmModalProps} />
    </div>
  );
}

function AnalyticsCard({
  title,
  value,
  icon,
  suffix,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  suffix?: string;
}) {
  return (
    <div className="rounded-site border border-stroke bg-card-bg p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-secondary">{title}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">
        {value.toLocaleString()}{' '}
        {suffix ? (
          <span className="text-sm text-secondary">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}
