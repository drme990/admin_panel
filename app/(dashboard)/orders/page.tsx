'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import { Order, OrderStatus } from '@/types/Order';
import { Referral } from '@/types/Referral';
import {
  buildOrderWhatsappMessageFromOrder,
  buildProcessingOrderWhatsappFollowUpMessage,
} from '@/lib/order-whatsapp';

import OrderFilters from './components/order-filters';
import OrderDetailModal from './components/order-detail-modal';
import ChangeStatusModal from './components/change-status-modal';
import OrderStats from './components/order-stats';
import { useOrderColumns } from './components/order-table-columns';

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
type WhatsappFilterValue = 'all' | 'clicked' | 'not-clicked' | 'no-need-to-click';
type DateQuickPreset = 'today' | 'yesterday' | 'last7Days' | 'all';

const STATUS_TAB_VALUES: StatusTabValue[] = [
  'all', 'pending', 'processing', 'partial-paid',
  'paid', 'completed', 'failed', 'refunded', 'cancelled',
];

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
  if (fromDate && toDate && fromDate > toDate) return { fromDate: toDate, toDate: fromDate };
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
  const initialWhatsappState =
    (searchParams.get('whatsapp') as WhatsappFilterValue | null) || 'all';
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
  const [pageSize, setPageSize] = useState(20);
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
  const [whatsappFilter, setWhatsappFilter] =
    useState<WhatsappFilterValue>(initialWhatsappState);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [orderStats, setOrderStats] = useState<{ totalItems: number; byCategory: Array<{ categoryId: string; categoryName: string; color: string; totalItems: number; percentage: number }> } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [whatsappOrderId, setWhatsappOrderId] = useState<string | null>(null);
  const [blockingOrderId, setBlockingOrderId] = useState<string | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const { confirm, modalProps } = useConfirmModal();
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
          limit: String(pageSize),
          view: 'table',
          tzOffsetMinutes: String(new Date().getTimezoneOffset()),
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (whatsappFilter !== 'all') {
          params.set('whatsappState', whatsappFilter);
        }
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
      pageSize,
      statusFilter,
      referralFilter,
      sourceFilter,
      whatsappFilter,
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

  const fetchStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingStats(true);
      try {
        const params = new URLSearchParams({
          tzOffsetMinutes: String(new Date().getTimezoneOffset()),
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (sourceFilter) params.set('source', sourceFilter);
        if (whatsappFilter !== 'all') {
          params.set('whatsappState', whatsappFilter);
        }
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(
          fromDateFilter,
          toDateFilter,
        );
        if (normalizedRange.fromDate)
          params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate)
          params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/orders/stats?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const data = await res.json();

        if (data.success) {
          setOrderStats(data.data);
        }
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') {
          return;
        }
        console.error('Error fetching order stats:', error);
      } finally {
        if (!signal?.aborted) {
          setLoadingStats(false);
        }
      }
    },
    [
      statusFilter,
      referralFilter,
      sourceFilter,
      whatsappFilter,
      searchQuery,
      fromDateFilter,
      toDateFilter,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchStats(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchStats]);

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
    setIsModalOpen(true);

    setLoadingOrderDetails(true);
    const fullOrder = await fetchOrderDetails(order._id);
    if (fullOrder) {
      setSelectedOrder(fullOrder);
    }
    setLoadingOrderDetails(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
    setLoadingOrderDetails(false);
  };

  const handleChangeStatus = (order: Order) => {
    setSelectedOrder(order);
    setIsChangeStatusModalOpen(true);
  };

  const closeChangeStatusModal = () => {
    setIsChangeStatusModalOpen(false);
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

  const updateOrderStatus = async (status: OrderStatus, cancellationReason?: string) => {
    if (!selectedOrder || status === selectedOrder.status) {
      closeChangeStatusModal();
      return;
    }

    try {
      setUpdatingStatus(true);
      const payload: Record<string, unknown> = { status };
      if (status === 'cancelled' && cancellationReason) {
        payload.cancellationReason = cancellationReason;
      }
      const res = await fetch(`/api/orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update order status');
      }

      const updated = data.data as Order;
      setSelectedOrder(updated);
      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: updated.status, cancellationReason: updated.cancellationReason }
            : order,
        ),
      );
      toast.success(t('statusUpdateSuccess'));
      closeChangeStatusModal();
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error(t('statusUpdateFailed'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleBlockCustomer = async (order: Order) => {
    if (order.isGuest || !order.userId || !order.source) {
      toast.error(t('blockCustomerGuest'));
      return;
    }

    const isCurrentlyBanned = blockedUserIds.has(order.userId);

    const confirmed = await confirm({
      title: isCurrentlyBanned ? t('unblockCustomer') : t('blockCustomer'),
      message: isCurrentlyBanned ? t('unblockCustomerConfirm') : t('blockCustomerConfirm'),
      type: isCurrentlyBanned ? 'info' : 'danger',
      confirmText: isCurrentlyBanned ? t('unblockCustomer') : t('blockCustomer'),
      cancelText: t('changeStatusModal.cancel'),
    });

    if (!confirmed) return;

    setBlockingOrderId(order._id);
    try {
      const res = await fetch(
        `/api/customers/${order.source}/${order.userId}/ban`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isBanned: !isCurrentlyBanned }),
        },
      );

      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || (isCurrentlyBanned ? t('unblockCustomerFailed') : t('blockCustomerFailed')));
        return;
      }

      setBlockedUserIds((prev) => {
        const next = new Set(prev);
        if (order.userId) {
          if (isCurrentlyBanned) {
            next.delete(order.userId);
          } else {
            next.add(order.userId);
          }
        }
        return next;
      });
      toast.success(isCurrentlyBanned ? t('unblockCustomerSuccess') : t('blockCustomerSuccess'));
    } catch {
      toast.error(isCurrentlyBanned ? t('unblockCustomerFailed') : t('blockCustomerFailed'));
    } finally {
      setBlockingOrderId(null);
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


  const today = getRelativeIsoDate(0);
  const yesterday = getRelativeIsoDate(-1);
  const lastSevenDaysStart = getRelativeIsoDate(-6);
  const normalizedSelectedRange = normalizeDateRange(fromDateFilter, toDateFilter);

  const activeDatePreset: DateQuickPreset | 'custom' =
    !normalizedSelectedRange.fromDate && !normalizedSelectedRange.toDate
      ? 'all'
      : normalizedSelectedRange.fromDate === today && normalizedSelectedRange.toDate === today
        ? 'today'
        : normalizedSelectedRange.fromDate === yesterday && normalizedSelectedRange.toDate === yesterday
          ? 'yesterday'
          : normalizedSelectedRange.fromDate === lastSevenDaysStart && normalizedSelectedRange.toDate === today
            ? 'last7Days'
            : 'custom';

  const applyDatePreset = (preset: DateQuickPreset) => {
    if (preset === 'all') { setFromDateFilter(''); setToDateFilter(''); setPage(1); return; }
    if (preset === 'today') { setFromDateFilter(today); setToDateFilter(today); setPage(1); return; }
    if (preset === 'yesterday') { setFromDateFilter(yesterday); setToDateFilter(yesterday); setPage(1); return; }
    setFromDateFilter(lastSevenDaysStart);
    setToDateFilter(today);
    setPage(1);
  };

  const handleFromDateChange = (value: string) => {
    const r = normalizeDateRange(value, toDateFilter);
    setFromDateFilter(r.fromDate); setToDateFilter(r.toDate); setPage(1);
  };

  const handleToDateChange = (value: string) => {
    const r = normalizeDateRange(fromDateFilter, value);
    setFromDateFilter(r.fromDate); setToDateFilter(r.toDate); setPage(1);
  };

  const bulkStatusOptions = [
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.cancelled'), value: 'cancelled' },
    { label: t('status.refunded'), value: 'refunded' },
  ];

  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order._id));

  const columns = useOrderColumns({
    onView: viewOrder,
    onWhatsapp: startOrderWhatsappMessage,
    onCopyPhone: copyOrderWhatsappNumber,
    onCopyMessage: copyOrderWhatsappMessage,
    onChangeStatus: handleChangeStatus,
    onBlock: handleBlockCustomer,
    onToggleSelect: toggleOrderSelection,
    onToggleSelectAll: toggleSelectAllVisible,
    selectedOrderIds,
    allVisibleSelected,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    blockingOrderId,
    blockedUserIds,
    tooltipPos: ToolTipPositions as 'left' | 'right',
    formatDate,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      </div>

      <OrderFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sourceFilter={sourceFilter}
        onSourceChange={(val) => { setSourceFilter(val); setPage(1); }}
        whatsappFilter={whatsappFilter}
        onWhatsappChange={(val) => { setWhatsappFilter(val); setPage(1); }}
        onRefresh={() => void fetchOrders()}
        fromDateFilter={fromDateFilter}
        toDateFilter={toDateFilter}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        activeDatePreset={activeDatePreset}
        onDatePreset={applyDatePreset}
        locale={locale}
        referralFilter={referralFilter}
        onReferralChange={(val) => { setReferralFilter(val); setPage(1); }}
        referrals={referrals}
        statusFilter={statusFilter}
        onStatusChange={(val) => { setStatusFilter(val); setPage(1); }}
        totalOrders={totalOrders}
      />

      <BulkAction
        selectedCount={selectedOrderIds.length}
        value={bulkStatus}
        options={bulkStatusOptions}
        onValueChange={setBulkStatus}
        onApply={applyBulkStatus}
        onClear={() => { setSelectedOrderIds([]); setBulkStatus(''); }}
        applyLabel={t('bulkAction.apply')}
        applyingLabel={t('bulkAction.applying')}
        clearLabel={t('bulkAction.clear')}
        selectionLabel={t('bulkAction.selectedCount', { count: selectedOrderIds.length })}
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
        pageSize={pageSize}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      <OrderStats stats={orderStats} loading={loadingStats} />

      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
        formatDate={formatDate}
        locale={locale}
      />

      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={closeChangeStatusModal}
        currentStatus={selectedOrder?.status ?? 'pending'}
        onUpdateStatus={updateOrderStatus}
        updating={updatingStatus}
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}