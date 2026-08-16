'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuPencil, LuTrash2, LuImage, LuCopy, LuCheck, LuClock, LuDownload, LuUpload, LuRefreshCw,
} from 'react-icons/lu';

import Pagination from '@/components/ui/pagination';
import ConfirmModal from '@/components/ui/confirm-modal';
import Tooltip from '@/components/ui/tooltip';
import Modal from '@/components/ui/modal';
import Checkbox from '@/components/ui/checkbox';
import BulkAction from '@/components/ui/bulk-action';
import { downloadFile } from '@/lib/download-utils';
import { uploadImageToR2, deleteOldImage } from '@/lib/image-upload-utils';

import { Order, OrderDesignUrl } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from '../(orders-execution)/components/execution-filters';
import ExecutionTitle from '../(orders-execution)/components/execution-title';
import OrderDetailModal from '../(orders-execution)/components/order-detail-modal';
import EditOrderModal from '../(orders-execution)/components/edit-order-modal';
import OrderStats from '../(orders-execution)/components/order-stats';
import useOrderPage from '../(orders-execution)/lib/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  getOrderItemDisplayName,
  copyToClipboard,
  updateDesignReviewStatus,
  replaceDesignImage,
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
type ReviewFilter = 'all' | 'reviewed' | 'waiting';

/** Stable key identifying a single design within the selection set */
function cardKey(orderId: string, productId: string): string {
  return `${orderId}::${productId}`;
}

/** Sanitize + build a filename for a design when included in a zip download */
function buildDesignFilename(orderNumber: string, productLabel: string, itemIndex: number): string {
  const base = `${orderNumber}${productLabel ? `-${productLabel}` : ''}${itemIndex > 1 ? `-${itemIndex}` : ''}`;
  const safe = base.replace(/[^a-zA-Z0-9-_. \u0600-\u06FF]/g, '_').trim() || 'design';
  return `${safe}.jpg`;
}

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
  const tExec = useTranslations('execution');
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
    setLoadingStats,
    setStats,
    viewOrder,
    closeModal,
    updateOrder,
    fetchOrderDetails,
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
    stats,
    loadingStats,
  } = state;

  // ── Local state ────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [deleteDesign, setDeleteDesign] = useState<{ order: Order; design: OrderDesignUrl } | null>(null);
  const [creatingPaymentLinkOrderId, setCreatingPaymentLinkOrderId] = useState<string | null>(null);
  const [reviewingKey, setReviewingKey] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [uploadTargetCard, setUploadTargetCard] = useState<DesignCard | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Category drill-down (same UX as the execution page) ────────────────
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryModalOrders, setCategoryModalOrders] = useState<Order[]>([]);
  const [categoryModalLoading, setCategoryModalLoading] = useState(false);

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

  // ── Category breakdown stats (same as the execution page) ──────────────
  const fetchStats = useCallback(
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
        if (data.success) setStats(data.data);
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') return;
        console.error('Error fetching order-designs stats:', error);
      } finally {
        if (!signal?.aborted) setLoadingStats(false);
      }
    },
    [
      statusFilter, sourceFilter, referralFilter, categoryFilter,
      intentionFilter, countryFilter, searchQuery, fromDateFilter, toDateFilter,
      setLoadingStats, setStats,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchStats(controller.signal);
    return () => controller.abort();
  }, [fetchStats]);

  // ── Category drill-down click — mirrors the execution page's behavior ──
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

        const res = await fetch(`/api/execution?${params.toString()}`, { cache: 'no-store' });
        const data: ExecutionResponse = await res.json();

        if (data.success && data.data) {
          const sorted = [...data.data.orders].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          setCategoryModalOrders(sorted);
        } else {
          toast.error(data.error || t('loadFailed'));
          setCategoryModalOrders([]);
        }
      } catch {
        toast.error(t('loadFailed'));
        setCategoryModalOrders([]);
      } finally {
        setCategoryModalLoading(false);
      }
    },
    [
      fromDateFilter, toDateFilter, sourceFilter, referralFilter,
      statusFilter, intentionFilter, countryFilter, searchQuery, t,
    ],
  );

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

  // ── Review status filter (all / reviewed / waiting for review) ─────────
  const filteredDesignCards = useMemo(() => {
    if (reviewFilter === 'all') return designCards;
    return designCards.filter((card) =>
      reviewFilter === 'reviewed' ? !!card.design.reviewed : !card.design.reviewed,
    );
  }, [designCards, reviewFilter]);

  const reviewCounts = useMemo(() => {
    let reviewed = 0;
    for (const card of designCards) {
      if (card.design.reviewed) reviewed++;
    }
    return { all: designCards.length, reviewed, waiting: designCards.length - reviewed };
  }, [designCards]);

  // ── Counter grouping by orderNumber ────────────────────────────────────
  const buildCounters = (cards: DesignCard[]): string[] => {
    const result: string[] = [];
    const orderGroupIndex = new Map<string, number>();
    const orderOccurrence = new Map<string, number>();
    let groupCount = 0;

    for (const card of cards) {
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
  };

  const counters = useMemo(() => buildCounters(filteredDesignCards), [filteredDesignCards]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleViewOrder = (order: Order) => {
    viewOrder(order);
  };

  const handleEditField = (order: Order, field: 'name' | 'items' | 'duaa') => {
    setSelectedOrder(order);
    setEditingField(field);
    setEditOrderModalOpen(true);
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
      toast.success(isRTL ? 'تم إنشاء رابط الدفع' : 'Payment link created');
      const updatedOrder = await fetchOrderDetails(order._id, false);
      if (updatedOrder) {
        setSelectedOrder(updatedOrder);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : (isRTL ? 'فشل إنشاء رابط الدفع' : 'Failed to create payment link');
      toast.error(message);
    } finally {
      setCreatingPaymentLinkOrderId(null);
    }
  };

  const handleToggleReview = async (cardOrder: Order, design: OrderDesignUrl) => {
    const key = `${cardOrder._id}-${design.productId}`;
    if (reviewingKey) return;
    const nextReviewed = !design.reviewed;
    setReviewingKey(key);
    try {
      await updateDesignReviewStatus(cardOrder._id, design.productId, nextReviewed);
      const updatedDesignUrls = (cardOrder.designUrls || []).map((d) =>
        d.productId === design.productId ? { ...d, reviewed: nextReviewed } : d,
      );
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId: cardOrder._id, updates: { designUrls: updatedDesignUrls } },
      });
      toast.success(nextReviewed ? t('reviewed') : t('waitingForReview'));
    } catch (error) {
      console.error('Failed to update review status:', error);
      toast.error(t('reviewUpdateFailed'));
    } finally {
      setReviewingKey(null);
    }
  };

  // ── Download a single design as an image ────────────────────────────────
  const handleDownloadDesignImage = async (card: DesignCard) => {
    const { order: cardOrder, design, itemIndex } = card;
    const key = cardKey(cardOrder._id, design.productId);
    if (downloadingKey) return;
    setDownloadingKey(key);
    try {
      const cacheBustUrl = `${design.url}${design.url.includes('?') ? '&' : '?'}v=${Date.now()}`;
      await downloadFile(cacheBustUrl, buildDesignFilename(cardOrder.orderNumber, getDesignLabel(card, locale), itemIndex));
    } catch (error) {
      console.error('Failed to download design:', error);
      toast.error(tExec('messages.downloadFailed') || (isRTL ? 'فشل التحميل' : 'Download failed'));
    } finally {
      setDownloadingKey(null);
    }
  };

  // ── Upload a replacement image for a single design ──────────────────────
  const triggerUploadDesign = (card: DesignCard) => {
    if (uploadingKey) return;
    setUploadTargetCard(card);
    uploadInputRef.current?.click();
  };

  const handleUploadFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const card = uploadTargetCard;
    if (e.target) e.target.value = '';
    if (!file || !card) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(tExec('editOrder.invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(tExec('editOrder.imageTooLarge'));
      return;
    }

    const { order: cardOrder, design } = card;
    const key = cardKey(cardOrder._id, design.productId);
    setUploadingKey(key);
    try {
      const newUrl = await uploadImageToR2(file);
      await replaceDesignImage(cardOrder._id, design.productId, newUrl);

      const updatedDesignUrls = (cardOrder.designUrls || []).map((d) =>
        d.productId === design.productId ? { ...d, url: newUrl, reviewed: false } : d,
      );
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId: cardOrder._id, updates: { designUrls: updatedDesignUrls } },
      });
      toast.success(isRTL ? 'تم استبدال التصميم' : 'Design replaced');

      deleteOldImage(design.url).catch((err: unknown) => {
        console.warn('Failed to delete old design image from R2:', err);
      });
    } catch (error) {
      console.error('Failed to upload design image:', error);
      toast.error(isRTL ? 'فشل رفع الصورة' : 'Failed to upload image');
    } finally {
      setUploadingKey(null);
      setUploadTargetCard(null);
    }
  };

  // ── Selection + zip download ───────────────────────────────────────────
  const toggleCardSelection = (orderId: string, productId: string) => {
    const key = cardKey(orderId, productId);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => setSelectedKeys(new Set());

  const handleDownloadSelected = async () => {
    if (selectedKeys.size === 0 || isDownloadingZip) return;
    const allCards = [...designCards, ...flattenDesigns(categoryModalOrders)];
    const seen = new Set<string>();
    const items: { url: string; filename: string }[] = [];
    for (const card of allCards) {
      const key = cardKey(card.order._id, card.design.productId);
      if (!selectedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      items.push({
        url: card.design.url,
        filename: buildDesignFilename(card.order.orderNumber, getDesignLabel(card, locale), card.itemIndex),
      });
    }
    if (items.length === 0) return;

    setIsDownloadingZip(true);
    try {
      const res = await fetch('/api/order-designs/download-zip', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const dateTime = new Date().toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `order-designs-${dateTime}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success(isRTL ? 'تم تحميل التصاميم' : 'Designs downloaded');
      clearSelection();
    } catch (error) {
      console.error('Failed to download designs zip:', error);
      toast.error(isRTL ? 'فشل تحميل التصاميم' : 'Failed to download designs');
    } finally {
      setIsDownloadingZip(false);
    }
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

  // ── Shared design card renderer (used by the main grid + category modal) ─
  const renderDesignCard = (card: DesignCard, counter: string) => {
    const { order: cardOrder, design, itemIndex } = card;
    const sacrificeFor = getSacrificeFor(cardOrder);
    const displayName = sacrificeFor || cardOrder.billingData?.fullName || cardOrder.orderNumber;
    const productLabel = getDesignLabel(card, locale);
    const isSelected = selectedKeys.has(cardKey(cardOrder._id, design.productId));

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
        className={`group relative flex flex-col rounded-2xl border bg-card-bg shadow-sm transition-shadow hover:shadow-md cursor-pointer ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-stroke'
          }`}
        onClick={() => handleViewOrder(cardOrder)}
      >
        {/* Selection checkbox — top left */}
        <div className="absolute top-2 left-2 z-10">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-stroke bg-background/90 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onChange={() => toggleCardSelection(cardOrder._id, design.productId)}
              aria-label={t('selectDesign')}
              size="sm"
            />
          </div>
        </div>

        {/* Action buttons — top right, stacked vertically */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          {/* Review status toggle */}
          <Tooltip
            content={design.reviewed ? t('markAsNotReviewed') : t('markAsReviewed')}
            position={isRTL ? 'right' : 'left'}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleToggleReview(cardOrder, design); }}
              disabled={reviewingKey === `${cardOrder._id}-${design.productId}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg backdrop-blur-sm border border-stroke transition-colors disabled:opacity-60 ${design.reviewed
                ? 'bg-success/90 text-white hover:bg-success'
                : 'bg-warning/90 text-white hover:bg-warning'
                }`}
            >
              {design.reviewed ? (
                <LuCheck className="h-4 w-4" />
              ) : (
                <LuClock className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
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
          {/* Download design image */}
          <Tooltip content={t('downloadDesign')} position={isRTL ? 'right' : 'left'}>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-60"
              onClick={(e) => { e.stopPropagation(); handleDownloadDesignImage(card); }}
              disabled={downloadingKey === cardKey(cardOrder._id, design.productId)}
            >
              {downloadingKey === cardKey(cardOrder._id, design.productId) ? (
                <LuRefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LuDownload className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
          {/* Upload a replacement image */}
          <Tooltip content={t('uploadDesign')} position={isRTL ? 'right' : 'left'}>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-60"
              onClick={(e) => { e.stopPropagation(); triggerUploadDesign(card); }}
              disabled={uploadingKey === cardKey(cardOrder._id, design.productId)}
            >
              {uploadingKey === cardKey(cardOrder._id, design.productId) ? (
                <LuRefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <LuUpload className="h-4 w-4" />
              )}
            </button>
          </Tooltip>
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

          {/* #Counter — bottom left */}
          <div className="absolute bottom-2 left-2 z-10">
            <span className="flex min-w-7 h-7 px-1.5 items-center justify-center rounded-full bg-primary text-primary-text text-xs font-bold shadow-sm">
              {counter}
            </span>
          </div>
        </div>

        {/* Card info */}
        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          {/* Name (sacrificeFor) — primary heading, with inline edit + copy */}
          <div className="flex items-start gap-1.5">
            <p
              className="line-clamp-2 flex-1 text-sm font-bold text-foreground"
              title={displayName}
            >
              {displayName}
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
                onClick={(e) => { e.stopPropagation(); handleCopy(displayName, isRTL ? 'الأسماء' : 'names'); }}
              >
                <LuCopy className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>

          {/* Product / size name — with inline edit + copy */}
          {productLabel && (
            <div className="flex items-start gap-1.5">
              <p
                className="line-clamp-2 flex-1 text-sm font-medium text-secondary"
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

          {/* Order number — small secondary chip, with copy */}
          <div className="mt-auto flex items-center gap-1.5 pt-1">
            <span className="inline-flex items-center gap-1 rounded-full border border-stroke bg-background px-2 py-0.5 text-xs text-secondary truncate">
              #{cardOrder.orderNumber}
              {itemIndex > 1 && ` · ${itemIndex}`}
            </span>
            <Tooltip content={t('copyOrderNumber')} position={isRTL ? 'right' : 'left'}>
              <button
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleCopy(cardOrder.orderNumber, isRTL ? 'رقم الطلب' : 'order number'); }}
              >
                <LuCopy className="h-3 w-3" />
              </button>
            </Tooltip>
            <span className="ml-auto text-xs text-secondary/70">
              {formatDate(cardOrder.createdAt)}
            </span>
          </div>
        </div>
      </div>
    );
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

      {/* Review status filter — all / reviewed / waiting for review */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: 'all', label: t('all'), count: reviewCounts.all },
          { key: 'reviewed', label: t('reviewed'), count: reviewCounts.reviewed },
          { key: 'waiting', label: t('waitingForReview'), count: reviewCounts.waiting },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setReviewFilter(tab.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${reviewFilter === tab.key
              ? 'bg-primary text-primary-text'
              : 'bg-card-bg border border-stroke text-secondary hover:text-foreground'
              }`}
          >
            {tab.label}
            <span className={`text-xs ${reviewFilter === tab.key ? 'opacity-80' : 'text-secondary/70'}`}>
              ({tab.count})
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
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
      ) : filteredDesignCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <LuImage className="h-16 w-16 text-secondary/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{t('emptyTitle')}</h3>
          <p className="mt-1 text-sm text-secondary max-w-md">{t('emptyDescription')}</p>
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {filteredDesignCards.map((card, index) =>
              renderDesignCard(card, counters[index] ?? String(index + 1)),
            )}
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

      {/* Category breakdown — same as the execution page */}
      <OrderStats stats={stats} loading={loadingStats} locale={locale} namespace="execution" onCategoryClick={handleCategoryClick} />

      {/* Floating bulk-action bar — download selected designs as a zip */}
      <BulkAction
        selectedCount={selectedKeys.size}
        hideSelector
        onApply={handleDownloadSelected}
        onClear={clearSelection}
        applyLabel={t('downloadSelected')}
        applyingLabel={t('downloadSelected')}
        clearLabel={t('clearSelection')}
        selectionLabel={`${selectedKeys.size} ${t('selectedCount')}`}
        applyIcon={<LuDownload size={16} />}
        loading={isDownloadingZip}
      />

      {/* Category Orders Modal — mirrors the execution page's drill-down */}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : categoryModalOrders.length === 0 ? (
            <div className="text-center py-8 text-secondary">
              {tExec('emptyMessage')}
            </div>
          ) : (
            (() => {
              const selectedCategory = categories.find((c) => c._id === selectedCategoryId);
              const categoryProductIds = new Set(selectedCategory?.products.map((p) => p._id) || []);

              const categoryDesignCards = flattenDesigns(categoryModalOrders).filter((card) =>
                categoryProductIds.size === 0 || categoryProductIds.has(card.design.productId),
              );

              if (categoryDesignCards.length === 0) {
                return (
                  <div className="text-center py-8 text-secondary">
                    {t('emptyDescription')}
                  </div>
                );
              }

              const groups = new Map<string, DesignCard[]>();
              categoryDesignCards.forEach((card) => {
                const productName = getDesignLabel(card, locale) || tExec('stats.uncategorized');
                if (!groups.has(productName)) groups.set(productName, []);
                groups.get(productName)!.push(card);
              });
              const categoryCounters = buildCounters(categoryDesignCards);
              let cursor = 0;

              return Array.from(groups.entries()).map(([productName, cards]) => {
                const startIndex = cursor;
                cursor += cards.length;
                return (
                  <div key={productName} className="bg-card-bg border border-stroke rounded-site overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-stroke">
                      <h4 className="font-semibold text-sm">{productName}</h4>
                      <span className="text-xs text-secondary bg-card-bg border border-stroke rounded-full px-2.5 py-1">
                        {cards.length} {tExec('ordersCount')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 p-4 xs:grid-cols-2 sm:grid-cols-3">
                      {cards.map((card, i) => renderDesignCard(card, categoryCounters[startIndex + i]))}
                    </div>
                  </div>
                );
              });
            })()
          )}
        </div>
      </Modal>

      {/* Order Detail Modal */}
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
        onDesignReviewChange={(orderId, productId, reviewed) => {
          const targetOrder = orders.find((o) => o._id === orderId) || selectedOrder;
          if (!targetOrder) return;
          const updatedDesignUrls = (targetOrder.designUrls || []).map((d) =>
            d.productId === productId ? { ...d, reviewed } : d,
          );
          dispatch({
            type: 'UPDATE_ORDER_IN_LIST',
            payload: { orderId, updates: { designUrls: updatedDesignUrls } },
          });
        }}
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

      {/* Hidden file input for the "upload replacement image" action */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUploadFileChange}
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
