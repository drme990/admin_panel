'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import { Order } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from './components/execution-filters';
import { useExecutionColumns } from './components/execution-table-columns';
import ExecutionTitle from './components/execution-title';
import ChangeExecutionDateModal from './components/change-execution-date-modal';
import EditOrderModal from './components/edit-order-modal';
import OrderHistoryModal, { OrderHistoryEntry } from './components/order-history-modal';
import OrderDetailModal from '../components/order-detail-modal';
import ChangeStatusModal from '../components/change-status-modal';
import OrderStats from '../components/order-stats';
import useOrderPage from '../components/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  formatHeaderDate,
} from '../components/order-utils';

interface ExecutionResponse {
  success: boolean;
  data?: {
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      totalOrders: number;
      totalPages: number;
    };
    date?: string;
    fromDate?: string;
    toDate?: string;
  };
  error?: string;
}

type DateQuickPreset = 'today' | 'tomorrow' | 'yesterday' | 'last7Days' | 'all';

export default function ExecutionPage() {
  const t = useTranslations('execution');
  const locale = useLocale();

  const tomorrow = getRelativeIsoDate(1);

  const [categories, setCategories] = useState<Category[]>([]);
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
    updateOrder,
    setChangeExecutionDateModalOpen,
    setChangingExecutionDateId,
    setEditOrderModalOpen,
    setEditingField,
    setSavingOrderId,
    setOrderHistoryModalOpen,
    setOrderHistory,
    setLoadingOrderHistory,
    setAsyncAction,
    photoUploadOrderRef,
    photoInputRef,
  } = useOrderPage({
    namespace: 'execution',
    initialState: {
      fromDateFilter: tomorrow,
      toDateFilter: tomorrow,
      sourceFilter: 'all',
      categoryFilter: 'all',
      statusFilter: 'all',
      pageSize: 50,
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
    sourceFilter,
    referralFilter,
    categoryFilter,
    searchInput,
    searchQuery,
    selectedOrder,
    isModalOpen,
    loadingOrderDetails,
    isChangeExecutionDateModalOpen,
    changingExecutionDateId,
    isEditOrderModalOpen,
    editingField,
    savingOrderId,
    isOrderHistoryModalOpen,
    orderHistory,
    loadingOrderHistory,
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
  } = state;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.success) {
          setCategories(data.data.categories);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res = await fetch('/api/referrals?limit=100', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setReferrals(data.data.referrals);
        }
      } catch (err) {
        console.error('Error fetching referrals:', err);
      }
    };
    fetchReferrals();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter({ searchQuery: searchInput.trim() });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, setFilter]);

  const fetchExecution = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(pageSize));
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
        if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/execution?${params.toString()}`, {
          cache: 'no-store',
          signal,
        });
        const data: ExecutionResponse = await res.json();

        if (!data.success || !data.data) {
          toast.error(data.error || t('messages.loadFailed'));
          dispatch({
            type: 'SET_ORDERS',
            payload: { orders: [], totalOrders: 0, totalPages: 1 },
          });
          return;
        }

        dispatch({
          type: 'SET_ORDERS',
          payload: {
            orders: data.data.orders,
            totalOrders: data.data.pagination.totalOrders,
            totalPages: data.data.pagination.totalPages,
          },
        });
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        toast.error(t('messages.loadFailed'));
        dispatch({
          type: 'SET_ORDERS',
          payload: { orders: [], totalOrders: 0, totalPages: 1 },
        });
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [
      fromDateFilter,
      toDateFilter,
      sourceFilter,
      referralFilter,
      categoryFilter,
      statusFilter,
      searchQuery,
      page,
      pageSize,
      t,
      setLoading,
      dispatch,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchExecution(controller.signal);
    return () => controller.abort();
  }, [fetchExecution]);

  const handleRefresh = () => {
    void fetchExecution();
  };

  const fetchExecutionStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingStats(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
        if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/execution/stats?${params.toString()}`, {
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
        console.error('Error fetching execution stats:', error);
      } finally {
        if (!signal?.aborted) {
          setLoadingStats(false);
        }
      }
    },
    [statusFilter, sourceFilter, referralFilter, categoryFilter, searchQuery, fromDateFilter, toDateFilter, setLoadingStats, setStats],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchExecutionStats(controller.signal);
    return () => controller.abort();
  }, [fetchExecutionStats]);

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleChangeExecutionDate = (order: Order) => {
    setChangeExecutionDateModalOpen(true);
    setChangingExecutionDateId(order._id);
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
  };

  const closeChangeExecutionDateModal = () => {
    setChangeExecutionDateModalOpen(false);
    setChangingExecutionDateId(null);
  };

  const getCurrentExecutionDate = () => {
    if (!selectedOrder) return '';
    const value = selectedOrder.reservationData?.find((f) => f.key === 'executionDate')?.value;
    return value ? value.substring(0, 10) : '';
  };

  const handleEditField = (order: Order, field: 'name' | 'items' | 'duaa' | 'photo') => {
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    setEditingField(field);
    setEditOrderModalOpen(true);
  };

  const closeEditOrderModal = () => {
    setEditOrderModalOpen(false);
    setEditingField(null);
  };

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

  const handleUploadPhoto = (order: Order) => {
    photoUploadOrderRef.current = order;
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const order = photoUploadOrderRef.current;
    if (!order) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('editOrder.invalidImage'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const photoUrl = reader.result as string;
      await updateOrder(order._id, { photo: photoUrl });
      photoUploadOrderRef.current = null;
      if (photoInputRef.current) photoInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPhotoUrl = async (order: Order) => {
    const photoUrl = order.reservationData?.find((f) => f.key === 'photo')?.value;
    if (!photoUrl) {
      toast.error(t('editOrder.noPhotoToShare'));
      return;
    }
    try {
      await navigator.clipboard.writeText(photoUrl);
      toast.success(t('editOrder.photoUrlCopied'));
    } catch {
      toast.error(t('editOrder.failed'));
    }
  };

  const updateExecutionDate = async (date: string) => {
    if (!selectedOrder || !date) {
      closeChangeExecutionDateModal();
      return;
    }
    try {
      setChangingExecutionDateId(selectedOrder._id);
      const res = await fetch(`/api/orders/${selectedOrder._id}/execution-date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionDate: date }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update execution date');
      }
      toast.success(t('changeExecutionDate.success'));
      const nextReservationData = selectedOrder.reservationData?.map((f) =>
        f.key === 'executionDate' ? { ...f, value: date } : f,
      ) ?? [];
      dispatch({
        type: 'UPDATE_ORDER_RESERVATION_DATA',
        payload: { orderId: selectedOrder._id, reservationData: nextReservationData },
      });
      closeChangeExecutionDateModal();
    } catch (error) {
      console.error('Error updating execution date:', error);
      toast.error(t('changeExecutionDate.failed'));
    } finally {
      setChangingExecutionDateId(null);
    }
  };

  const applyBulkExecutionDate = async () => {
    if (selectedOrderIds.length === 0 || !bulkValue) return;
    try {
      setBulkUpdating(true);
      const res = await fetch('/api/execution/bulk-date', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          executionDate: bulkValue,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to bulk update execution dates');
      }
      toast.success(`Updated ${data.data.updatedCount} orders`);
      for (const orderId of selectedOrderIds) {
        const order = orders.find((o) => o._id === orderId);
        if (!order) continue;
        const nextReservationData = order.reservationData?.map((f) =>
          f.key === 'executionDate' ? { ...f, value: bulkValue } : f,
        ) ?? [];
        dispatch({
          type: 'UPDATE_ORDER_RESERVATION_DATA',
          payload: { orderId, reservationData: nextReservationData },
        });
      }
      clearSelection();
      setBulkValue('');
    } catch (error) {
      console.error('Error bulk updating execution dates:', error);
      toast.error('Failed to bulk update execution dates');
    } finally {
      setBulkUpdating(false);
    }
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
        : normalizedSelectedRange.fromDate === tomorrow && normalizedSelectedRange.toDate === tomorrow
          ? 'tomorrow'
          : normalizedSelectedRange.fromDate === yesterday && normalizedSelectedRange.toDate === yesterday
            ? 'yesterday'
            : normalizedSelectedRange.fromDate === lastSevenDaysStart && normalizedSelectedRange.toDate === today
              ? 'last7Days'
              : 'custom';

  const applyDatePreset = (preset: DateQuickPreset) => {
    if (preset === 'all') { setDateRange({ fromDateFilter: '', toDateFilter: '' }); return; }
    if (preset === 'today') { setDateRange({ fromDateFilter: today, toDateFilter: today }); return; }
    if (preset === 'tomorrow') { setDateRange({ fromDateFilter: tomorrow, toDateFilter: tomorrow }); return; }
    if (preset === 'yesterday') { setDateRange({ fromDateFilter: yesterday, toDateFilter: yesterday }); return; }
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

  const allVisibleSelected = orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o._id));
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';

  const columns = useExecutionColumns({
    onView: viewOrder,
    onWhatsapp: startOrderWhatsappMessage,
    onCopyPhone: copyOrderWhatsappNumber,
    onCopyMessage: copyOrderWhatsappMessage,
    onChangeExecutionDate: handleChangeExecutionDate,
    onEditField: handleEditField,
    onUploadPhoto: handleUploadPhoto,
    onCopyPhotoUrl: handleCopyPhotoUrl,
    onChangeStatus: handleChangeStatus,
    onViewHistory: handleViewHistory,
    onToggleSelect: toggleOrderSelection,
    onToggleSelectAll: toggleSelectAll,
    selectedOrderIds,
    allVisibleSelected,
    tooltipPos: ToolTipPositions as 'left' | 'right',
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary mt-1">{t('description')}</p>
        </div>
      </div>

      <ExecutionFilters
        searchInput={searchInput}
        onSearchChange={(value) => setFilter({ searchInput: value })}
        sourceFilter={sourceFilter}
        onSourceChange={(val) => setFilter({ sourceFilter: val })}
        onRefresh={handleRefresh}
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
        categoryFilter={categoryFilter as string}
        onCategoryChange={(val) => setFilter({ categoryFilter: val })}
        categories={categories}
        totalOrders={totalOrders}
        statusFilter={statusFilter}
        onStatusChange={(val) => setFilter({ statusFilter: val })}
      />

      {fromDateFilter && (
        <ExecutionTitle
          date={fromDateFilter}
          locale={locale}
          onPrevDay={() => {
            if (!fromDateFilter) return;
            const prev = addDaysToIsoDate(fromDateFilter, -1);
            setDateRange({ fromDateFilter: prev, toDateFilter: prev });
          }}
          onNextDay={() => {
            if (!fromDateFilter) return;
            const next = addDaysToIsoDate(fromDateFilter, 1);
            setDateRange({ fromDateFilter: next, toDateFilter: next });
          }}
        />
      )}

      {selectedOrderIds.length > 0 && (
        <BulkAction
          selectedCount={selectedOrderIds.length}
          value={bulkValue}
          options={[]}
          onValueChange={setBulkValue}
          onApply={applyBulkExecutionDate}
          onClear={clearSelection}
          applyLabel={t('bulkAction.apply')}
          applyingLabel={t('bulkAction.applying')}
          clearLabel={t('bulkAction.clear')}
          selectionLabel={t('bulkAction.selectedCount', { count: selectedOrderIds.length })}
          dropdownLabel={t('bulkAction.executionDateLabel')}
          locale={locale}
          disabled={!bulkValue}
          loading={bulkUpdating}
        />
      )}

      <div className="space-y-3">
        <Table<Order>
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage={t('emptyMessage')}
          onRowClick={viewOrder}
        />
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <OrderStats stats={stats} loading={loadingStats} locale={locale} namespace="execution" />

      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
        formatDate={formatDate}
        locale={locale}
        namespace="execution"
      />

      <ChangeExecutionDateModal
        isOpen={isChangeExecutionDateModalOpen}
        onClose={closeChangeExecutionDateModal}
        currentDate={getCurrentExecutionDate()}
        onUpdateDate={updateExecutionDate}
        updating={changingExecutionDateId !== null}
        locale={locale}
      />

      <EditOrderModal
        isOpen={isEditOrderModalOpen}
        onClose={closeEditOrderModal}
        order={selectedOrder}
        field={editingField}
        onUpdate={updateOrder}
        updating={savingOrderId !== null}
      />

      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={closeChangeStatusModal}
        currentStatus={selectedOrder?.status || 'paid'}
        onUpdateStatus={updateOrderStatus}
        updating={updatingStatus}
        namespace="execution"
      />

      <OrderHistoryModal
        isOpen={isOrderHistoryModalOpen}
        onClose={closeOrderHistoryModal}
        orderNumber={selectedOrder?.orderNumber || ''}
        history={orderHistory as OrderHistoryEntry[]}
        loading={loadingOrderHistory}
      />

      <ConfirmModal {...modalProps} />

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
    </div>
  );
}
