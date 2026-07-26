'use client';

import { useEffect, useCallback, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import Button from '@/components/ui/button';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import { Order, OrderStatus } from '@/types/Order';
import { Referral } from '@/types/Referral';

import OrderFilters from '../components/order-filters';
import { useOrderColumns } from '../components/order-table-columns';
import OrderDetailModal from '../components/order-detail-modal';
import ChangeStatusModal from '../components/change-status-modal';
import CreateManualOrderModal from '../components/create-manual-order-modal';
import OrderHistoryModal, { OrderHistoryEntry } from '../components/order-history-modal';
import OrderStats from '../components/order-stats';
import useOrderPage from '../lib/use-order-page';
import { LuPlus } from 'react-icons/lu';
import {
  getRelativeIsoDate,
  normalizeDateRange,
} from '../lib/order-utils';

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
type DateQuickPreset = 'today' | 'tomorrow' | 'yesterday' | 'last7Days' | 'all';

const STATUS_TAB_VALUES: StatusTabValue[] = [
  'all', 'pending', 'processing', 'partial-paid',
  'paid', 'completed', 'failed', 'refunded', 'cancelled',
];

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

  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [creatingPaymentLinkOrderId, setCreatingPaymentLinkOrderId] = useState<string | null>(null);
  const { confirm, modalProps } = useConfirmModal();

  const {
    state,
    dispatch,
    setPage,
    setPageSize,
    setFilter,
    setDateRange,
    setLoading,
    setLoadingStats,
    setStats,
    toggleOrderSelection,
    toggleSelectAll,
    clearSelection,
    setBulkValue,
    setBulkUpdating,
    viewOrder,
    closeModal,
    handleChangeStatus,
    closeChangeStatusModal,
    startOrderWhatsappMessage,
    copyOrderWhatsappNumber,
    copyOrderWhatsappMessage,
    updateOrderStatus,
    updateOrder,
    setBlockingOrderId,
    setBlockedUserIds,
    setPendingBanOrder,
    fetchOrderDetails,
    setSelectedOrder,
    setOrderHistoryModalOpen,
    setOrderHistory,
    setLoadingOrderHistory,
    setSavingOrderId,
  } = useOrderPage({
    namespace: 'orders',
    initialState: {
      statusFilter: initialStatus,
      fromDateFilter: normalizedInitialRange.fromDate,
      toDateFilter: normalizedInitialRange.toDate,
      referralFilter: initialReferral,
      sourceFilter: initialSource,
      whatsappFilter: initialWhatsappState,
      searchInput: initialQuery,
      searchQuery: initialQuery,
      pageSize: 25,
    },
  });

  const [isCreateManualOrderModalOpen, setIsCreateManualOrderModalOpen] = useState(false);

  const {
    orders,
    loading,
    page,
    pageSize,
    totalPages,
    totalOrders,
    statusFilter,
    fromDateFilter,
    toDateFilter,
    referralFilter,
    sourceFilter,
    whatsappFilter,
    searchInput,
    searchQuery,
    selectedOrder,
    isModalOpen,
    loadingOrderDetails,
    isChangeStatusModalOpen,
    updatingStatus,
    selectedOrderIds,
    bulkValue,
    bulkUpdating,
    stats,
    loadingStats,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    blockingOrderId,
    blockedUserIds,
    pendingBanOrder,
    isOrderHistoryModalOpen,
    orderHistory,
    loadingOrderHistory,
    savingOrderId,
  } = state;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter({ searchQuery: searchInput.trim() });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, setFilter]);

  // When an order is cancelled with "Scammer" reason, prompt admin to ban the user
  useEffect(() => {
    if (!pendingBanOrder) return;
    const order = pendingBanOrder;
    setPendingBanOrder(null);

    const isCurrentlyBanned = blockedUserIds.has(order.userId || '');
    if (isCurrentlyBanned) return;

    (async () => {
      const confirmed = await confirm({
        title: t('banScammerTitle'),
        message: t('banScammerMessage'),
        type: 'danger',
        confirmText: t('blockCustomer'),
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
            body: JSON.stringify({ isBanned: true }),
          },
        );
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || t('blockCustomerFailed'));
          return;
        }
        setBlockedUserIds(new Set([...Array.from(blockedUserIds), order.userId!]));
        toast.success(t('blockCustomerSuccess'));
      } catch {
        toast.error(t('blockCustomerFailed'));
      } finally {
        setBlockingOrderId(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBanOrder]);

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
        if (whatsappFilter && whatsappFilter !== 'all') {
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
          dispatch({
            type: 'SET_ORDERS',
            payload: {
              orders: result.orders,
              totalOrders: result.pagination.totalOrders,
              totalPages: result.pagination.totalPages,
            },
          });
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
      setLoading,
      dispatch,
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
        if (whatsappFilter && whatsappFilter !== 'all') {
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
          setStats(data.data);
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
      setStats,
      setLoadingStats,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchStats(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchStats]);

  const applyBulkStatus = async () => {
    if (selectedOrderIds.length === 0 || !bulkValue) return;

    try {
      setBulkUpdating(true);
      const res = await fetch('/api/orders/bulk-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: bulkValue,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to bulk update orders');
      }

      const nextStatus = bulkValue as OrderStatus;
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: {
          orderId: '',
          updates: {},
        },
      });
      dispatch({
        type: 'SET_ORDERS',
        payload: {
          orders: orders.map((order) =>
            selectedOrderIds.includes(order._id)
              ? { ...order, status: nextStatus }
              : order,
          ),
          totalOrders,
          totalPages,
        },
      });

      toast.success(`Updated ${data.data.updatedCount} orders`);
      clearSelection();
    } catch (error) {
      console.error('Error bulk updating order statuses:', error);
      toast.error('Failed to bulk update orders');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleCreatePaymentLink = async (order: Order) => {
    try {
      setCreatingPaymentLinkOrderId(order._id);
      const res = await fetch(`/api/orders/${order._id}/regenerate-payment-link`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment link');
      }
      toast.success(t('paymentLinkRegenerated') || 'Payment link created');
      // Reload the order details so the new link appears in the modal
      const updatedOrder = await fetchOrderDetails(order._id, false);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      }
      void fetchOrders();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('regenerateFailed') || 'Failed to create payment link';
      toast.error(message);
    } finally {
      setCreatingPaymentLinkOrderId(null);
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

      setBlockedUserIds(
        new Set(
          isCurrentlyBanned
            ? Array.from(blockedUserIds).filter((id) => id !== order.userId)
            : [...Array.from(blockedUserIds), order.userId],
        ),
      );
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
  const tomorrow = getRelativeIsoDate(1);
  const yesterday = getRelativeIsoDate(-1);
  const lastSevenDaysStart = getRelativeIsoDate(-6);
  const normalizedSelectedRange = normalizeDateRange(fromDateFilter, toDateFilter);

  const activeDatePreset: DateQuickPreset | 'custom' =
    !normalizedSelectedRange.fromDate && !normalizedSelectedRange.toDate
      ? 'all'
      : normalizedSelectedRange.fromDate === today && normalizedSelectedRange.toDate === today
        ? 'today'
        : normalizedSelectedRange.fromDate === tomorrow && normalizedSelectedRange.toDate === tomorrow
          ? 'tomorrow'
          : normalizedSelectedRange.fromDate === yesterday && normalizedSelectedRange.toDate === yesterday
            ? 'yesterday'
            : normalizedSelectedRange.fromDate === lastSevenDaysStart && normalizedSelectedRange.toDate === today
              ? 'last7Days'
              : 'custom';

  const applyDatePreset = (preset: DateQuickPreset) => {
    if (preset === 'all') {
      setDateRange({ fromDateFilter: '', toDateFilter: '' });
      return;
    }
    if (preset === 'today') {
      setDateRange({ fromDateFilter: today, toDateFilter: today });
      return;
    }
    if (preset === 'tomorrow') {
      setDateRange({ fromDateFilter: tomorrow, toDateFilter: tomorrow });
      return;
    }
    if (preset === 'yesterday') {
      setDateRange({ fromDateFilter: yesterday, toDateFilter: yesterday });
      return;
    }
    setDateRange({ fromDateFilter: lastSevenDaysStart, toDateFilter: today });
  };

  const handleFromDateChange = (value: string) => {
    const r = normalizeDateRange(value, toDateFilter);
    setDateRange({ fromDateFilter: r.fromDate, toDateFilter: r.toDate });
  };

  const handleToDateChange = (value: string) => {
    const r = normalizeDateRange(fromDateFilter, value);
    setDateRange({ fromDateFilter: r.fromDate, toDateFilter: r.toDate });
  };

  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order._id));

  const bulkStatusOptions = [
    { label: t('status.pending'), value: 'pending' },
    { label: t('status.processing'), value: 'processing' },
    { label: t('status.partial-paid'), value: 'partial-paid' },
    { label: t('status.paid'), value: 'paid' },
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.failed'), value: 'failed' },
    { label: t('status.refunded'), value: 'refunded' },
    { label: t('status.cancelled'), value: 'cancelled' },
  ];

  const handleViewHistory = async (order: Order) => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    setOrderHistoryModalOpen(true);
    setLoadingOrderHistory(true);
    setOrderHistory([], false);
    try {
      const res = await fetch(`/api/orders/${order._id}/history`);
      const data = await res.json();
      if (data.success) {
        setOrderHistory(data.data || [], false);
      } else {
        toast.error(data.error || t('orderHistory.loadFailed'));
      }
    } catch (error) {
      console.error('Error fetching order history:', error);
      toast.error(t('orderHistory.loadFailed'));
    } finally {
      setLoadingOrderHistory(false);
    }
  };

  const closeOrderHistoryModal = () => {
    setOrderHistoryModalOpen(false);
    setOrderHistory([], false);
  };

  const handleRollback = async (entry: OrderHistoryEntry) => {
    if (!selectedOrder || !entry.previousValue) return;

    // Status rollback: call PUT /api/orders/:id with the previous status
    if (entry.changeType === 'status') {
      const previousStatus = entry.previousValue as OrderStatus;
      setSavingOrderId(selectedOrder._id);
      try {
        const res = await fetch(`/api/orders/${selectedOrder._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: previousStatus }),
        });
        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || t('statusUpdateFailed'));
          return;
        }
        const updated = data.data as Order;
        dispatch({
          type: 'UPDATE_ORDER_IN_LIST',
          payload: {
            orderId: selectedOrder._id,
            updates: {
              status: updated.status,
              cancellationReason: updated.cancellationReason,
            },
          },
        });
        toast.success(t('statusUpdateSuccess'));
      } catch (error) {
        console.error('Error rolling back status:', error);
        toast.error(t('statusUpdateFailed'));
      } finally {
        setSavingOrderId(null);
      }
      // Refresh history
      setLoadingOrderHistory(true);
      try {
        const res = await fetch(`/api/orders/${selectedOrder._id}/history`);
        const data = await res.json();
        if (data.success) {
          setOrderHistory(data.data || [], false);
        }
      } catch (error) {
        console.error('Error refreshing order history:', error);
      } finally {
        setLoadingOrderHistory(false);
      }
      return;
    }

    const currentInvoices = selectedOrder?.invoiceUrls || [];
    type InvoiceEntry = NonNullable<typeof currentInvoices>[number];

    const fields: Parameters<typeof updateOrder>[1] | null = (() => {
      if (entry.changeType === 'photo') {
        return { photo: entry.previousValue || '' };
      }

      if (entry.changeType === 'invoiceImage') {
        try {
          const previous = JSON.parse(entry.previousValue || '') as { url?: string };
          const current = JSON.parse(entry.newValue || '') as { url?: string };
          const previousUrl = previous.url;
          const currentUrl = current.url;
          if (previousUrl && currentUrl) {
            const invoiceUrls: InvoiceEntry[] = currentInvoices.map((inv) =>
              inv.url === currentUrl ? { ...inv, url: previousUrl } : inv
            );
            return { invoiceUrls };
          }
        } catch {
          // ignore
        }
      }

      if (entry.changeType === 'invoiceStatus') {
        try {
          const parsed = JSON.parse(entry.previousValue || '') as { url?: string; invoiceStatus?: string; rejectionReason?: string };
          const parsedUrl = parsed.url;
          const parsedStatus = parsed.invoiceStatus as InvoiceEntry['invoiceStatus'] | undefined;
          if (parsedUrl && parsedStatus) {
            const invoiceUrls: InvoiceEntry[] = currentInvoices.map((inv) =>
              inv.url === parsedUrl
                ? { ...inv, invoiceStatus: parsedStatus, rejectionReason: parsed.rejectionReason || '' }
                : inv
            );
            return { invoiceUrls };
          }
        } catch {
          // ignore
        }
      }

      if (entry.changeType === 'invoiceValue') {
        try {
          const parsed = JSON.parse(entry.previousValue || '') as { url?: string; value?: number; currency?: string };
          const parsedUrl = parsed.url;
          const parsedValue = parsed.value;
          if (parsedUrl && typeof parsedValue === 'number') {
            const invoiceUrls: InvoiceEntry[] = currentInvoices.map((inv) =>
              inv.url === parsedUrl
                ? { ...inv, value: parsedValue, currency: parsed.currency || 'EGP' }
                : inv
            );
            return { invoiceUrls };
          }
        } catch {
          // ignore
        }
      }

      if (entry.changeType === 'invoice') {
        try {
          const parsedRaw = JSON.parse(entry.previousValue || '') as unknown;
          if (Array.isArray(parsedRaw)) {
            const invoiceUrls: InvoiceEntry[] = parsedRaw as InvoiceEntry[];
            return { invoiceUrls };
          }
          const parsed = parsedRaw as {
            url?: string;
            invoiceStatus?: string;
            rejectionReason?: string;
            value?: number;
            currency?: string;
          };
          const parsedUrl = parsed.url;
          if (parsed && typeof parsed === 'object' && parsedUrl && !currentInvoices.some((inv) => inv.url === parsedUrl)) {
            const newInvoice: InvoiceEntry = {
              url: parsedUrl,
              invoiceStatus: (parsed.invoiceStatus as InvoiceEntry['invoiceStatus']) || 'waiting',
              rejectionReason: typeof parsed.rejectionReason === 'string' ? parsed.rejectionReason : '',
              value: typeof parsed.value === 'number' ? parsed.value : 0,
              currency: typeof parsed.currency === 'string' ? parsed.currency : 'EGP',
            };
            return { invoiceUrls: [...currentInvoices, newInvoice] };
          }
        } catch {
          // fallback: treat as legacy single URL
          const previousUrl = entry.previousValue;
          const invoiceUrls: InvoiceEntry[] = previousUrl ? [{ url: previousUrl, invoiceStatus: 'waiting', value: 0 }] : [];
          return { invoiceUrls };
        }
      }

      return null;
    })();

    if (!fields) {
      toast.error('Rollback not supported for this change type');
      return;
    }

    const success = await updateOrder(selectedOrder._id, fields);
    if (success) {
      setLoadingOrderHistory(true);
      try {
        const res = await fetch(`/api/orders/${selectedOrder._id}/history`);
        const data = await res.json();
        if (data.success) {
          setOrderHistory(data.data || [], false);
        }
      } catch (error) {
        console.error('Error refreshing order history:', error);
      } finally {
        setLoadingOrderHistory(false);
      }
    }
  };

  const columns = useOrderColumns({
    onView: viewOrder,
    onWhatsapp: startOrderWhatsappMessage,
    onCopyPhone: copyOrderWhatsappNumber,
    onCopyMessage: copyOrderWhatsappMessage,
    onChangeStatus: handleChangeStatus,
    onViewHistory: handleViewHistory,
    onBlock: handleBlockCustomer,
    onToggleSelect: toggleOrderSelection,
    onToggleSelectAll: toggleSelectAll,
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
        <Button
          variant="primary"
          size="custom"
          className="px-4 py-2"
          onClick={() => setIsCreateManualOrderModalOpen(true)}
        >
          <LuPlus size={18} className="me-2" />
          {t('createManualOrder.title')}
        </Button>
      </div>

      <OrderFilters
        searchInput={searchInput}
        onSearchChange={(value) => setFilter({ searchInput: value })}
        sourceFilter={sourceFilter}
        onSourceChange={(val) => setFilter({ sourceFilter: val })}
        whatsappFilter={whatsappFilter as WhatsappFilterValue}
        onWhatsappChange={(val) => setFilter({ whatsappFilter: val as WhatsappFilterValue })}
        onRefresh={() => void fetchOrders()}
        fromDateFilter={fromDateFilter}
        toDateFilter={toDateFilter}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        activeDatePreset={activeDatePreset}
        onDatePreset={applyDatePreset}
        locale={locale}
        referralFilter={referralFilter}
        onReferralChange={(val) => setFilter({ referralFilter: val })}
        referrals={referrals}
        statusFilter={statusFilter as StatusTabValue}
        onStatusChange={(val) => setFilter({ statusFilter: val as StatusTabValue })}
        totalOrders={totalOrders}
      />

      <BulkAction
        selectedCount={selectedOrderIds.length}
        value={bulkValue}
        options={bulkStatusOptions}
        onValueChange={setBulkValue}
        onApply={applyBulkStatus}
        onClear={clearSelection}
        applyLabel={t('bulkAction.apply')}
        applyingLabel={t('bulkAction.applying')}
        clearLabel={t('bulkAction.clear')}
        selectionLabel={t('bulkAction.selectedCount', { count: selectedOrderIds.length })}
        dropdownLabel={t('bulkAction.statusLabel')}
        disabled={!bulkValue}
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
        onPageSizeChange={setPageSize}
      />

      <OrderStats stats={stats} loading={loadingStats} locale={locale} namespace="orders" />

      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
        formatDate={formatDate}
        locale={locale}
        namespace="orders"
        onCreatePaymentLink={selectedOrder ? handleCreatePaymentLink : undefined}
        isCreatingPaymentLink={selectedOrder ? creatingPaymentLinkOrderId === selectedOrder._id : false}
      />

      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={closeChangeStatusModal}
        currentStatus={selectedOrder?.status ?? 'pending'}
        onUpdateStatus={updateOrderStatus}
        updating={updatingStatus}
        namespace="orders"
      />

      <CreateManualOrderModal
        isOpen={isCreateManualOrderModalOpen}
        onClose={() => setIsCreateManualOrderModalOpen(false)}
        onSuccess={() => {
          void fetchOrders();
          void fetchStats();
        }}
        namespace="orders"
      />

      <OrderHistoryModal
        isOpen={isOrderHistoryModalOpen}
        onClose={closeOrderHistoryModal}
        orderNumber={selectedOrder?.orderNumber || ''}
        history={orderHistory as OrderHistoryEntry[]}
        loading={loadingOrderHistory}
        onRollback={handleRollback}
        updating={savingOrderId !== null}
        namespace="orders"
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
