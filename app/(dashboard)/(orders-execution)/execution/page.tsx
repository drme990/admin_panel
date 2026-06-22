'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { LuDownload, LuPhone, LuEye } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import Button from '@/components/ui/button';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Modal from '@/components/ui/modal';

import { Order } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from '../components/execution-filters';
import { useExecutionColumns } from '../components/execution-table-columns';
import ExecutionTitle from '../components/execution-title';
import ChangeExecutionDateModal from '../components/change-execution-date-modal';
import EditOrderModal from '../components/edit-order-modal';
import OrderHistoryModal, { OrderHistoryEntry } from '../components/order-history-modal';
import ExportModal from '../components/export-modal';
import { uploadImageToR2, deleteOldImage } from '../../../../lib/image-upload-utils';
import OrderDetailModal from '../components/order-detail-modal';
import ChangeStatusModal from '../components/change-status-modal';
import OrderStats from '../components/order-stats';
import useOrderPage from '../lib/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  formatHeaderDate,
} from '../lib/order-utils';

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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [uploadingPhotoOrderId, setUploadingPhotoOrderId] = useState<string | null>(null);
  const { confirm, modalProps } = useConfirmModal();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryModalOrders, setCategoryModalOrders] = useState<Order[]>([]);
  const [categoryModalLoading, setCategoryModalLoading] = useState(false);

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
      intentionFilter: 'all',
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
    intentionFilter,
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
        if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
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
      intentionFilter,
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

  const handleCategoryClick = useCallback(
    async (categoryId: string) => {
      setSelectedCategoryId(categoryId);
      setIsCategoryModalOpen(true);
      setCategoryModalLoading(true);
      setCategoryModalOrders([]);

      try {
        const params = new URLSearchParams();
        params.set('limit', '500');
        params.set('page', '1');
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        params.set('category', categoryId);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
        if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/execution?${params.toString()}`, {
          cache: 'no-store',
        });
        const data: ExecutionResponse = await res.json();

        if (data.success && data.data) {
          setCategoryModalOrders(data.data.orders);
        } else {
          toast.error(data.error || t('messages.loadFailed'));
          setCategoryModalOrders([]);
        }
      } catch {
        toast.error(t('messages.loadFailed'));
        setCategoryModalOrders([]);
      } finally {
        setCategoryModalLoading(false);
      }
    },
    [
      fromDateFilter,
      toDateFilter,
      sourceFilter,
      referralFilter,
      statusFilter,
      intentionFilter,
      searchQuery,
      t,
    ],
  );

  const fetchExecutionStats = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingStats(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
        if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
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
    [statusFilter, sourceFilter, referralFilter, categoryFilter, intentionFilter, searchQuery, fromDateFilter, toDateFilter, setLoadingStats, setStats],
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

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('editOrder.invalidImage'));
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('editOrder.imageTooLarge'));
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    try {
      setUploadingPhotoOrderId(order._id);
      const oldPhotoUrl = order.reservationData?.find((f) => f.key === 'photo')?.value;
      const photoUrl = await uploadImageToR2(file);
      await updateOrder(order._id, { photo: photoUrl });

      if (oldPhotoUrl) {
        deleteOldImage(oldPhotoUrl).catch((error: unknown) => {
          console.warn('Failed to delete old customer image:', error);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('editOrder.uploadFailed');
      toast.error(message);
      console.error('Photo upload failed:', error);
    } finally {
      photoUploadOrderRef.current = null;
      setUploadingPhotoOrderId(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
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
    uploadingPhotoOrderId,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary mt-1">{t('description')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExportModalOpen(true)}
          className="shrink-0"
        >
          <LuDownload size={16} className="me-2" />
          {t('export.button')}
        </Button>
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
        intentionFilter={intentionFilter as string}
        onIntentionChange={(val) => setFilter({ intentionFilter: val })}
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

      <OrderStats stats={stats} loading={loadingStats} locale={locale} namespace="execution" onCategoryClick={handleCategoryClick} />

      {/* Category Orders Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={(() => {
          const cat = stats?.byCategory?.find((c) => c.categoryId === selectedCategoryId);
          return cat?.categoryName || '';
        })()}
        size="xl"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {categoryModalLoading ? (
            <Table<Order>
              columns={[]}
              data={[]}
              loading={true}
            />
          ) : categoryModalOrders.length === 0 ? (
            <div className="text-center py-8 text-secondary">
              {t('emptyMessage')}
            </div>
          ) : (
            (() => {
              const groups = new Map<string, Order[]>();
              categoryModalOrders.forEach((order) => {
                const firstItem = order.items?.[0];
                const productName = firstItem
                  ? (locale === 'ar' ? firstItem.productName?.ar : firstItem.productName?.en) || t('stats.uncategorized')
                  : t('stats.uncategorized');
                if (!groups.has(productName)) {
                  groups.set(productName, []);
                }
                groups.get(productName)!.push(order);
              });
              return Array.from(groups.entries()).map(([productName, orders]) => (
                <div key={productName} className="bg-card-bg border border-stroke rounded-site overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-stroke">
                    <h4 className="font-semibold text-sm">{productName}</h4>
                    <span className="text-xs text-secondary bg-card-bg border border-stroke rounded-full px-2.5 py-1">
                      {orders.length} {t('ordersCount')}
                    </span>
                  </div>
                  <Table<Order>
                    columns={[
                      {
                        header: t('table.orderNumber'),
                        accessor: (order: Order) => (
                          <span className="font-semibold">{order.orderNumber}</span>
                        ),
                        className: 'min-w-28',
                      },
                      {
                        header: t('table.sacrificeFor'),
                        accessor: (order: Order) => {
                          const sacrificeFor = order.reservationData?.find((f) => f.key === 'sacrificeFor')?.value;
                          const names = sacrificeFor
                            ? sacrificeFor.replace(/\n/g, ',').replace(/;/g, ',').split(',').map((s) => s.trim()).filter(Boolean)
                            : [];
                          const displayName = names.length > 0 ? names[0] : (order.billingData?.fullName || '-');
                          return <span>{displayName}</span>;
                        },
                        className: 'min-w-40',
                      },
                      {
                        header: t('table.paidAmount'),
                        accessor: (order: Order) => {
                          const displayedAmount = typeof order.paidAmount === 'number' ? order.paidAmount : order.totalAmount;
                          const remaining = order.remainingAmount ?? 0;
                          const hasRemaining = remaining > 0.001;
                          return (
                            <span className={`font-bold ${hasRemaining ? 'text-orange-600 dark:text-orange-400' : 'text-success'}`}>
                              {displayedAmount.toFixed(2)} {order.currency}
                            </span>
                          );
                        },
                        className: 'min-w-24',
                      },
                      {
                        header: t('table.remainingAmount'),
                        accessor: (order: Order) => {
                          const remaining = order.remainingAmount;
                          if (!remaining || remaining <= 0) {
                            return (
                              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {t('status.paid')}
                              </span>
                            );
                          }
                          return (
                            <span className="font-bold text-orange-600 dark:text-orange-400">
                              {remaining.toFixed(2)} {order.currency}
                            </span>
                          );
                        },
                        className: 'min-w-24',
                      },
                      {
                        header: t('table.actions'),
                        accessor: (order: Order) => (
                          <div className="flex flex-row gap-2">
                            <Button
                              variant="icon-primary"
                              size="custom"
                              onClick={(e) => {
                                e.stopPropagation();
                                void copyOrderWhatsappNumber(order);
                              }}
                              aria-label={t('table.copyPhone')}
                            >
                              <LuPhone size={16} />
                            </Button>
                            <Button
                              variant="icon-primary"
                              size="custom"
                              onClick={(e) => {
                                e.stopPropagation();
                                void startOrderWhatsappMessage(order);
                              }}
                              aria-label={t('table.whatsapp')}
                            >
                              <FaWhatsapp size={16} />
                            </Button>
                            <Button
                              variant="icon-primary"
                              size="custom"
                              onClick={(e) => {
                                e.stopPropagation();
                                viewOrder(order);
                              }}
                              aria-label={t('table.viewDetails')}
                            >
                              <LuEye size={16} />
                            </Button>
                          </div>
                        ),
                        className: 'min-w-32',
                      },
                    ]}
                    data={orders}
                    onRowClick={viewOrder}
                  />
                </div>
              ));
            })()
          )}
        </div>
      </Modal>

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

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        date={fromDateFilter || ''}
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
