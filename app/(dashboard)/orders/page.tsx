'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Button from '@/components/ui/button';
import BulkAction from '@/components/ui/bulk-action';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { toast } from 'react-toastify';
import { useTranslations, useLocale } from 'next-intl';
import { Order, OrderPayment, OrderStatus } from '@/types/Order';
import {
  LuSearch as Search,
  LuCopy as Copy,
  LuEye as Eye,
  LuRefreshCw as RefreshCw,
  LuPackage as Package,
  LuMail as Mail,
  LuPhone as Phone,
  LuGlobe as Globe,
  LuCalendar as Calendar,
  LuHash as Hash,
  LuCreditCard as CreditCard,
  LuUserRoundPlus as UserRoundPlus,
  LuTag as Tag,
} from 'react-icons/lu';
import { FaWhatsapp as WhatsappIcon } from 'react-icons/fa6';
import { Referral } from '@/types/Referral';
import Checkbox from '@/components/ui/checkbox';
import { Tooltip } from '@/components/ui/tooltip';
import {
  buildOrderWhatsappMessageFromOrder,
  buildProcessingOrderWhatsappFollowUpMessage,
} from '@/lib/order-whatsapp';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'partial-paid':
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const PAYMENT_STATUS_COLORS: Record<OrderPayment['status'], string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

interface OrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

type StatusTabValue = 'all' | OrderStatus;
type DateQuickPreset = 'today' | 'yesterday' | 'last7Days' | 'all';

const STATUS_TAB_VALUES: StatusTabValue[] = [
  'all',
  'pending',
  'processing',
  'partial-paid',
  'paid',
  'completed',
  'failed',
  'refunded',
  'cancelled',
];

function isOrderGuest(order: Pick<Order, 'userId' | 'isGuest'>): boolean {
  if (typeof order.isGuest === 'boolean') {
    return order.isGuest;
  }

  const hasUserId =
    typeof order.userId === 'string' && order.userId.trim().length > 0;
  return !hasUserId;
}

function toIsoDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRelativeIsoDate(daysOffset: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  return toIsoDateInput(date);
}

function normalizeDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate > toDate) {
    return {
      fromDate: toDate,
      toDate: fromDate,
    };
  }

  return { fromDate, toDate };
}

export default function OrderHistoryPage() {
  const t = useTranslations('orders');
  const locale = useLocale();
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialStatusParam = searchParams.get('s');
  const initialStatus: StatusTabValue = STATUS_TAB_VALUES.includes(
    initialStatusParam as StatusTabValue,
  )
    ? (initialStatusParam as StatusTabValue)
    : 'all';
  const initialReferral = searchParams.get('r') || '';
  const initialSource = searchParams.get('source') || '';
  const initialSpecificDate = searchParams.get('date') || '';
  const initialFromDate =
    searchParams.get('fromDate') || initialSpecificDate || '';
  const initialToDate = searchParams.get('toDate') || initialSpecificDate || '';
  const normalizedInitialRange = normalizeDateRange(
    initialFromDate,
    initialToDate,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] =
    useState<StatusTabValue>(initialStatus);
  const [fromDateFilter, setFromDateFilter] = useState(
    normalizedInitialRange.fromDate,
  );
  const [toDateFilter, setToDateFilter] = useState(
    normalizedInitialRange.toDate,
  );
  const [referralFilter, setReferralFilter] = useState<string>(initialReferral);
  const [sourceFilter, setSourceFilter] = useState<string>(initialSource);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [modalStatus, setModalStatus] = useState<OrderStatus>('pending');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [whatsappOrderId, setWhatsappOrderId] = useState<string | null>(null);
  const [copyingPhoneOrderId, setCopyingPhoneOrderId] = useState<string | null>(
    null,
  );
  const [copyingMessageOrderId, setCopyingMessageOrderId] = useState<
    string | null
  >(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setPage(1);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res = await fetch('/api/referrals?limit=100', {
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.success) {
          setReferrals(data.data.referrals);
        }
      } catch (error) {
        console.error('Error fetching referrals:', error);
      }
    };
    fetchReferrals();
  }, []);

  const fetchOrders = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '20',
          view: 'table',
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(
          fromDateFilter,
          toDateFilter,
        );
        if (normalizedRange.fromDate)
          params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate)
          params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/orders?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();

        if (data.success) {
          const result: OrdersResponse = data.data;
          setOrders(result.orders);
          setTotalPages(result.pagination.totalPages);
          setTotalOrders(result.pagination.totalOrders);
          setSelectedOrderIds([]);
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return;
        }
        console.error('Error fetching orders:', error);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      page,
      statusFilter,
      referralFilter,
      sourceFilter,
      searchQuery,
      fromDateFilter,
      toDateFilter,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchOrders(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchOrders]);

  const fetchOrderDetails = useCallback(
    async (orderId: string, showError = true): Promise<Order | null> => {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch order details');
        }

        return data.data as Order;
      } catch (error) {
        console.error('Error fetching order details:', error);
        if (showError) {
          toast.error(t('detailsLoadFailed'));
        }
        return null;
      }
    },
    [t],
  );

  const normalizeWhatsappPhone = (rawPhone?: string, withPlus = false) => {
    if (!rawPhone) return null;

    let normalized = rawPhone.trim();
    if (!normalized) return null;

    normalized = normalized.replace(/[\s().-]/g, '');
    if (normalized.startsWith('00')) {
      normalized = `+${normalized.slice(2)}`;
    }

    if (normalized.startsWith('+')) {
      const digits = normalized.slice(1).replace(/\D/g, '');
      if (!digits) return null;
      return withPlus ? `+${digits}` : digits;
    }

    const digitsOnly = normalized.replace(/\D/g, '');
    if (!digitsOnly) return null;
    return withPlus ? `+${digitsOnly}` : digitsOnly;
  };

  const copyToClipboard = async (value: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    if (typeof document === 'undefined') {
      throw new Error('Clipboard is not available');
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!copied) {
      throw new Error('Copy command failed');
    }
  };

  const resolveOrderWhatsappPayload = async (order: Order) => {
    const fullOrder = await fetchOrderDetails(order._id, false);
    const resolvedOrder = fullOrder || order;
    const message =
      resolvedOrder.status === 'processing'
        ? buildProcessingOrderWhatsappFollowUpMessage(resolvedOrder)
        : buildOrderWhatsappMessageFromOrder(resolvedOrder);

    return {
      message,
      whatsappPhone: normalizeWhatsappPhone(resolvedOrder.billingData?.phone),
    };
  };

  const viewOrder = async (order: Order) => {
    setSelectedOrder(order);
    setModalStatus(order.status);
    setIsModalOpen(true);

    setLoadingOrderDetails(true);
    const fullOrder = await fetchOrderDetails(order._id);
    if (fullOrder) {
      setSelectedOrder(fullOrder);
      setModalStatus(fullOrder.status);
    }
    setLoadingOrderDetails(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
    setLoadingOrderDetails(false);
  };

  const startOrderWhatsappMessage = async (order: Order) => {
    try {
      setWhatsappOrderId(order._id);
      const { message, whatsappPhone } =
        await resolveOrderWhatsappPayload(order);

      if (!whatsappPhone) {
        toast.error(t('copyWhatsapp.invalidPhone'));
        return;
      }

      const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
      const popup = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        toast.error(t('copyWhatsapp.failed'));
        return;
      }

      toast.success(t('copyWhatsapp.success'));
    } catch (error) {
      console.error('Error starting WhatsApp order message:', error);
      toast.error(t('copyWhatsapp.failed'));
    } finally {
      setWhatsappOrderId(null);
    }
  };

  const copyOrderWhatsappNumber = async (order: Order) => {
    try {
      setCopyingPhoneOrderId(order._id);
      const whatsappPhone = normalizeWhatsappPhone(
        order.billingData?.phone,
        true,
      );

      if (!whatsappPhone) {
        toast.error(t('copyWhatsapp.invalidPhone'));
        return;
      }

      await copyToClipboard(whatsappPhone);
      toast.success(t('copyWhatsapp.copyNumberSuccess'));
    } catch (error) {
      console.error('Error copying WhatsApp number:', error);
      toast.error(t('copyWhatsapp.copyNumberFailed'));
    } finally {
      setCopyingPhoneOrderId(null);
    }
  };

  const copyOrderWhatsappMessage = async (order: Order) => {
    try {
      setCopyingMessageOrderId(order._id);
      const { message } = await resolveOrderWhatsappPayload(order);
      await copyToClipboard(message);
      toast.success(t('copyWhatsapp.copyMessageSuccess'));
    } catch (error) {
      console.error('Error copying WhatsApp message:', error);
      toast.error(t('copyWhatsapp.copyMessageFailed'));
    } finally {
      setCopyingMessageOrderId(null);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleOrderIds = orders.map((order) => order._id);
    const allSelected =
      visibleOrderIds.length > 0 &&
      visibleOrderIds.every((id) => selectedOrderIds.includes(id));

    setSelectedOrderIds(allSelected ? [] : visibleOrderIds);
  };

  const applyBulkStatus = async () => {
    if (selectedOrderIds.length === 0 || !bulkStatus) return;

    try {
      setBulkUpdating(true);
      const res = await fetch('/api/orders/bulk-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: bulkStatus,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to bulk update orders');
      }

      const nextStatus = bulkStatus as OrderStatus;

      setOrders((prev) =>
        prev.map((order) =>
          selectedOrderIds.includes(order._id)
            ? { ...order, status: nextStatus }
            : order,
        ),
      );

      setSelectedOrder((prev) =>
        prev && selectedOrderIds.includes(prev._id)
          ? { ...prev, status: nextStatus }
          : prev,
      );

      toast.success(`Updated ${data.data.updatedCount} orders`);
      setSelectedOrderIds([]);
      setBulkStatus('');
    } catch (error) {
      console.error('Error bulk updating order statuses:', error);
      toast.error('Failed to bulk update orders');
    } finally {
      setBulkUpdating(false);
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrder || modalStatus === selectedOrder.status) return;

    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: modalStatus }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update order status');
      }

      setSelectedOrder(data.data as Order);
      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: modalStatus }
            : order,
        ),
      );
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === 'ar' ? 'ar-SA' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  };

  const getReservationLabel = (label: { ar: string; en: string }) =>
    locale === 'ar' ? label.ar : label.en;

  const getReservationValues = (value: string) =>
    value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const formatMoney = (amount: number | undefined, currency: string) =>
    `${Number(amount ?? 0).toFixed(2)} ${currency}`;

  const getPaymentTimeline = (order: Order): OrderPayment[] => {
    const payments = Array.isArray(order.payments)
      ? [...order.payments]
      : ([] as OrderPayment[]);

    return payments.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  };

  const statusTabOptions = [
    {
      label: t('filters.all'),
      value: 'all' as const,
      className:
        'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: t('status.paid'),
      value: 'paid' as const,
      className:
        'border border-green-200 bg-green-50 text-green-800 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-300',
      activeClassName: STATUS_COLORS.paid,
    },
    {
      label: t('status.partial-paid'),
      value: 'partial-paid' as const,
      className:
        'border border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800/60 dark:bg-orange-900/20 dark:text-orange-300',
      activeClassName: STATUS_COLORS['partial-paid'],
    },
    {
      label: t('status.completed'),
      value: 'completed' as const,
      className:
        'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-300',
      activeClassName: STATUS_COLORS.completed,
    },
    {
      label: t('status.failed'),
      value: 'failed' as const,
      className:
        'border border-red-200 bg-red-50 text-red-800 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300',
      activeClassName: STATUS_COLORS.failed,
    },
    {
      label: t('status.processing'),
      value: 'processing' as const,
      className:
        'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/60 dark:bg-blue-900/20 dark:text-blue-300',
      activeClassName: STATUS_COLORS.processing,
    },
    {
      label: t('status.pending'),
      value: 'pending' as const,
      className:
        'border border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/60 dark:bg-yellow-900/20 dark:text-yellow-300',
      activeClassName: STATUS_COLORS.pending,
    },
    {
      label: t('status.refunded'),
      value: 'refunded' as const,
      className:
        'border border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800/60 dark:bg-purple-900/20 dark:text-purple-300',
      activeClassName: STATUS_COLORS.refunded,
    },
    {
      label: t('status.cancelled'),
      value: 'cancelled' as const,
      className:
        'border border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800/60 dark:bg-gray-900/20 dark:text-gray-300',
      activeClassName: STATUS_COLORS.cancelled,
    },
  ];

  const today = getRelativeIsoDate(0);
  const yesterday = getRelativeIsoDate(-1);
  const lastSevenDaysStart = getRelativeIsoDate(-6);
  const normalizedSelectedRange = normalizeDateRange(
    fromDateFilter,
    toDateFilter,
  );

  const activeDatePreset: DateQuickPreset | 'custom' =
    !normalizedSelectedRange.fromDate && !normalizedSelectedRange.toDate
      ? 'all'
      : normalizedSelectedRange.fromDate === today &&
          normalizedSelectedRange.toDate === today
        ? 'today'
        : normalizedSelectedRange.fromDate === yesterday &&
            normalizedSelectedRange.toDate === yesterday
          ? 'yesterday'
          : normalizedSelectedRange.fromDate === lastSevenDaysStart &&
              normalizedSelectedRange.toDate === today
            ? 'last7Days'
            : 'custom';

  const datePresetOptions: Array<{ label: string; value: DateQuickPreset }> = [
    { label: t('filters.dateModeAll'), value: 'all' },
    { label: t('filters.today'), value: 'today' },
    { label: t('filters.yesterday'), value: 'yesterday' },
    { label: t('filters.last7Days'), value: 'last7Days' },
  ];

  const applyDatePreset = (preset: DateQuickPreset) => {
    if (preset === 'all') {
      setFromDateFilter('');
      setToDateFilter('');
      setPage(1);
      return;
    }

    if (preset === 'today') {
      setFromDateFilter(today);
      setToDateFilter(today);
      setPage(1);
      return;
    }

    if (preset === 'yesterday') {
      setFromDateFilter(yesterday);
      setToDateFilter(yesterday);
      setPage(1);
      return;
    }

    setFromDateFilter(lastSevenDaysStart);
    setToDateFilter(today);
    setPage(1);
  };

  const handleFromDateChange = (value: string) => {
    const normalizedRange = normalizeDateRange(value, toDateFilter);
    setFromDateFilter(normalizedRange.fromDate);
    setToDateFilter(normalizedRange.toDate);
    setPage(1);
  };

  const handleToDateChange = (value: string) => {
    const normalizedRange = normalizeDateRange(fromDateFilter, value);
    setFromDateFilter(normalizedRange.fromDate);
    setToDateFilter(normalizedRange.toDate);
    setPage(1);
  };

  const modalStatusOptions = [
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.refunded'), value: 'refunded' },
    { label: t('status.cancelled'), value: 'cancelled' },
  ];

  const bulkStatusOptions = [
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.cancelled'), value: 'cancelled' },
    { label: t('status.refunded'), value: 'refunded' },
  ];

  const sourceOptions = [
    { label: t('filters.allSources'), value: '' },
    { label: t('filters.manasikSource'), value: 'manasik' },
    { label: t('filters.ghadaqSource'), value: 'ghadaq' },
  ];

  const referralTabOptions = [
    {
      label: t('filters.allReferrals'),
      value: '',
      className:
        'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    {
      label: 'default',
      value: 'default',
      className:
        'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    },
    ...referrals.map((referral) => ({
      label: `${referral.name} (${referral.referralId})`,
      value: referral.referralId,
      className:
        'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground',
      activeClassName: 'bg-foreground text-background shadow-sm',
    })),
  ];

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order._id));

  const columns = [
    {
      header: (
        <Checkbox
          checked={allVisibleSelected}
          onChange={toggleSelectAllVisible}
          aria-label="Select all visible orders"
        />
      ),
      accessor: (row: Order) => (
        <Checkbox
          checked={selectedOrderIds.includes(row._id)}
          onChange={() => {
            toggleOrderSelection(row._id);
          }}
          onClick={(e) => e?.stopPropagation()}
          aria-label={`Select ${row.orderNumber}`}
        />
      ),
      className: 'w-12',
    },
    {
      header: t('table.orderNumber'),
      accessor: (row: Order) => (
        <span className="font-mono text-sm">{row.orderNumber}</span>
      ),
    },
    {
      header: t('table.customer'),
      accessor: (row: Order) => (
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
      header: t('table.customerType'),
      accessor: (row: Order) => (
        <span className="text-sm font-medium">
          {isOrderGuest(row)
            ? t('customerType.guest')
            : t('customerType.registered')}
        </span>
      ),
    },
    {
      header: t('table.amount'),
      accessor: (row: Order) => (
        <span className="font-bold text-success">
          {row.totalAmount.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('table.status'),
      accessor: (row: Order) => (
        <span
          className={`inline-block w-fit px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status] || ''}`}
        >
          {t(`status.${row.status}`)}
        </span>
      ),
    },
    {
      header: t('table.referral'),
      accessor: (row: Order) => (
        <span className="text-[11px] text-primary font-mono rounded-full px-2 py-1 bg-muted/60 border border-stroke w-fit">
          {row.referralId || 'Default'}
        </span>
      ),
    },
    {
      header: t('table.date'),
      accessor: (row: Order) => (
        <span className="text-sm text-secondary">
          {formatDate(row.updatedAt)}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (row: Order) => (
        <div className="flex items-center gap-2">
          <Tooltip position={ToolTipPositions} content={t('viewDetails')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                viewOrder(row);
              }}
              aria-label={t('viewDetails')}
            >
              <Eye size={16} />
            </Button>
          </Tooltip>

          <Tooltip
            position={ToolTipPositions}
            content={t('copyWhatsapp.button')}
          >
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                startOrderWhatsappMessage(row);
              }}
              disabled={whatsappOrderId === row._id}
              aria-label={t('copyWhatsapp.button')}
            >
              {whatsappOrderId === row._id ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <WhatsappIcon size={16} />
              )}
            </Button>
          </Tooltip>

          <Tooltip
            position={ToolTipPositions}
            content={t('copyWhatsapp.copyNumber')}
          >
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                void copyOrderWhatsappNumber(row);
              }}
              disabled={copyingPhoneOrderId === row._id}
              aria-label={t('copyWhatsapp.copyNumber')}
            >
              {copyingPhoneOrderId === row._id ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Phone size={16} />
              )}
            </Button>
          </Tooltip>

          <Tooltip
            position={ToolTipPositions}
            content={t('copyWhatsapp.copyMessage')}
          >
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                void copyOrderWhatsappMessage(row);
              }}
              disabled={copyingMessageOrderId === row._id}
              aria-label={t('copyWhatsapp.copyMessage')}
            >
              {copyingMessageOrderId === row._id ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </Tooltip>
        </div>
      ),
      className: 'w-44',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
          />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
            }}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
          />
        </div>

        <Dropdown
          value={sourceFilter}
          options={sourceOptions}
          onChange={(val) => {
            setSourceFilter(val);
            setPage(1);
          }}
          placeholder={t('filters.source')}
          className="w-full sm:w-40"
        />

        <Button
          variant="icon-primary"
          size="custom"
          onClick={() => {
            void fetchOrders();
          }}
          className="shrink-0"
        >
          <RefreshCw size={18} />
        </Button>
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {datePresetOptions.map((preset) => {
            const isActive = activeDatePreset === preset.value;

            return (
              <Button
                key={preset.value}
                variant="custom"
                type="button"
                size="custom"
                onClick={() => applyDatePreset(preset.value)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-foreground border-foreground text-background shadow-sm'
                    : 'bg-background border-stroke text-foreground hover:bg-foreground/5'
                }`}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CustomDatePicker
            value={fromDateFilter}
            onChange={handleFromDateChange}
            locale={locale}
            label={t('filters.fromDate')}
            placeholder={t('filters.fromDate')}
          />

          <CustomDatePicker
            value={toDateFilter}
            onChange={handleToDateChange}
            locale={locale}
            label={t('filters.toDate')}
            placeholder={t('filters.toDate')}
          />
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <Tabs<string>
          value={referralFilter}
          options={referralTabOptions}
          onChange={(value) => {
            setReferralFilter(value);
            setPage(1);
          }}
          className="min-w-max"
        />
      </div>

      <div className="overflow-x-auto pb-1">
        <Tabs<StatusTabValue>
          value={statusFilter}
          options={statusTabOptions}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          className="min-w-max"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>
          {t('total')}: {totalOrders}
        </span>
      </div>

      <BulkAction
        selectedCount={selectedOrderIds.length}
        value={bulkStatus}
        options={bulkStatusOptions}
        onValueChange={setBulkStatus}
        onApply={applyBulkStatus}
        onClear={() => {
          setSelectedOrderIds([]);
          setBulkStatus('');
        }}
        applyLabel={t('bulkAction.apply')}
        applyingLabel={t('bulkAction.applying')}
        clearLabel={t('bulkAction.clear')}
        selectionLabel={t('bulkAction.selectedCount', {
          count: selectedOrderIds.length,
        })}
        dropdownLabel={t('bulkAction.statusLabel')}
        disabled={!bulkStatus}
        loading={bulkUpdating}
      />

      <Table
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage={t('noOrders')}
        onRowClick={viewOrder}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selectedOrder
            ? `${t('orderDetails')} - ${selectedOrder.orderNumber}`
            : t('orderDetails')
        }
        size="lg"
      >
        {selectedOrder && loadingOrderDetails ? (
          <div className="py-8 text-center text-sm text-secondary">
            {t('loadingOrderDetails')}
          </div>
        ) : selectedOrder ? (
          <div className="flex flex-col gap-6">
            {(() => {
              const paymentTimeline = getPaymentTimeline(selectedOrder);
              const latestPaidPayment = [...paymentTimeline]
                .reverse()
                .find((payment) => payment.status === 'paid');
              const currentTransactionAmount =
                latestPaidPayment?.orderAmount ??
                latestPaidPayment?.amount ??
                selectedOrder.totalAmount;

              return (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[selectedOrder.status] || ''}`}
                    >
                      {t(`status.${selectedOrder.status}`)}
                    </span>
                    <span className="text-sm text-secondary">
                      {formatDate(selectedOrder.createdAt)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                    <Dropdown
                      label={t('statusEditor.label')}
                      value={modalStatus}
                      options={modalStatusOptions}
                      onChange={(value) => setModalStatus(value as OrderStatus)}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      onClick={updateOrderStatus}
                      disabled={
                        updatingStatus ||
                        !selectedOrder ||
                        modalStatus === selectedOrder.status
                      }
                    >
                      {updatingStatus
                        ? t('statusEditor.saving')
                        : t('statusEditor.save')}
                    </Button>
                  </div>

                  <div className="bg-background rounded-site p-4 border border-stroke text-center">
                    <p className="text-3xl font-bold text-success">
                      {selectedOrder.totalAmount.toFixed(2)}{' '}
                      {selectedOrder.currency}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">{t('amountDetails')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow
                        icon={<CreditCard size={14} />}
                        label={t('totals.totalPaidNow')}
                        value={formatMoney(
                          currentTransactionAmount,
                          selectedOrder.currency,
                        )}
                      />
                      <InfoRow
                        icon={<CreditCard size={14} />}
                        label={t('totals.fullAmount')}
                        value={formatMoney(
                          selectedOrder.fullAmount ?? selectedOrder.totalAmount,
                          selectedOrder.currency,
                        )}
                      />
                      <InfoRow
                        icon={<CreditCard size={14} />}
                        label={t('totals.paidAmount')}
                        value={formatMoney(
                          selectedOrder.paidAmount ?? selectedOrder.totalAmount,
                          selectedOrder.currency,
                        )}
                      />
                      <InfoRow
                        icon={<CreditCard size={14} />}
                        label={t('totals.remainingAmount')}
                        value={formatMoney(
                          selectedOrder.remainingAmount ?? 0,
                          selectedOrder.currency,
                        )}
                      />
                      <InfoRow
                        icon={<Tag size={14} />}
                        label={t('totals.couponCode')}
                        value={selectedOrder.couponCode || 'N/A'}
                      />
                      <InfoRow
                        icon={<Tag size={14} />}
                        label={t('totals.couponDiscount')}
                        value={`${(selectedOrder.couponDiscount ?? 0).toFixed(2)} ${selectedOrder.currency}`}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">
                      {t('paymentTimeline.title')}
                    </h3>
                    {paymentTimeline.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {paymentTimeline.map((payment, index) => {
                          const paymentStatus = payment.status || 'pending';
                          const customerReference =
                            typeof payment.easykashResponse
                              ?.customerReference === 'string'
                              ? payment.easykashResponse.customerReference
                              : undefined;

                          return (
                            <div
                              key={`${payment.paymentId || 'payment'}-${index}`}
                              className="rounded-lg bg-background border border-stroke p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {t('paymentTimeline.paymentLabel', {
                                    index: index + 1,
                                  })}
                                </span>
                                <span
                                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${PAYMENT_STATUS_COLORS[paymentStatus] || ''}`}
                                >
                                  {t(
                                    `paymentTimeline.statuses.${paymentStatus}`,
                                  )}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <InfoRow
                                  icon={<CreditCard size={14} />}
                                  label={t('paymentTimeline.orderAmount')}
                                  value={formatMoney(
                                    payment.orderAmount ?? payment.amount,
                                    payment.currency || selectedOrder.currency,
                                  )}
                                />
                                {typeof payment.gatewayAmount === 'number' ? (
                                  <InfoRow
                                    icon={<CreditCard size={14} />}
                                    label={t('paymentTimeline.gatewayAmount')}
                                    value={formatMoney(
                                      payment.gatewayAmount,
                                      payment.gatewayCurrency ||
                                        payment.currency,
                                    )}
                                  />
                                ) : null}
                                <InfoRow
                                  icon={<CreditCard size={14} />}
                                  label={t('paymentTimeline.method')}
                                  value={payment.paymentMethod || 'N/A'}
                                />
                                <InfoRow
                                  icon={<Calendar size={14} />}
                                  label={t('paymentTimeline.createdAt')}
                                  value={formatDate(payment.createdAt)}
                                />
                                {payment.paidAt ? (
                                  <InfoRow
                                    icon={<Calendar size={14} />}
                                    label={t('paymentTimeline.paidAt')}
                                    value={formatDate(payment.paidAt)}
                                  />
                                ) : null}
                                {payment.easykashRef ? (
                                  <InfoRow
                                    icon={<Hash size={14} />}
                                    label={t('paymentTimeline.reference')}
                                    value={payment.easykashRef}
                                  />
                                ) : null}
                                {payment.easykashProductCode ? (
                                  <InfoRow
                                    icon={<Hash size={14} />}
                                    label={t('paymentTimeline.productCode')}
                                    value={payment.easykashProductCode}
                                  />
                                ) : null}
                                {customerReference ? (
                                  <InfoRow
                                    icon={<Hash size={14} />}
                                    label={t(
                                      'paymentTimeline.customerReference',
                                    )}
                                    value={customerReference}
                                  />
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-background border border-stroke p-3 text-sm text-secondary">
                        {t('paymentTimeline.empty')}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Package size={16} /> {t('items')}
                    </h3>
                    <div className="mb-3 text-xs text-secondary">
                      {t('table.itemCount', {
                        count: selectedOrder.items.length,
                      })}{' '}
                      •{' '}
                      {t('table.quantityTotal', {
                        count: selectedOrder.items.reduce(
                          (sum, item) => sum + Number(item.quantity || 0),
                          0,
                        ),
                      })}
                    </div>
                    <div className="flex flex-col gap-2">
                      {selectedOrder.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-start justify-between gap-3 py-3 px-3 rounded-lg bg-background border border-stroke"
                        >
                          <div className="space-y-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {locale === 'ar'
                                ? item.productName.ar
                                : item.productName.en}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-secondary">
                              <span>
                                {t('table.quantityTotal', {
                                  count: item.quantity,
                                })}
                              </span>
                              <span>
                                {item.price.toFixed(2)} {item.currency}
                              </span>
                            </div>
                            <div className="text-[11px] text-secondary font-mono">
                              <span>
                                {t('productId')}: {item.productId}
                              </span>
                              {item.productSlug ? (
                                <span className="ms-2">
                                  {t('productSlug')}: {item.productSlug}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="text-end shrink-0">
                            <p className="font-bold text-sm text-success">
                              {(item.price * item.quantity).toFixed(2)}{' '}
                              {item.currency}
                            </p>
                            <p className="text-[11px] text-secondary">
                              {item.quantity} x {item.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">{t('customerInfo')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow
                        icon={<Hash size={14} />}
                        label={t('table.orderNumber')}
                        value={selectedOrder.orderNumber}
                      />
                      <InfoRow
                        icon={<Package size={14} />}
                        label={t('source')}
                        value={selectedOrder.source || 'manasik'}
                      />
                      <InfoRow
                        icon={<Hash size={14} />}
                        label={t('customerType.label')}
                        value={
                          isOrderGuest(selectedOrder)
                            ? t('customerType.guest')
                            : t('customerType.registered')
                        }
                      />
                      <InfoRow
                        icon={<Mail size={14} />}
                        label={t('email')}
                        value={selectedOrder.billingData.email}
                      />
                      <InfoRow
                        icon={<Phone size={14} />}
                        label={t('phone')}
                        value={selectedOrder.billingData.phone}
                      />
                      <InfoRow
                        icon={<Globe size={14} />}
                        label={t('country')}
                        value={selectedOrder.billingData.country}
                      />
                      <InfoRow
                        icon={<Calendar size={14} />}
                        label={t('table.date')}
                        value={formatDate(selectedOrder.createdAt)}
                      />
                      <InfoRow
                        icon={<CreditCard size={14} />}
                        label={t('paymentMethod')}
                        value={selectedOrder.paymentMethod || 'N/A'}
                      />
                      <InfoRow
                        icon={<Hash size={14} />}
                        label={t('locale')}
                        value={selectedOrder.locale || 'N/A'}
                      />
                      <InfoRow
                        icon={<Hash size={14} />}
                        label={t('termsAgreedAt')}
                        value={
                          selectedOrder.termsAgreedAt
                            ? formatDate(selectedOrder.termsAgreedAt)
                            : 'N/A'
                        }
                      />
                      <InfoRow
                        icon={<Hash size={14} />}
                        label={t('updatedAt')}
                        value={formatDate(selectedOrder.updatedAt)}
                      />
                      {selectedOrder.referralId && (
                        <InfoRow
                          icon={<UserRoundPlus size={14} />}
                          label={t('referral')}
                          value={selectedOrder.referralId}
                        />
                      )}
                    </div>
                  </div>

                  {selectedOrder.reservationData?.length ? (
                    <div>
                      <h3 className="font-semibold mb-3">
                        {t('reservationData.title')}
                      </h3>
                      <div className="flex flex-col gap-2">
                        {selectedOrder.reservationData.map((field, index) => {
                          const values = getReservationValues(field.value);

                          return (
                            <div
                              key={`${field.key}-${index}`}
                              className="py-2 px-3 rounded-lg bg-background border border-stroke"
                            >
                              <p className="text-xs text-secondary mb-1">
                                {getReservationLabel(field.label)}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {values.length > 0 ? (
                                  values.map((entry, valueIndex) => (
                                    <span
                                      key={`${field.key}-${index}-${valueIndex}`}
                                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary"
                                    >
                                      {entry}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-sm text-secondary">
                                    -
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background border border-stroke">
      <span className="text-secondary">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-secondary">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}
