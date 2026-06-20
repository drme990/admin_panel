'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import { Order } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';
import {
  buildOrderWhatsappMessageFromOrder,
  buildProcessingOrderWhatsappFollowUpMessage,
} from '@/lib/order-whatsapp';

import ExecutionFilters from './components/execution-filters';
import { useExecutionColumns } from './components/execution-table-columns';
import ExecutionTitle from './components/execution-title';
import OrderDetailModal from '../orders/components/order-detail-modal';
import ChangeExecutionDateModal from './components/change-execution-date-modal';

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

function toIsoDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getRelativeIsoDate(daysOffset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  return toIsoDateInput(d);
}

function normalizeDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate > toDate) return { fromDate: toDate, toDate: fromDate };
  return { fromDate, toDate };
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00');
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatHeaderDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)}-${Number(month)}-${year}`;
}

export default function ExecutionPage() {
  const t = useTranslations('execution');
  const locale = useLocale();

  const tomorrow = getRelativeIsoDate(1);

  const [fromDateFilter, setFromDateFilter] = useState(tomorrow);
  const [toDateFilter, setToDateFilter] = useState(tomorrow);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [referralFilter, setReferralFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [isChangeExecutionDateModalOpen, setIsChangeExecutionDateModalOpen] = useState(false);
  const [changingExecutionDateId, setChangingExecutionDateId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkExecutionDate, setBulkExecutionDate] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [whatsappOrderId, setWhatsappOrderId] = useState<string | null>(null);
  const [copyingPhoneOrderId, setCopyingPhoneOrderId] = useState<string | null>(null);
  const [copyingMessageOrderId, setCopyingMessageOrderId] = useState<string | null>(null);
  const { confirm, modalProps } = useConfirmModal();

  // Fetch categories once
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

  // Fetch referrals once
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchExecution = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(pageSize));
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (categoryFilter !== 'all') params.set('category', categoryFilter);
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
          setOrders([]);
          setTotalOrders(0);
          setTotalPages(1);
          return;
        }

        setOrders(data.data.orders);
        setTotalOrders(data.data.pagination.totalOrders);
        setTotalPages(data.data.pagination.totalPages);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        toast.error(t('messages.loadFailed'));
        setOrders([]);
        setTotalOrders(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [fromDateFilter, toDateFilter, sourceFilter, referralFilter, categoryFilter, statusFilter, searchQuery, page, pageSize, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchExecution(controller.signal);
    return () => controller.abort();
  }, [fetchExecution]);

  const handleRefresh = () => {
    void fetchExecution();
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
          toast.error(t('messages.loadFailed'));
        }
        return null;
      }
    },
    [t, locale],
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

  const handleChangeExecutionDate = (order: Order) => {
    setSelectedOrder(order);
    setIsChangeExecutionDateModalOpen(true);
  };

  const closeChangeExecutionDateModal = () => {
    setIsChangeExecutionDateModalOpen(false);
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
      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, reservationData: order.reservationData?.map((f) => f.key === 'executionDate' ? { ...f, value: date } : f) ?? [] }
            : order,
        ),
      );
      closeChangeExecutionDateModal();
    } catch (error) {
      console.error('Error updating execution date:', error);
      toast.error(t('changeExecutionDate.failed'));
    } finally {
      setChangingExecutionDateId(null);
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
    const allSelected = orders.length > 0 && orders.every((o) => selectedOrderIds.includes(o._id));
    if (allSelected) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o._id));
    }
  };

  const applyBulkExecutionDate = async () => {
    if (selectedOrderIds.length === 0 || !bulkExecutionDate) return;
    try {
      setBulkUpdating(true);
      const res = await fetch('/api/execution/bulk-date', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          executionDate: bulkExecutionDate,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to bulk update execution dates');
      }
      toast.success(`Updated ${data.data.updatedCount} orders`);
      setOrders((prev) =>
        prev.map((order) =>
          selectedOrderIds.includes(order._id)
            ? { ...order, reservationData: order.reservationData?.map((f) => f.key === 'executionDate' ? { ...f, value: bulkExecutionDate } : f) ?? [] }
            : order,
        ),
      );
      setSelectedOrderIds([]);
      setBulkExecutionDate('');
    } catch (error) {
      console.error('Error bulk updating execution dates:', error);
      toast.error('Failed to bulk update execution dates');
    } finally {
      setBulkUpdating(false);
    }
  };

  const allVisibleSelected = orders.length > 0 && orders.every((order) => selectedOrderIds.includes(order._id));
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';

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
    if (preset === 'all') { setFromDateFilter(''); setToDateFilter(''); setPage(1); return; }
    if (preset === 'today') { setFromDateFilter(today); setToDateFilter(today); setPage(1); return; }
    if (preset === 'tomorrow') { setFromDateFilter(tomorrow); setToDateFilter(tomorrow); setPage(1); return; }
    if (preset === 'yesterday') { setFromDateFilter(yesterday); setToDateFilter(yesterday); setPage(1); return; }
    setFromDateFilter(lastSevenDaysStart);
    setToDateFilter(today);
    setPage(1);
  };

  const handleFromDateChange = (value: string) => {
    const r = normalizeDateRange(value, toDateFilter);
    setFromDateFilter(r.fromDate);
    setToDateFilter(r.toDate);
    setPage(1);
  };

  const handleToDateChange = (value: string) => {
    const r = normalizeDateRange(fromDateFilter, value);
    setFromDateFilter(r.fromDate);
    setToDateFilter(r.toDate);
    setPage(1);
  };

  const columns = useExecutionColumns({
    onView: viewOrder,
    onWhatsapp: startOrderWhatsappMessage,
    onCopyPhone: copyOrderWhatsappNumber,
    onCopyMessage: copyOrderWhatsappMessage,
    onChangeExecutionDate: handleChangeExecutionDate,
    onToggleSelect: toggleOrderSelection,
    onToggleSelectAll: toggleSelectAllVisible,
    selectedOrderIds,
    allVisibleSelected,
    tooltipPos: ToolTipPositions as 'left' | 'right',
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
  });

  const getCurrentExecutionDate = () => {
    const val = selectedOrder?.reservationData?.find((f) => f.key === 'executionDate')?.value;
    return val || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary mt-1">{t('description')}</p>
        </div>
      </div>

      {/* Filters */}
      <ExecutionFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        onRefresh={handleRefresh}
        fromDateFilter={fromDateFilter}
        toDateFilter={toDateFilter}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        activeDatePreset={activeDatePreset}
        onDatePreset={applyDatePreset}
        locale={locale}
        referralFilter={referralFilter}
        onReferralChange={setReferralFilter}
        referrals={referrals}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        totalOrders={totalOrders}
        statusFilter={statusFilter}
        onStatusChange={(val) => { setStatusFilter(val); setPage(1); }}
      />

      {fromDateFilter && (
        <ExecutionTitle
          date={fromDateFilter}
          locale={locale}
          onPrevDay={() => {
            if (!fromDateFilter) return;
            const prev = addDaysToIsoDate(fromDateFilter, -1);
            setFromDateFilter(prev);
            setToDateFilter(prev);
            setPage(1);
          }}
          onNextDay={() => {
            if (!fromDateFilter) return;
            const next = addDaysToIsoDate(fromDateFilter, 1);
            setFromDateFilter(next);
            setToDateFilter(next);
            setPage(1);
          }}
        />
      )}

      {selectedOrderIds.length > 0 && (
        <BulkAction
          selectedCount={selectedOrderIds.length}
          value={bulkExecutionDate}
          options={[]}
          onValueChange={setBulkExecutionDate}
          onApply={applyBulkExecutionDate}
          onClear={() => { setSelectedOrderIds([]); setBulkExecutionDate(''); }}
          applyLabel={t('bulkAction.apply')}
          applyingLabel={t('bulkAction.applying')}
          clearLabel={t('bulkAction.clear')}
          selectionLabel={t('bulkAction.selectedCount', { count: selectedOrderIds.length })}
          dropdownLabel={t('bulkAction.executionDateLabel')}
          locale={locale}
          disabled={!bulkExecutionDate}
          loading={bulkUpdating}
        />
      )}

      {/* Orders table */}
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
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
        formatDate={formatDate}
        locale={locale}
      />

      <ChangeExecutionDateModal
        isOpen={isChangeExecutionDateModalOpen}
        onClose={closeChangeExecutionDateModal}
        currentDate={getCurrentExecutionDate()}
        onUpdateDate={updateExecutionDate}
        updating={changingExecutionDateId !== null}
        locale={locale}
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
