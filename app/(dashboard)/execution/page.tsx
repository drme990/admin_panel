'use client';

import { useEffect, useCallback, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { LuDownload, LuPhone, LuEye, LuPalette, LuPencil, LuFileText, LuRefreshCw, LuPlus, LuSparkles, LuCalendar, LuUpload } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Modal from '@/components/ui/modal';

import { Order, OrderStatus } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from '@/components/order/execution-filters';
import { useExecutionColumns } from '@/components/order/execution-table-columns';
import ExecutionTitle from '@/components/order/execution-title';
import ChangeExecutionDateModal from '@/components/order/change-execution-date-modal';
import EditOrderModal from '@/components/order/edit-order-modal';
import OrderHistoryModal, { OrderHistoryEntry } from '@/components/order/order-history-modal';
import ExportModal from '@/components/order/export-modal';
import {
  deleteOldImage,
  uploadImageToR2,
  uploadInvoiceToR2,
} from '@/lib/image-upload-utils';
import OrderDetailModal from '@/components/order/order-detail-modal';
import ChangeStatusModal from '@/components/order/change-status-modal';
import CreateManualOrderModal from '@/components/order/create-manual-order-modal';
import OrderStats from '@/components/order/order-stats';
import OrderGalleryModal from '@/components/order/order-gallery-modal';
import InvoiceUploadModal, { type InvoiceUploadResult } from '@/components/order/invoice-upload-modal';
import useOrderPage from '@/lib/order/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  isImageUrl,
  getOrderItemDisplayName,
  syncOrderDesigns,
} from '@/lib/order/order-utils';
import { downloadFile } from '@/lib/download-utils';
import { cacheExecutionData, getCachedExecutionData, isCacheFresh } from '@/lib/order/execution-cache';

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
  const [uploadingInvoiceOrderId, setUploadingInvoiceOrderId] = useState<string | null>(null);
  const [creatingDesignOrderId, setCreatingDesignOrderId] = useState<string | null>(null);
  const [downloadingDesignOrderId, setDownloadingDesignOrderId] = useState<string | null>(null);
  const [downloadingInvoiceOrderId, setDownloadingInvoiceOrderId] = useState<string | null>(null);
  const [photoPreviewOrder, setPhotoPreviewOrder] = useState<Order | null>(null);
  const [designPreviewOrder, setDesignPreviewOrder] = useState<Order | null>(null);
  const [invoicePreviewOrder, setInvoicePreviewOrder] = useState<Order | null>(null);
  const [bulkExecutionDateTargetIds, setBulkExecutionDateTargetIds] = useState<string[] | null>(null);
  const [isCreateManualOrderModalOpen, setIsCreateManualOrderModalOpen] = useState(false);
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
    viewOrder,
    closeModal,
    handleChangeStatus,
    closeChangeStatusModal,
    startOrderWhatsappMessage,
    copyOrderWhatsappNumber,
    copyOrderWhatsappMessage,
    updateOrderStatus,
    updateOrder,
    fetchOrderDetails,
    setChangeExecutionDateModalOpen,
    setChangingExecutionDateId,
    setEditOrderModalOpen,
    setEditingField,
    setSavingOrderId,
    setOrderHistoryModalOpen,
    setOrderHistory,
    setLoadingOrderHistory,
    setBlockedUserIds,
    setBlockingOrderId,
    setPendingBanOrder,
    setSelectedOrder,
    photoUploadOrderRef,
    photoInputRef,
    invoiceUploadOrderRef,
  } = useOrderPage({
    namespace: 'execution',
    initialState: {
      fromDateFilter: tomorrow,
      toDateFilter: tomorrow,
      sourceFilter: 'all',
      categoryFilter: 'all',
      statusFilter: 'all',
      intentionFilter: 'all',
      countryFilter: '',
      pageSize: 250,
    },
  });

  const [invoiceUploadModalOpen, setInvoiceUploadModalOpen] = useState(false);
  const [invoiceUploadKey, setInvoiceUploadKey] = useState(0);

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
    countryFilter,
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
    stats,
    loadingStats,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    blockedUserIds,
    blockingOrderId,
    pendingBanOrder,
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

  const fetchExecution = useCallback(
    async (signal?: AbortSignal, silent: boolean = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(pageSize));
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
        if (statusFilter !== 'all') params.set('status', statusFilter);
        if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
        if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
        if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

        const queryString = params.toString();

        const res = await fetch(`/api/execution?${queryString}`, {
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

        // Cache the result so the other page (order-designs) can
        // restore it instantly on mount without refetching.
        cacheExecutionData(
          queryString,
          data.data.orders,
          data.data.pagination.totalOrders,
          data.data.pagination.totalPages,
        );
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        toast.error(t('messages.loadFailed'));
        dispatch({
          type: 'SET_ORDERS',
          payload: { orders: [], totalOrders: 0, totalPages: 1 },
        });
      } finally {
        if (!signal?.aborted && !silent) {
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
      countryFilter,
      searchQuery,
      page,
      pageSize,
      t,
      setLoading,
      dispatch,
    ],
  );

  const fetchExecutionForExport = useCallback(
    async (limit: number, offset: number = 0) => {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (referralFilter) params.set('referralId', referralFilter);
      if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
      if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
      if (searchQuery) params.set('search', searchQuery);

      const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
      if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
      if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

      const res = await fetch(`/api/execution?${params.toString()}`, {
        cache: 'no-store',
      });
      const data: ExecutionResponse = await res.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || t('messages.loadFailed'));
      }

      return data.data.orders;
    },
    [
      fromDateFilter,
      toDateFilter,
      sourceFilter,
      referralFilter,
      categoryFilter,
      statusFilter,
      intentionFilter,
      countryFilter,
      searchQuery,
      t,
    ],
  );

  useEffect(() => {
    // Build the same query string that fetchExecution uses, so we
    // can check the shared cache before making a network request.
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (referralFilter) params.set('referralId', referralFilter);
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (intentionFilter && intentionFilter !== 'all') params.set('intention', intentionFilter);
    if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
    if (searchQuery) params.set('search', searchQuery);
    const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
    if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
    if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);
    const queryString = params.toString();

    // Restore from cache instantly (no loading spinner)
    const cached = getCachedExecutionData(queryString);
    if (cached) {
      dispatch({
        type: 'SET_ORDERS',
        payload: {
          orders: cached.orders,
          totalOrders: cached.totalOrders,
          totalPages: cached.totalPages,
        },
      });
      // If the cache is fresh (< 5s old), skip the refetch entirely.
      // This prevents flicker when navigating between /execution and
      // /order-designs with the same filters.
      if (isCacheFresh(queryString)) return;
    }

    const controller = new AbortController();
    void fetchExecution(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchExecution]);

  // ── Silent refetch on window focus ─────────────────────────────────
  // When the admin returns from the design app editor, we need to:
  //   1. Sync the order's designUrls with the latest versions in the
  //      order_design_versions collection (safety net — the design app
  //      updates the order directly in MongoDB, but this sync catches
  //      up if that write failed or hasn't propagated yet).
  //   2. Then do a SILENT refetch (no loading spinner) so the table
  //      updates in place without flicker.
  useEffect(() => {
    const handleFocus = () => {
      // Sync design URLs with the latest versions before refetching.
      // This ensures the order's designUrls[].url points to the newest
      // version even if the design app's direct notification failed.
      const orderNumbers = orders
        .map((o) => o.orderNumber)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (orderNumbers.length > 0) {
        syncOrderDesigns(orderNumbers, false)
          .catch(() => {
            // Best-effort — the refetch will still load whatever is in the DB
          })
          .finally(() => {
            void fetchExecution(undefined, true);
          });
      } else {
        void fetchExecution(undefined, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchExecution, orders]);

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
        if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
        if (searchQuery) params.set('search', searchQuery);

        const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
        if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
        if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

        const res = await fetch(`/api/execution?${params.toString()}`, {
          cache: 'no-store',
        });
        const data: ExecutionResponse = await res.json();

        if (data.success && data.data) {
          const sorted = [...data.data.orders].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          setCategoryModalOrders(sorted);
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
      countryFilter,
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
        if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
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
    [statusFilter, sourceFilter, referralFilter, categoryFilter, intentionFilter, countryFilter, searchQuery, fromDateFilter, toDateFilter, setLoadingStats, setStats],
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
    setBulkExecutionDateTargetIds(null);
    setChangeExecutionDateModalOpen(true);
    dispatch({ type: 'SET_SELECTED_ORDER', payload: order });
  };

  const openBulkChangeExecutionDate = () => {
    const first = orders.find((o) => selectedOrderIds.includes(o._id));
    if (!first) return;
    setBulkExecutionDateTargetIds(selectedOrderIds);
    setChangeExecutionDateModalOpen(true);
    dispatch({ type: 'SET_SELECTED_ORDER', payload: first });
  };

  const closeChangeExecutionDateModal = () => {
    setChangeExecutionDateModalOpen(false);
    setChangingExecutionDateId(null);
    setBulkExecutionDateTargetIds(null);
  };

  const getCurrentExecutionDate = () => {
    if (!selectedOrder) return '';
    const value = selectedOrder.reservationData?.find((f) => f.key === 'executionDate')?.value;
    return value ? value.substring(0, 10) : '';
  };

  const handleEditField = (order: Order, field: 'name' | 'items' | 'duaa') => {
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
      cancelText: t('changeStatusModal.cancel') || t('cancel'),
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
      // Refresh history after rollback
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

  const handleUploadPhoto = (order: Order) => {
    photoUploadOrderRef.current = order;
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const order = photoUploadOrderRef.current;
    if (!order) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

    // Parse existing photos (JSON array or legacy single URL)
    const oldPhotoValue = order.reservationData?.find((f) => f.key === 'photo')?.value;
    const existingUrls: string[] = (() => {
      if (!oldPhotoValue) return [];
      try {
        const parsed = JSON.parse(oldPhotoValue);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
        }
      } catch {
        // Not JSON — treat as a single URL (legacy)
      }
      return [oldPhotoValue];
    })();

    // Max 4 images — refuse if already at the limit
    if (existingUrls.length >= 4) {
      toast.error(t('editOrder.maxPhotosReached') || 'Maximum 4 images allowed');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    const remainingSlots = 4 - existingUrls.length;
    // Take only as many files as we have slots for
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    if (Array.from(files).length > remainingSlots) {
      toast.info(t('editOrder.maxPhotosReached') || `Only ${remainingSlots} image(s) can be uploaded`);
    }

    // Validate all files first — reject the batch if any file is invalid
    for (const file of selectedFiles) {
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
    }

    try {
      setUploadingPhotoOrderId(order._id);
      // Upload all selected files in parallel
      const newUrls = await Promise.all(selectedFiles.map((file) => uploadImageToR2(file)));
      // Append the new images to the existing array (don't replace)
      const updatedUrls = [...existingUrls, ...newUrls];
      await updateOrder(order._id, { photo: JSON.stringify(updatedUrls) });
      // Note: old images are NOT deleted — we're adding, not replacing
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

  // ── Delete a single photo from the gallery modal ───────────────────
  // Removes the URL from the order's photo array and deletes the file
  // from R2. The modal updates immediately (optimistic) — the API call
  // and R2 deletion happen in the background.
  const handleDeletePhoto = async (order: Order, urlToDelete: string) => {
    const photoField = order.reservationData?.find((f) => f.key === 'photo');
    const existingUrls: string[] = (() => {
      if (!photoField?.value) return [];
      try {
        const parsed = JSON.parse(photoField.value);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
        }
      } catch {
        // legacy single URL
      }
      return photoField.value ? [photoField.value] : [];
    })();

    const updatedUrls = existingUrls.filter((u) => u !== urlToDelete);
    const newValue = updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : '';

    // ── Optimistic: update local state immediately so the modal reflects
    // the deletion without waiting for the API round-trip. ──
    const updatedOrder: Order = {
      ...order,
      reservationData: order.reservationData?.map((f) =>
        f.key === 'photo' ? { ...f, value: newValue } : f,
      ),
    };
    setPhotoPreviewOrder(updatedOrder);
    dispatch({
      type: 'UPDATE_ORDER_IN_LIST',
      payload: { orderId: order._id, updates: { reservationData: updatedOrder.reservationData } },
    });

    // If no photos remain, close the modal
    if (updatedUrls.length === 0) {
      setPhotoPreviewOrder(null);
    }

    // ── Background: persist to API + delete from R2 (best-effort) ──
    try {
      await updateOrder(order._id, { photo: newValue });
    } catch (error) {
      console.error('Failed to persist photo deletion:', error);
      // Revert local state on failure
      setPhotoPreviewOrder(order);
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId: order._id, updates: { reservationData: order.reservationData } },
      });
    }

    deleteOldImage(urlToDelete).catch((err: unknown) => {
      console.warn('Failed to delete image from R2:', err);
    });
  };

  // ── Replace a single photo from the gallery modal ──────────────────
  // Uploads the new file, swaps the URL in the array, and deletes the
  // old image from R2. The modal updates immediately after the upload
  // completes (before the API persist round-trip).
  const handleReplacePhoto = async (order: Order, oldUrl: string, file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('editOrder.invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('editOrder.imageTooLarge'));
      return;
    }

    const photoField = order.reservationData?.find((f) => f.key === 'photo');
    const existingUrls: string[] = (() => {
      if (!photoField?.value) return [];
      try {
        const parsed = JSON.parse(photoField.value);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
        }
      } catch {
        // legacy single URL
      }
      return photoField.value ? [photoField.value] : [];
    })();

    const newUrl = await uploadImageToR2(file);
    const updatedUrls = existingUrls.map((u) => (u === oldUrl ? newUrl : u));

    // ── Optimistic: update local state immediately so the modal shows
    // the new image without waiting for the API round-trip. ──
    const updatedOrder: Order = {
      ...order,
      reservationData: order.reservationData?.map((f) =>
        f.key === 'photo' ? { ...f, value: JSON.stringify(updatedUrls) } : f,
      ),
    };
    setPhotoPreviewOrder(updatedOrder);
    dispatch({
      type: 'UPDATE_ORDER_IN_LIST',
      payload: { orderId: order._id, updates: { reservationData: updatedOrder.reservationData } },
    });

    // ── Background: persist to API + delete old image from R2 ──
    try {
      await updateOrder(order._id, { photo: JSON.stringify(updatedUrls) });
    } catch (error) {
      console.error('Failed to persist photo replacement:', error);
      // Revert local state on failure
      setPhotoPreviewOrder(order);
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId: order._id, updates: { reservationData: order.reservationData } },
      });
    }

    deleteOldImage(oldUrl).catch((err: unknown) => {
      console.warn('Failed to delete old image from R2:', err);
    });
  };

  const handleCopyPhotoUrl = async (order: Order) => {
    const photoValue = order.reservationData?.find((f) => f.key === 'photo')?.value;
    if (!photoValue) {
      toast.error(t('editOrder.noPhotoToShare'));
      return;
    }

    // Parse JSON array format (multi-image) or use as single URL (legacy)
    const photoUrls: string[] = (() => {
      try {
        const parsed = JSON.parse(photoValue);
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
        }
      } catch {
        // Not JSON — treat as a single URL (legacy)
      }
      return [photoValue];
    })();

    if (photoUrls.length === 0) {
      toast.error(t('editOrder.noPhotoToShare'));
      return;
    }

    try {
      await navigator.clipboard.writeText(photoUrls.join('\n'));
      toast.success(t('editOrder.photoUrlCopied'));
    } catch {
      toast.error(t('editOrder.failed'));
    }
  };

  const handleUploadInvoice = (order: Order) => {
    invoiceUploadOrderRef.current = order;
    setInvoiceUploadKey((k) => k + 1);
    setInvoiceUploadModalOpen(true);
  };

  const handleInvoiceUploadConfirm = async (result: InvoiceUploadResult) => {
    const order = invoiceUploadOrderRef.current;
    if (!order) return;

    setInvoiceUploadModalOpen(false);

    try {
      setUploadingInvoiceOrderId(order._id);
      const invoiceUrl = await uploadInvoiceToR2(result.file);
      const invoiceValue = parseFloat(result.value);
      await updateOrder(order._id, {
        invoiceUrl,
        invoiceStatus: result.invoiceStatus,
        invoiceValue: Number.isFinite(invoiceValue) ? invoiceValue : 0,
      });
      toast.success(t('editOrder.invoiceUploaded') || 'Invoice uploaded successfully');
      // Refetch the execution list so the table reflects the updated
      // paidAmount, remainingAmount, and status from the server.
      void fetchExecution();
      void fetchExecutionStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('editOrder.uploadFailed');
      toast.error(message);
      console.error('Invoice upload failed:', error);
    } finally {
      invoiceUploadOrderRef.current = null;
      setUploadingInvoiceOrderId(null);
    }
  };

  const handleDownloadInvoice = async (order: Order) => {
    if (downloadingInvoiceOrderId) return;
    const invoices = order.invoiceUrls || [];
    if (invoices.length === 0) {
      toast.error(t('editOrder.noInvoiceToDownload'));
      return;
    }
    setDownloadingInvoiceOrderId(order._id);
    try {
      // Download each invoice as an individual file. If there's only
      // one invoice, keep the simple filename. If there are multiple,
      // append the index so they don't overwrite each other.
      for (let i = 0; i < invoices.length; i++) {
        const invoice = invoices[i];
        const filename = invoices.length > 1
          ? `invoice-${order.orderNumber}-${i + 1}`
          : `invoice-${order.orderNumber}`;
        await downloadFile(invoice.url, filename);
        // Small delay between downloads so the browser doesn't block them
        if (i < invoices.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error(t('messages.downloadFailed') || 'Failed to download invoice');
    } finally {
      setDownloadingInvoiceOrderId(null);
    }
  };

  // ── Design generation ──────────────────────────────────────────────
  // Calls the backend, which calls the design app callback to render
  // the template + upload the JPG to R2. The backend stores the URL on
  // the order's designUrls array and returns the results. We then
  // refetch the order so the table updates (icon switches from
  // "create" to "download + edit").
  // ── Design generation ──────────────────────────────────────────────
  // Maps a backend skip reasonCode to a localized human-readable string.
  // The backend sends machine-readable codes so the admin panel can show
  // them in the user's locale instead of hardcoded Arabic.
  const designReasonKey: Record<string, string> = {
    noTemplate: 'table.designReasonNoTemplate',
    noBookingProduct: 'table.designReasonNoBookingProduct',
    templateNotFound: 'table.designReasonTemplateNotFound',
    designAppNotConfigured: 'table.designReasonDesignAppNotConfigured',
    callbackSecretNotConfigured: 'table.designReasonCallbackSecretNotConfigured',
    timeout: 'table.designReasonTimeout',
    unknown: 'table.designReasonUnknown',
    internalError: 'table.designReasonInternalError',
  };

  const handleCreateDesign = async (order: Order) => {
    setCreatingDesignOrderId(order._id);
    try {
      const res = await fetch(`/api/orders/${order._id}/generate-design`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        // Backend returned an error (500, 401, 404, etc.)
        // Map the error code to a localized message instead of showing
        // the raw English message from the backend.
        const code = data.error?.code || 'internalError';
        const reasonKey = designReasonKey[code] || 'table.designReasonUnknown';
        throw new Error(t(reasonKey));
      }

      const generated = data.data?.generated || [];
      const skipped: Array<{ reasonCode?: string; reason?: string; productName?: string }> =
        data.data?.skipped || [];

      if (generated.length === 0 && skipped.length === 0) {
        // No products in the order at all — nothing to generate
        toast.error(t('table.designCreateFailed'));
      } else if (generated.length === 0) {
        // All products were skipped — show the ACTUAL reason, not a
        // generic "no template" message. Use the first skip's reason
        // (if all products share the same reason, this is perfect; if
        // they differ, the user at least sees one actionable reason).
        const firstSkip = skipped[0];
        const reasonCode = firstSkip?.reasonCode || 'unknown';
        const reasonKey = designReasonKey[reasonCode] || 'table.designReasonUnknown';
        const localizedReason = t(reasonKey);
        toast.error(t('table.designCreateAllSkipped', { reason: localizedReason }));
      } else if (skipped.length > 0) {
        // Partial success — some designs created, some skipped
        toast.info(t('table.designCreatePartial'));
      } else {
        toast.success(t('table.designCreated'));
      }

      // Refetch the order so designUrls is fresh in the table
      const updatedOrder = await fetchOrderDetails(order._id, false);
      if (updatedOrder) {
        // Update the order in the local list so the icon switches
        // immediately without a full refetch.
        dispatch({
          type: 'UPDATE_ORDER_IN_LIST',
          payload: {
            orderId: order._id,
            updates: { designUrls: updatedOrder.designUrls },
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('table.designCreateFailed');
      toast.error(message);
    } finally {
      setCreatingDesignOrderId(null);
    }
  };

  const handleDownloadDesign = async (order: Order) => {
    if (downloadingDesignOrderId) return;
    const designs = order.designUrls || [];
    if (designs.length === 0) {
      toast.error(t('table.noDesignToDownload'));
      return;
    }
    setDownloadingDesignOrderId(order._id);
    try {
      for (let index = 0; index < designs.length; index += 1) {
        const design = designs[index];
        const cacheBustUrl = `${design.url}${design.url.includes('?') ? '&' : '?'}v=${Date.now()}`;
        await downloadFile(cacheBustUrl, `design-${order.orderNumber}-${index + 1}`);
      }
      toast.success(t('table.downloaded'));
    } catch (error) {
      console.error('Error downloading designs:', error);
      toast.error(t('messages.downloadFailed') || 'Failed to download designs');
    } finally {
      setDownloadingDesignOrderId(null);
    }
  };

  // ── Edit design ────────────────────────────────────────────────────
  // Opens the design app's editor in a new tab, loading the DESIGN
  // INSTANCE (not the template) for this order. The user is already
  // logged in via SSO (shared cookie), so no login prompt appears.
  //
  // The design instance is a standalone project created at generation
  // time — it has the order's actual data (customer name, photo, etc.)
  // baked in as concrete text/image layers. Editing it doesn't affect
  // the template or future orders. The template only changes when the
  // user explicitly edits it in the design app's templates section.
  const handleEditDesign = (order: Order, projectIdOverride?: string) => {
    const designs = order.designUrls || [];
    if (designs.length === 0) {
      toast.error(t('table.noDesignToDownload'));
      return;
    }

    // Use the provided projectId (from gallery selection) or fall back to
    // the most recent design's projectId (the design instance, not the template)
    const latest = designs[designs.length - 1];
    const projectId = projectIdOverride || latest.projectId;
    if (!projectId) {
      toast.error(t('table.designCreateFailed'));
      return;
    }

    const designAppUrl = process.env.NEXT_PUBLIC_DESIGN_APP_URL;
    if (!designAppUrl) {
      toast.error(t('table.designCreateFailed'));
      console.error('NEXT_PUBLIC_DESIGN_APP_URL is not set');
      return;
    }

    // Open the editor in a new tab — the SSO cookie authenticates the
    // user automatically. The URL points to the design instance, so
    // the admin edits THIS order's design, not the template.
    window.open(`${designAppUrl}/editor/d/${projectId}`, '_blank');
  };

  // ── Regenerate design ──────────────────────────────────────────────
  // Deletes all existing designs for the order (R2 images + design app
  // projects + thumbnails) and generates fresh ones. Used when the admin
  // wants to start over — e.g. the template was updated or the order
  // data changed after the initial generation.
  const handleRegenerateDesign = async (order: Order) => {
    setCreatingDesignOrderId(order._id);
    try {
      // 1. Delete existing designs (R2 images + design app projects)
      const designs = order.designUrls || [];
      if (designs.length > 0) {
        const deleteRes = await fetch(`/api/orders/${order._id}/designs`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const deleteData = await deleteRes.json();
        if (!deleteData.success) {
          throw new Error(t('table.regenerateDesignFailed'));
        }
      }

      // 2. Generate new designs (same flow as handleCreateDesign)
      const res = await fetch(`/api/orders/${order._id}/generate-design`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        const code = data.error?.code || 'internalError';
        const reasonKey = designReasonKey[code] || 'table.designReasonUnknown';
        throw new Error(t(reasonKey));
      }

      const generated = data.data?.generated || [];
      const skipped: Array<{ reasonCode?: string; reason?: string; productName?: string }> =
        data.data?.skipped || [];

      if (generated.length === 0 && skipped.length === 0) {
        toast.error(t('table.designCreateFailed'));
      } else if (generated.length === 0) {
        const firstSkip = skipped[0];
        const reasonCode = firstSkip?.reasonCode || 'unknown';
        const reasonKey = designReasonKey[reasonCode] || 'table.designReasonUnknown';
        const localizedReason = t(reasonKey);
        toast.error(t('table.designCreateAllSkipped', { reason: localizedReason }));
      } else if (skipped.length > 0) {
        toast.info(t('table.designCreatePartial'));
      } else {
        toast.success(t('table.designRegenerated'));
      }

      // Refetch the order so designUrls is fresh in the table
      const updatedOrder = await fetchOrderDetails(order._id, false);
      if (updatedOrder) {
        dispatch({
          type: 'UPDATE_ORDER_IN_LIST',
          payload: {
            orderId: order._id,
            updates: { designUrls: updatedOrder.designUrls },
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('table.regenerateDesignFailed');
      toast.error(message);
    } finally {
      setCreatingDesignOrderId(null);
    }
  };

  // Syncs the reviewed status of a design across the table row + any open
  // modals (order detail modal / design gallery lightbox) after the admin
  // toggles it — avoids a full refetch.
  const handleDesignReviewChange = useCallback(
    (orderId: string, productId: string, reviewed: boolean) => {
      const targetOrder = orders.find((o) => o._id === orderId) || state.selectedOrder;
      if (!targetOrder) return;
      const updatedDesignUrls = (targetOrder.designUrls || []).map((d) =>
        d.productId === productId ? { ...d, reviewed } : d,
      );
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId, updates: { designUrls: updatedDesignUrls } },
      });
    },
    [orders, state.selectedOrder, dispatch],
  );

  const [creatingPaymentLinkOrderId, setCreatingPaymentLinkOrderId] = useState<string | null>(null);

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
      void fetchExecution();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('regenerateFailed') || 'Failed to create payment link';
      toast.error(message);
    } finally {
      setCreatingPaymentLinkOrderId(null);
    }
  };

  const updateExecutionDate = async (date: string) => {
    if (!selectedOrder || !date) {
      closeChangeExecutionDateModal();
      return;
    }
    const targetIds = bulkExecutionDateTargetIds ?? [selectedOrder._id];
    const isBulk = targetIds.length > 1;
    try {
      setChangingExecutionDateId(selectedOrder._id);
      if (isBulk) {
        const res = await fetch('/api/execution/bulk-date', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderIds: targetIds,
            executionDate: date,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to bulk update execution dates');
        }
        toast.success(`Updated ${data.data.updatedCount} orders`);
        for (const orderId of targetIds) {
          const order = orders.find((o) => o._id === orderId);
          if (!order) continue;
          const nextReservationData = order.reservationData?.map((f) =>
            f.key === 'executionDate' ? { ...f, value: date } : f,
          ) ?? [];
          dispatch({
            type: 'UPDATE_ORDER_RESERVATION_DATA',
            payload: { orderId, reservationData: nextReservationData },
          });
        }

        // The backend triggers design regeneration (fire-and-forget) for
        // each order. The design app will update the order's designUrls
        // via its callback when the new version is ready. We just refetch
        // after a short delay to pick up the updated URLs.
        toast.info(t('table.designRegenerating'));
        setTimeout(() => {
          void fetchExecution(undefined, true);
        }, 3000);

        clearSelection();
      } else {
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

        // The backend triggers design regeneration (fire-and-forget)
        // when the execution date changes. The design app will update
        // the order's designUrls via its callback when ready. We just
        // refetch after a short delay to pick up the updated URL.
        toast.info(t('table.designRegenerating'));
        setTimeout(() => {
          void fetchExecution(undefined, true);
        }, 3000);
      }
      closeChangeExecutionDateModal();
    } catch (error) {
      console.error('Error updating execution date:', error);
      toast.error(isBulk ? 'Failed to bulk update execution dates' : t('changeExecutionDate.failed'));
    } finally {
      setChangingExecutionDateId(null);
    }
  };

  const today = getRelativeIsoDate(0);
  const yesterday = getRelativeIsoDate(-1);
  const lastSevenDaysStart = getRelativeIsoDate(-6);
  const normalizedSelectedRange = normalizeDateRange(fromDateFilter, toDateFilter);
  const isSingleDay =
    !!normalizedSelectedRange.fromDate &&
    normalizedSelectedRange.fromDate === normalizedSelectedRange.toDate;

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
    onUploadInvoice: handleUploadInvoice,
    onDownloadInvoice: handleDownloadInvoice,
    onChangeStatus: handleChangeStatus,
    onViewHistory: handleViewHistory,
    onBlock: handleBlockCustomer,
    onToggleSelect: toggleOrderSelection,
    onToggleSelectAll: toggleSelectAll,
    selectedOrderIds,
    allVisibleSelected,
    tooltipPos: ToolTipPositions as 'left' | 'right',
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    uploadingPhotoOrderId,
    uploadingInvoiceOrderId,
    blockingOrderId,
    blockedUserIds,
    onCreateDesign: handleCreateDesign,
    onRegenerateDesign: handleRegenerateDesign,
    onEditDesign: handleEditDesign,
    onDownloadDesign: handleDownloadDesign,
    onPreviewDesign: (order) => {
      const designs = order.designUrls || [];
      if (designs.length === 0) return;
      setDesignPreviewOrder(order);
    },
    onPreviewPhoto: (order) => {
      const photoField = order.reservationData?.find((f) => f.key === 'photo');
      if (!photoField?.value) return;
      setPhotoPreviewOrder(order);
    },
    onPreviewInvoice: (order) => {
      const invoices = order.invoiceUrls || [];
      if (invoices.length === 0) return;
      setInvoicePreviewOrder(order);
    },
    creatingDesignOrderId,
    downloadingDesignOrderId,
    downloadingInvoiceOrderId,
    currentPage: page,
    pageSize,
    isSingleDay,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary mt-1">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateManualOrderModalOpen(true)}
          >
            <LuPlus size={16} className="me-2" />
            {t('createManualOrder.title')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExportModalOpen(true)}
          >
            <LuDownload size={16} className="me-2" />
            {t('export.button')}
          </Button>
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
        intentionFilter={intentionFilter as string}
        onIntentionChange={(val) => setFilter({ intentionFilter: val })}
        countryFilter={countryFilter as string}
        onCountryChange={(val) => setFilter({ countryFilter: val })}
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
          hideSelector
          onClear={clearSelection}

          clearLabel={t('bulkAction.clear')}
          selectionLabel={t('bulkAction.selectedCount', { count: selectedOrderIds.length })}
          extraLabel={t('bulkAction.executionDateLabel')}
          onExtraApply={openBulkChangeExecutionDate}
          extraIcon={<LuCalendar size={16} />}
          extraLoading={changingExecutionDateId !== null}
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
              const selectedCategory = categories.find((c) => c._id === selectedCategoryId);
              const categoryProductIds = new Set(selectedCategory?.products.map((p) => p._id) || []);

              const groups = new Map<string, Order[]>();
              categoryModalOrders.forEach((order) => {
                const matchingItems = (order.items || []).filter((item) => categoryProductIds.has(item.productId || ''));
                const firstItem = matchingItems[0] || order.items?.[0];
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
                        header: t('table.count'),
                        accessor: (order: Order) => {
                          const matchingItems = (order.items || []).filter((item) => categoryProductIds.has(item.productId || ''));
                          const count = matchingItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
                          return <span className="font-semibold">{count}</span>;
                        },
                        className: 'w-16',
                      },
                      {
                        header: t('table.items'),
                        accessor: (order: Order) => {
                          const matchingItems = (order.items || []).filter((item) => categoryProductIds.has(item.productId || ''));
                          if (matchingItems.length === 0) return <span className="text-secondary">-</span>;
                          return (
                            <div className="flex flex-col gap-0.5">
                              {matchingItems.map((item, i) => {
                                const qty = item.quantity || 1;
                                const name = getOrderItemDisplayName(item, locale);
                                return (
                                  <span key={i} className="text-sm text-foreground">
                                    {qty > 1 ? `${qty} ${name}` : name}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        },
                        className: 'min-w-32',
                      },
                      {
                        header: t('table.invoice'),
                        accessor: (order: Order) => {
                          const invoices = order.invoiceUrls || [];
                          const hasInvoice = invoices.length > 0;
                          const partialPaid = order.status === 'partial-paid';
                          const iconColor = hasInvoice
                            ? (partialPaid ? 'text-orange-600 dark:text-orange-400' : 'text-primary')
                            : 'text-secondary/50';
                          return (
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex flex-row gap-1 items-center min-h-12">
                                {hasInvoice ? (
                                  invoices.slice(0, 3).map((invoice) => (
                                    <a
                                      key={invoice.url}
                                      href={invoice.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-stroke bg-background overflow-hidden hover:border-primary transition-colors"
                                      title={invoice.url.split('/').pop() || invoice.url}
                                    >
                                      {isImageUrl(invoice.url) ? (
                                        // eslint-disable-next-line @next/next/no-img-element -- dynamic URL with conditional render
                                        <img
                                          src={invoice.url}
                                          alt="Invoice"
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : (
                                        <LuFileText size={20} className={iconColor} />
                                      )}
                                    </a>
                                  ))
                                ) : (
                                  <span className={`inline-flex items-center justify-center p-2 ${iconColor}`}>
                                    <LuFileText size={24} />
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-row gap-1">
                                {uploadingInvoiceOrderId === order._id ? (
                                  <span className="inline-flex h-5 w-5 items-center justify-center">
                                    <LuRefreshCw size={12} className="animate-spin text-secondary" />
                                  </span>
                                ) : (
                                  <Tooltip position={ToolTipPositions as 'left' | 'right'} content={t('table.uploadInvoice') || 'Upload invoice'}>
                                    <Button
                                      variant="ghost"
                                      size="custom"
                                      className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); handleUploadInvoice(order); }}
                                      disabled={uploadingInvoiceOrderId === order._id}
                                      aria-label={t('table.uploadInvoice') || 'Upload invoice'}
                                    >
                                      <LuUpload size={12} />
                                    </Button>
                                  </Tooltip>
                                )}
                                <Button
                                  variant="ghost"
                                  size="custom"
                                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); handleDownloadInvoice(order); }}
                                  disabled={!hasInvoice}
                                  aria-label={t('table.downloadInvoice')}
                                >
                                  <LuDownload size={12} />
                                </Button>
                              </div>
                            </div>
                          );
                        },
                        className: 'min-w-16',
                      },
                      {
                        header: t('table.design'),
                        accessor: (order: Order) => {
                          const designs = order.designUrls || [];
                          const hasDesign = designs.length > 0;
                          const isCreating = creatingDesignOrderId === order._id;
                          const isDownloading = downloadingDesignOrderId === order._id;
                          const iconColor = hasDesign ? 'text-primary' : 'text-secondary/50';

                          return (
                            <div className="flex flex-col items-center gap-1">
                              {hasDesign ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setDesignPreviewOrder(order); }}
                                  disabled={isCreating}
                                  className={`inline-flex items-center justify-center p-2 ${iconColor} disabled:opacity-50`}
                                  aria-label={t('table.viewDesign')}
                                >
                                  {isCreating ? (
                                    <LuRefreshCw size={24} className="animate-spin" />
                                  ) : (
                                    <LuPalette size={24} />
                                  )}
                                </button>
                              ) : (
                                <span className={`inline-flex items-center justify-center p-2 ${iconColor}`}>
                                  {isCreating ? (
                                    <LuRefreshCw size={24} className="animate-spin" />
                                  ) : (
                                    <LuPalette size={24} />
                                  )}
                                </span>
                              )}
                              <div className="flex flex-row gap-1">
                                {hasDesign ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="custom"
                                      className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); handleDownloadDesign(order); }}
                                      disabled={isCreating || isDownloading}
                                      aria-label={t('table.downloadDesign')}
                                    >
                                      {isDownloading ? (
                                        <LuRefreshCw size={12} className="animate-spin" />
                                      ) : (
                                        <LuDownload size={12} />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="custom"
                                      className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); handleRegenerateDesign(order); }}
                                      disabled={isCreating}
                                      aria-label={t('table.regenerateDesign')}
                                    >
                                      {isCreating ? (
                                        <LuRefreshCw size={12} className="animate-spin" />
                                      ) : (
                                        <LuRefreshCw size={12} />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="custom"
                                      className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                      onClick={(e) => { e.stopPropagation(); handleEditDesign(order); }}
                                      disabled={isCreating}
                                      aria-label={t('table.editDesign')}
                                    >
                                      <LuPencil size={12} />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="custom"
                                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                                    onClick={(e) => { e.stopPropagation(); handleCreateDesign(order); }}
                                    disabled={isCreating}
                                    aria-label={t('table.createDesign')}
                                  >
                                    {isCreating ? (
                                      <LuRefreshCw size={12} className="animate-spin" />
                                    ) : (
                                      <LuSparkles size={12} />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        },
                        className: 'min-w-20',
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
        onCreatePaymentLink={selectedOrder ? handleCreatePaymentLink : undefined}
        isCreatingPaymentLink={selectedOrder ? creatingPaymentLinkOrderId === selectedOrder._id : false}
        onDesignReviewChange={handleDesignReviewChange}
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
        onRollback={handleRollback}
        updating={savingOrderId !== null}
        namespace="execution"
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        date={fromDateFilter || ''}
        totalCount={totalOrders}
        onFetchForExport={fetchExecutionForExport}
        filters={{
          source: sourceFilter,
          status: statusFilter,
          category: categoryFilter,
          intention: intentionFilter,
          country: countryFilter,
          referralId: referralFilter,
          search: searchQuery,
        }}
      />

      <CreateManualOrderModal
        isOpen={isCreateManualOrderModalOpen}
        onClose={() => setIsCreateManualOrderModalOpen(false)}
        onSuccess={() => {
          void fetchExecution();
          void fetchExecutionStats();
        }}
        namespace="execution"
      />

      <ConfirmModal {...modalProps} />

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoFileChange}
      />

      {/* Invoice upload modal — replaces the old dropdown menu + file picker */}
      <InvoiceUploadModal
        key={`invoice-upload-${invoiceUploadKey}`}
        isOpen={invoiceUploadModalOpen}
        onClose={() => {
          setInvoiceUploadModalOpen(false);
          invoiceUploadOrderRef.current = null;
        }}
        onConfirm={handleInvoiceUploadConfirm}
        orderTotal={0}
        currencyOptions={[{ label: 'EGP', value: 'EGP' }, { label: 'SAR', value: 'SAR' }, { label: 'USD', value: 'USD' }]}
        defaultCurrency="EGP"
        namespace="execution"
      />

      {/* Photo gallery lightbox (customer photos only) */}
      <OrderGalleryModal
        key={`photo-${photoPreviewOrder?._id ?? 'closed'}`}
        order={photoPreviewOrder}
        mode="photo"
        onClose={() => {
          setPhotoPreviewOrder(null);
        }}
        onDeletePhoto={photoPreviewOrder ? (url) => handleDeletePhoto(photoPreviewOrder, url) : undefined}
        onReplacePhoto={photoPreviewOrder ? (oldUrl, file) => handleReplacePhoto(photoPreviewOrder, oldUrl, file) : undefined}
      />

      {/* Design gallery lightbox (designs only) */}
      <OrderGalleryModal
        key={`design-${designPreviewOrder?._id ?? 'closed'}`}
        order={designPreviewOrder}
        mode="design"
        onClose={() => {
          setDesignPreviewOrder(null);
        }}
        onEditDesign={designPreviewOrder ? (item) => {
          if (item.kind === 'design' && item.projectId) {
            handleEditDesign(designPreviewOrder, item.projectId);
          } else {
            handleEditDesign(designPreviewOrder);
          }
        } : undefined}
        onDesignReviewChange={handleDesignReviewChange}
      />

      {/* Invoice gallery lightbox (invoices/receipts only) */}
      <OrderGalleryModal
        key={`invoice-${invoicePreviewOrder?._id ?? 'closed'}`}
        order={invoicePreviewOrder}
        mode="invoice"
        onClose={() => {
          setInvoicePreviewOrder(null);
        }}
      />
    </div>
  );
}
