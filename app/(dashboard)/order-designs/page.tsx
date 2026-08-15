'use client';

import { useEffect, useCallback, useState, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuPencil, LuTrash2, LuImage, LuCopy,
} from 'react-icons/lu';

import Pagination from '@/components/ui/pagination';
import ConfirmModal from '@/components/ui/confirm-modal';
import Tooltip from '@/components/ui/tooltip';

import { Order, OrderDesignUrl } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from '../(orders-execution)/components/execution-filters';
import ExecutionTitle from '../(orders-execution)/components/execution-title';
import OrderDetailModal from '../(orders-execution)/components/order-detail-modal';
import EditOrderModal from '../(orders-execution)/components/edit-order-modal';
import useOrderPage from '../(orders-execution)/lib/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  getOrderItemDisplayName,
  copyToClipboard,
} from '../(orders-execution)/lib/order-utils';

// ── Types ────────────────────────────────────────────────────────────────
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

// ── Flattened design card (one per designUrls entry) ─────────────────────
interface DesignCard {
  order: Order;
  design: OrderDesignUrl;
  /** 1-based index within the order's designs */
  itemIndex: number;
}

/**
 * Flatten orders into individual design cards.
 * Only orders that have designUrls are included.
 */
function flattenDesigns(orders: Order[]): DesignCard[] {
  const cards: DesignCard[] = [];
  for (const order of orders) {
    if (!order.designUrls || order.designUrls.length === 0) continue;
    order.designUrls.forEach((design, idx) => {
      cards.push({ order, design, itemIndex: idx + 1 });
    });
  }
  return cards;
}

/** Extract sacrificeFor from order reservation data */
function getSacrificeFor(order: Order): string | undefined {
  return order.reservationData?.find((f) => f.key === 'sacrificeFor')?.value;
}

/** Get the product/size display name for a design card */
function getDesignLabel(card: DesignCard, locale: string): string {
  // Try to match the design's productId to an order item
  const item = card.order.items?.find((it) => it.productId === card.design.productId);
  if (item) {
    return getOrderItemDisplayName(item, locale);
  }
  // Fallback to the design's productName snapshot
  return card.design.productName || '';
}

export default function OrderDesignsPage() {
  const t = useTranslations('orderDesigns');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const tomorrow = getRelativeIsoDate(1);

  // ── Order page hook (same as execution page) ───────────────────────────
  const {
    state,
    dispatch,
    setFilter,
    setDateRange,
    setLoading,
    viewOrder,
    closeModal,
    updateOrder,
    setEditOrderModalOpen,
    setEditingField,
    setSelectedOrder,
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
      pageSize: 52,
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
    countryFilter,
    searchInput,
    searchQuery,
    selectedOrder,
    isModalOpen,
    loadingOrderDetails,
    isEditOrderModalOpen,
    editingField,
    savingOrderId,
  } = state;

  // ── Local state ────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [deleteDesign, setDeleteDesign] = useState<{ order: Order; design: OrderDesignUrl } | null>(null);

  // ── Fetch categories + referrals ───────────────────────────────────────
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.success) setCategories(data.data.categories);
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
        if (data.success) setReferrals(data.data.referrals);
      } catch (err) {
        console.error('Error fetching referrals:', err);
      }
    };
    fetchReferrals();
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilter({ searchQuery: searchInput.trim() });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, setFilter]);

  // ── Fetch orders from execution API ────────────────────────────────────
  const fetchDesigns = useCallback(
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
        if (countryFilter && countryFilter !== 'all') params.set('country', countryFilter);
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
          toast.error(data.error || t('loadFailed'));
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
        toast.error(t('loadFailed'));
        dispatch({
          type: 'SET_ORDERS',
          payload: { orders: [], totalOrders: 0, totalPages: 1 },
        });
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [
      fromDateFilter, toDateFilter, sourceFilter, referralFilter,
      categoryFilter, statusFilter, intentionFilter, countryFilter,
      searchQuery, page, pageSize, t, setLoading, dispatch,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchDesigns(controller.signal);
    return () => controller.abort();
  }, [fetchDesigns]);

  // ── Date preset helpers ────────────────────────────────────────────────
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

  const handleRefresh = () => void fetchDesigns();

  // ── Flatten orders → design cards ──────────────────────────────────────
  const designCards = useMemo(() => flattenDesigns(orders), [orders]);

  // ── Counter grouping by orderNumber ────────────────────────────────────
  const counters = useMemo(() => {
    const result: string[] = [];
    const orderGroupIndex = new Map<string, number>();
    const orderOccurrence = new Map<string, number>();
    let groupCount = 0;

    for (const card of designCards) {
      const orderNum = card.order.orderNumber || card.order._id;
      const existing = orderGroupIndex.get(orderNum);
      if (existing === undefined) {
        orderGroupIndex.set(orderNum, groupCount);
        orderOccurrence.set(orderNum, 1);
        result.push(String(groupCount + 1));
        groupCount++;
      } else {
        const occ = (orderOccurrence.get(orderNum) ?? 0) + 1;
        orderOccurrence.set(orderNum, occ);
        result.push(`${existing + 1}.${occ}`);
      }
    }
    return result;
  }, [designCards]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleViewOrder = (order: Order) => {
    viewOrder(order);
  };

  const handleEditField = (order: Order, field: 'name' | 'items' | 'duaa') => {
    setSelectedOrder(order);
    setEditingField(field);
    setEditOrderModalOpen(true);
  };

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await copyToClipboard(text);
      toast.success(isRTL ? `تم نسخ ${label}` : `Copied ${label}`);
    } catch {
      toast.error(isRTL ? 'فشل النسخ' : 'Copy failed');
    }
  };

  const closeEditModal = () => {
    setEditOrderModalOpen(false);
    setEditingField(null);
  };

  const handleDeleteDesign = async () => {
    if (!deleteDesign) return;
    const { design } = deleteDesign;
    if (!design.projectId) {
      toast.error(isRTL ? 'لا يمكن حذف التصميم — معرف المشروع غير موجود' : 'Cannot delete — project ID missing');
      setDeleteDesign(null);
      return;
    }
    try {
      const res = await fetch(`/api/order-designs?id=${encodeURIComponent(design.projectId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(isRTL ? 'تم حذف التصميم' : 'Design deleted');
      setDeleteDesign(null);
      // Refetch orders to update the design list
      void fetchDesigns();
    } catch (error) {
      console.error('Failed to delete design:', error);
      toast.error(isRTL ? 'فشل حذف التصميم' : 'Failed to delete design');
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────
  const isLoading = loading && designCards.length === 0;
  const designAppUrl = process.env.NEXT_PUBLIC_DESIGN_APP_URL;
  const isSingleDay = !!fromDateFilter && fromDateFilter === toDateFilter;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(isRTL ? 'ar' : 'en-US');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-secondary">{t('description')}</p>
        </div>
      </div>

      {/* Filters — same as execution page */}
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

      {/* Date navigation title */}
      {isSingleDay && (
        <div className="mb-6">
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
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl border border-stroke bg-card-bg"
            >
              <div className="aspect-square w-full animate-pulse rounded-t-2xl bg-muted" />
              <div className="p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      ) : designCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LuImage className="h-16 w-16 text-secondary/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{t('emptyTitle')}</h3>
          <p className="mt-1 text-sm text-secondary max-w-md">{t('emptyDescription')}</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {designCards.map((card, index) => {
              const { order: cardOrder, design, itemIndex } = card;
              const counter = counters[index] ?? String(index + 1);
              const sacrificeFor = getSacrificeFor(cardOrder);
              const productLabel = getDesignLabel(card, locale);

              const designEditUrl = designAppUrl && design.projectId
                ? `${designAppUrl}/editor/d/${design.projectId}`
                : undefined;

              // Preview image URL with cache-busting
              const previewUrl = design.url
                ? `${design.url}${design.url.includes('?') ? '&' : '?'}v=${cardOrder.statusUpdateTime || cardOrder.updatedAt || ''}`
                : undefined;

              return (
                <div
                  key={`${cardOrder._id}-${itemIndex}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-stroke bg-card-bg shadow-sm transition-shadow hover:shadow-md cursor-pointer"
                  onClick={() => handleViewOrder(cardOrder)}
                >
                  {/* #Counter — top left */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="flex min-w-7 h-7 px-1.5 items-center justify-center rounded-full bg-primary text-primary-text text-xs font-bold shadow-sm">
                      {counter}
                    </span>
                  </div>

                  {/* Action buttons — top right, stacked vertically */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                    {/* Edit design (opens design app editor) */}
                    {designEditUrl && (
                      <Tooltip content={t('editDesign')} position={isRTL ? 'right' : 'left'}>
                        <a
                          href={designEditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-brand-primary hover:bg-background transition-colors">
                            <LuPencil className="h-4 w-4" />
                          </span>
                        </a>
                      </Tooltip>
                    )}
                    {/* Delete design */}
                    {design.projectId && (
                      <Tooltip content={t('delete')} position={isRTL ? 'right' : 'left'}>
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-error hover:bg-background transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeleteDesign({ order: cardOrder, design }); }}
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    )}
                  </div>

                  {/* Preview */}
                  <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-muted">
                    {previewUrl ? (
                      <DesignImage src={previewUrl} alt={productLabel || cardOrder.orderNumber} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <LuImage className="h-10 w-10 text-secondary/30" />
                      </div>
                    )}
                  </div>

                  {/* Card info */}
                  <div className="flex flex-1 flex-col gap-2 px-4 py-4">
                    {/* Order number — with copy button */}
                    <div className="flex items-center gap-1.5">
                      <span className="flex-1 text-sm font-bold text-foreground truncate">
                        {cardOrder.orderNumber}
                        {itemIndex > 1 && (
                          <span className="text-xs text-secondary"> #{itemIndex}</span>
                        )}
                      </span>
                      <Tooltip content={t('copyOrderNumber')} position={isRTL ? 'right' : 'left'}>
                        <button
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleCopy(cardOrder.orderNumber, isRTL ? 'رقم الطلب' : 'order number'); }}
                        >
                          <LuCopy className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>

                    {/* Product / size name — with inline edit + copy */}
                    {productLabel && (
                      <div className="flex items-start gap-1.5">
                        <p
                          className="line-clamp-2 flex-1 text-sm font-medium text-foreground"
                          title={productLabel}
                        >
                          {productLabel}
                        </p>
                        <Tooltip content={t('editProduct')} position={isRTL ? 'right' : 'left'}>
                          <button
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleEditField(cardOrder, 'items'); }}
                          >
                            <LuPencil className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('copy')} position={isRTL ? 'right' : 'left'}>
                          <button
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleCopy(productLabel, isRTL ? 'اسم المنتج' : 'product name'); }}
                          >
                            <LuCopy className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    )}

                    {/* sacrificeFor — with inline edit + copy */}
                    {sacrificeFor && (
                      <div className="flex items-start gap-1.5">
                        <p
                          className="line-clamp-2 flex-1 text-xs text-secondary"
                          title={sacrificeFor}
                        >
                          {sacrificeFor}
                        </p>
                        <Tooltip content={t('editNames')} position={isRTL ? 'right' : 'left'}>
                          <button
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleEditField(cardOrder, 'name'); }}
                          >
                            <LuPencil className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content={t('copy')} position={isRTL ? 'right' : 'left'}>
                          <button
                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleCopy(sacrificeFor, isRTL ? 'الأسماء' : 'names'); }}
                          >
                            <LuCopy className="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    )}

                    {/* Date */}
                    <p className="mt-auto text-xs text-secondary pt-1">
                      {formatDate(cardOrder.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={(p) => dispatch({ type: 'SET_PAGE', payload: p })}
            disabled={loading}
            pageSize={pageSize}
            onPageSizeChange={(s) => dispatch({ type: 'SET_PAGE_SIZE', payload: s })}
          />
        </>
      )}

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={isModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
        formatDate={formatDate}
        locale={locale}
        namespace="execution"
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={isEditOrderModalOpen}
        onClose={closeEditModal}
        order={selectedOrder}
        field={editingField}
        onUpdate={updateOrder}
        updating={savingOrderId !== null}
      />

      {/* Delete Design Confirmation */}
      <ConfirmModal
        isOpen={!!deleteDesign}
        onClose={() => setDeleteDesign(null)}
        onConfirm={handleDeleteDesign}
        title={t('deleteTitle')}
        message={t('deleteConfirm')}
        type="danger"
        confirmText={t('deleteConfirmBtn')}
        cancelText={t('deleteCancel')}
      />
    </div>
  );
}

// ── Design image with loading state ──────────────────────────────────────
function DesignImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <LuImage className="h-10 w-10 text-secondary/30" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}
