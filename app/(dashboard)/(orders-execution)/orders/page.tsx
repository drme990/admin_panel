'use client';

import { useEffect, useCallback, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import { Order, OrderStatus } from '@/types/Order';
import { Referral } from '@/types/Referral';

import OrderFilters from '../components/order-filters';
import { useOrderColumns } from '../components/order-table-columns';
import OrderDetailModal from '../components/order-detail-modal';
import ChangeStatusModal from '../components/change-status-modal';
import OrderStats from '../components/order-stats';
import useOrderPage from '../lib/use-order-page';
import {
  toIsoDateInput,
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
type DateQuickPreset = 'today' | 'yesterday' | 'last7Days' | 'all';

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
    setBlockingOrderId,
    setBlockedUserIds,
    setAsyncAction,
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
      pageSize: 20,
    },
  });

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
  } = state;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter({ searchQuery: searchInput.trim() });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, setFilter]);

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
    if (preset === 'all') {
      setDateRange({ fromDateFilter: '', toDateFilter: '' });
      return;
    }
    if (preset === 'today') {
      setDateRange({ fromDateFilter: today, toDateFilter: today });
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

  const columns = useOrderColumns({
    onView: viewOrder,
    onWhatsapp: startOrderWhatsappMessage,
    onCopyPhone: copyOrderWhatsappNumber,
    onCopyMessage: copyOrderWhatsappMessage,
    onChangeStatus: handleChangeStatus,
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
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
      />

      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={closeChangeStatusModal}
        currentStatus={selectedOrder?.status ?? 'pending'}
        onUpdateStatus={updateOrderStatus}
        updating={updatingStatus}
        namespace="orders"
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
