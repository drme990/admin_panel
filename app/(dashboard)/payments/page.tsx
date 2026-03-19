'use client';

import {
  useCallback,
  useEffect,
  useMemo,
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
  const [month, setMonth] = useState(currentMonthKey());
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
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
  const [linksUsageFilter, setLinksUsageFilter] = useState<
    '' | 'used' | 'unused'
  >('');
  const [linksKindFilter, setLinksKindFilter] = useState<
    '' | 'order' | 'custom'
  >('');
  const [linksPagination, setLinksPagination] = useState<
    PaymentLinksResponse['pagination']
  >({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [orderNumber, setOrderNumber] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [payLinkSource, setPayLinkSource] = useState<'manasik' | 'ghadaq'>(
    'manasik',
  );
  const [payLinkCurrencyCode, setPayLinkCurrencyCode] = useState('SAR');
  const [creatingPayLink, setCreatingPayLink] = useState(false);
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
        page: String(page),
        limit: '20',
        month,
      });
      if (statusFilter) params.set('status', statusFilter);
      if (sourceFilter) params.set('source', sourceFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

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
  }, [page, month, statusFilter, sourceFilter, searchQuery, t]);

  const fetchLinks = useCallback(async () => {
    setLinksLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(linksPagination.currentPage),
        limit: '10',
      });
      if (sourceFilter) params.set('source', sourceFilter);
      if (linksUsageFilter) params.set('usage', linksUsageFilter);
      if (linksKindFilter) params.set('kind', linksKindFilter);

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
    linksUsageFilter,
    linksKindFilter,
    sourceFilter,
    t,
  ]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const createPayLink = async () => {
    const trimmedOrder = orderNumber.trim();
    const trimmedCurrency = payLinkCurrencyCode.trim().toUpperCase();

    let parsedCustomAmount: number | undefined;
    if (customAmount.trim()) {
      const parsed = Number(customAmount);
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
          source: payLinkSource,
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
    () => [
      { value: 'EGP', label: 'EGP' },
      { value: 'SAR', label: 'SAR' },
      { value: 'USD', label: 'USD' },
      { value: 'EUR', label: 'EUR' },
    ],
    [],
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
            variant="icon"
            size="custom"
            onClick={(e) => {
              e.stopPropagation();
              setOrderNumber(row.orderNumber);
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
        <Button
          variant="icon"
          size="custom"
          className="text-error"
          onClick={(e) => {
            e.stopPropagation();
            void deletePayLink(row._id);
          }}
          title={t('links.actions.delete')}
          aria-label={t('links.actions.delete')}
        >
          <LuTrash2 size={14} />
        </Button>
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
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder={t('payLink.orderNumberPlaceholder')}
              className="mt-1 w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('payLink.customAmount')}
            </label>
            <input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={t('payLink.customAmountPlaceholder')}
              className="mt-1 w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('payLink.currencyCode')}
            </label>
            <Dropdown
              value={payLinkCurrencyCode}
              options={payLinkCurrencyOptions}
              onChange={setPayLinkCurrencyCode}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-secondary">
              {t('table.source')}
            </label>
            <Dropdown
              value={payLinkSource}
              options={payLinkSourceOptions}
              onChange={(value) =>
                setPayLinkSource(value as 'manasik' | 'ghadaq')
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
              setOrderNumber('');
              setCustomAmount('');
              setPayLinkCurrencyCode('SAR');
              setPayLinkSource('manasik');
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
              <Button variant="icon" size="sm" onClick={copyPayLink}>
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
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t('filters.search')}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background text-sm"
          />
        </div>

        <input
          type="month"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value || currentMonthKey());
            setPage(1);
          }}
          className="w-full lg:w-40 rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
        />

        <Dropdown
          value={statusFilter}
          options={statusOptions}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          className="w-full lg:w-44"
        />

        <Dropdown
          value={sourceFilter}
          options={sourceOptions}
          onChange={(value) => {
            setSourceFilter(value);
            setPage(1);
          }}
          className="w-full lg:w-40"
        />

        <Button variant="icon" size="custom" onClick={fetchPayments}>
          <LuRefreshCcw size={18} />
        </Button>
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
        onPageChange={setPage}
        hasNextPage={pagination.hasNextPage}
        hasPrevPage={pagination.hasPrevPage}
      />

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('links.title')}</h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <Dropdown
            value={linksUsageFilter}
            options={linksUsageOptions}
            onChange={(value) => {
              setLinksUsageFilter(value as '' | 'used' | 'unused');
              setLinksPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
            className="w-full lg:w-48"
          />

          <Dropdown
            value={linksKindFilter}
            options={linksKindOptions}
            onChange={(value) => {
              setLinksKindFilter(value as '' | 'order' | 'custom');
              setLinksPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
            className="w-full lg:w-44"
          />

          <Button variant="icon" size="custom" onClick={fetchLinks}>
            <LuRefreshCcw size={18} />
          </Button>
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
