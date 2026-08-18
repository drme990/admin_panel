'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuPencil, LuTrash2, LuImage, LuCopy, LuCheck, LuClock, LuDownload, LuUpload, LuRefreshCw,
  LuSparkles, LuEye, LuEllipsisVertical, LuX, LuImages, LuFile, LuCalendar,
} from 'react-icons/lu';

import Pagination from '@/components/ui/pagination';
import ConfirmModal from '@/components/ui/confirm-modal';
import Tooltip from '@/components/ui/tooltip';
import Modal from '@/components/ui/modal';
import Checkbox from '@/components/ui/checkbox';
import BulkAction from '@/components/ui/bulk-action';
import { downloadFile } from '@/lib/download-utils';
import { uploadImageToR2, deleteOldImage } from '@/lib/image-upload-utils';

import { Order, OrderDesignUrl, OrderItem, ReservationOrderField } from '@/types/Order';
import { Category } from '@/types/Category';
import { Referral } from '@/types/Referral';

import ExecutionFilters from '@/components/order/execution-filters';
import ExecutionTitle from '@/components/order/execution-title';
import OrderDetailModal from '@/components/order/order-detail-modal';
import EditOrderModal from '@/components/order/edit-order-modal';
import OrderStats from '@/components/order/order-stats';
import ChangeExecutionDateModal from '@/components/order/change-execution-date-modal';
import useOrderPage from '@/lib/order/use-order-page';
import {
  getRelativeIsoDate,
  normalizeDateRange,
  addDaysToIsoDate,
  getOrderItemDisplayName,
  copyToClipboard,
  updateDesignReviewStatus,
  replaceDesignImage,
  deleteSingleDesign,
} from '@/lib/order/order-utils';

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

/** Stable key identifying a single item/design within the selection set */
function cardKey(orderId: string, productId: string): string {
  return `${orderId}::${productId}`;
}

/** Sanitize + build a filename for a design when included in a zip download */
function buildDesignFilename(orderNumber: string, productLabel: string, itemIndex: number): string {
  const base = `${orderNumber}${productLabel ? `-${productLabel}` : ''}${itemIndex > 1 ? `-${itemIndex}` : ''}`;
  const safe = base.replace(/[^a-zA-Z0-9-_. \u0600-\u06FF]/g, '_').trim() || 'design';
  return `${safe}.jpg`;
}

// ── Flattened design card (one per order item) ────────────────────────────
// `design` is present once the design app has generated an image for this
// item; when absent, the card renders as a "no design yet" placeholder
// with a Generate action instead of a preview image.
interface DesignCard {
  order: Order;
  item: OrderItem;
  design?: OrderDesignUrl;
  /** 1-based index of this item within the order's items */
  itemIndex: number;
}

/**
 * Flatten orders into per-item design cards. Every item of every order in
 * range is included — items with a matching generated design carry it,
 * items without one still get a card so the admin can trigger generation.
 */
function flattenDesigns(orders: Order[]): DesignCard[] {
  const cards: DesignCard[] = [];
  for (const order of orders) {
    const items = order.items || [];
    items.forEach((item, idx) => {
      const design = item.productId
        ? order.designUrls?.find((d) => d.productId === item.productId)
        : undefined;
      cards.push({ order, item, design, itemIndex: idx + 1 });
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
  return getOrderItemDisplayName(card.item, locale) || card.design?.productName || '';
}

export default function OrderDesignsPage() {
  const t = useTranslations('orderDesigns');
  const tExec = useTranslations('execution');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const tomorrow = getRelativeIsoDate(1);

  const savedFilters = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem('orderDesigns.filters');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

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
      fromDateFilter: savedFilters?.fromDateFilter ?? tomorrow,
      toDateFilter: savedFilters?.toDateFilter ?? tomorrow,
      sourceFilter: savedFilters?.sourceFilter ?? 'all',
      categoryFilter: savedFilters?.categoryFilter ?? 'all',
      statusFilter: savedFilters?.statusFilter ?? 'all',
      intentionFilter: savedFilters?.intentionFilter ?? 'all',
      countryFilter: savedFilters?.countryFilter ?? '',
      pageSize: savedFilters?.pageSize ?? 52,
      referralFilter: savedFilters?.referralFilter ?? '',
      searchInput: savedFilters?.searchInput ?? '',
      searchQuery: savedFilters?.searchQuery ?? '',
      page: savedFilters?.page ?? 1,
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
  const [generatingOrderId, setGeneratingOrderId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(savedFilters?.reviewFilter ?? 'waiting');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [uploadTargetCard, setUploadTargetCard] = useState<DesignCard | null>(null);
  const [openMoreMenuKey, setOpenMoreMenuKey] = useState<string | null>(null);
  const [previewedCard, setPreviewedCard] = useState<{ card: DesignCard; counter: string } | null>(null);
  const [executionDateTarget, setExecutionDateTarget] = useState<Order[] | null>(null);
  const [updatingExecutionDate, setUpdatingExecutionDate] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Persist filters to session storage ─────────────────────────────────
  const ORDER_DESIGNS_FILTERS_KEY = 'orderDesigns.filters';

  useEffect(() => {
    try {
      const filters = {
        fromDateFilter,
        toDateFilter,
        statusFilter,
        sourceFilter,
        referralFilter,
        categoryFilter,
        intentionFilter,
        countryFilter,
        searchInput,
        searchQuery,
        page,
        pageSize,
        reviewFilter,
      };
      sessionStorage.setItem(ORDER_DESIGNS_FILTERS_KEY, JSON.stringify(filters));
    } catch (err) {
      console.error('Failed to save order-designs filters:', err);
    }
  }, [fromDateFilter, toDateFilter, statusFilter, sourceFilter, referralFilter, categoryFilter, intentionFilter, countryFilter, searchInput, searchQuery, page, pageSize, reviewFilter]);

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
  // When a category filter is active, the backend returns full orders that
  // contain *any* product from that category — but we only want to show the
  // design(s) for the matching product(s), not every item in the order.
  const designCards = useMemo(() => {
    const allCards = flattenDesigns(orders);
    if (!categoryFilter || categoryFilter === 'all') return allCards;

    const selectedCategory = categories.find((c) => c._id === categoryFilter);
    const categoryProductIds = new Set(selectedCategory?.products.map((p) => p._id) || []);
    if (categoryProductIds.size === 0) return allCards;

    return allCards.filter((card) => categoryProductIds.has(card.item.productId || ''));
  }, [orders, categoryFilter, categories]);

  // ── Review status filter (all / reviewed / waiting for review) ─────────
  // Cards without a generated design yet are only shown in the "all" tab —
  // they aren't "waiting for review", they're waiting to be generated.
  const filteredDesignCards = useMemo(() => {
    if (reviewFilter === 'all') return designCards;
    return designCards.filter((card) => {
      if (!card.design) return false;
      return reviewFilter === 'reviewed' ? !!card.design.reviewed : !card.design.reviewed;
    });
  }, [designCards, reviewFilter]);

  const reviewCounts = useMemo(() => {
    let reviewed = 0;
    let withDesign = 0;
    for (const card of designCards) {
      if (!card.design) continue;
      withDesign++;
      if (card.design.reviewed) reviewed++;
    }
    return { all: designCards.length, reviewed, waiting: withDesign - reviewed };
  }, [designCards]);

  // Single day flag must be defined before any derived counters that use it.
  const isSingleDay = !!fromDateFilter && fromDateFilter === toDateFilter;

  // ── Counter / execution number label ───────────────────────────────────
  // Single day: use the persisted execution number (resets per execution date).
  //   If an order has multiple visible items/designs, label them N.1, N.2, ...
  // Multi day: use a plain 1..N counter because execution numbers reset daily
  //   and would collide when showing several days at once.
  const buildCounters = (cards: DesignCard[], singleDay: boolean): string[] => {
    if (!singleDay) {
      return cards.map((_, index) => String(index + 1));
    }

    const orderCounts = new Map<string, number>();
    const orderSeen = new Map<string, number>();

    for (const card of cards) {
      const orderNum = card.order.orderNumber || card.order._id;
      orderCounts.set(orderNum, (orderCounts.get(orderNum) ?? 0) + 1);
    }

    return cards.map((card, index) => {
      const orderNum = card.order.orderNumber || card.order._id;
      const executionNumber = card.order.executionNumber;

      if (!executionNumber) {
        // Fallback for orders that haven't been backfilled yet.
        return String(index + 1);
      }

      const total = orderCounts.get(orderNum) ?? 1;
      const seen = (orderSeen.get(orderNum) ?? 0) + 1;
      orderSeen.set(orderNum, seen);

      if (total === 1) return String(executionNumber);
      return `${executionNumber}.${seen}`;
    });
  };

  const counters = useMemo(() => buildCounters(filteredDesignCards, isSingleDay), [filteredDesignCards, isSingleDay]);

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
    const key = cardKey(cardOrder._id, design.productId);
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
    if (!design) return;
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

    const cardOrder = card.order;
    const existingDesign = card.design;
    const productId = existingDesign?.productId || card.item.productId || '';
    const key = cardKey(cardOrder._id, productId);
    setUploadingKey(key);
    try {
      const newUrl = await uploadImageToR2(file);
      await replaceDesignImage(cardOrder._id, productId, newUrl);

      // Update or add the design entry in the order's designUrls
      const updatedDesignUrls = existingDesign
        ? (cardOrder.designUrls || []).map((d) =>
          d.productId === productId ? { ...d, url: newUrl, reviewed: false } : d,
        )
        : [
          ...(cardOrder.designUrls || []),
          { productId, url: newUrl, templateType: 'text' as const, reviewed: false, createdAt: new Date().toISOString() },
        ];
      dispatch({
        type: 'UPDATE_ORDER_IN_LIST',
        payload: { orderId: cardOrder._id, updates: { designUrls: updatedDesignUrls } },
      });
      toast.success(isRTL ? 'تم استبدال التصميم' : 'Design replaced');

      if (existingDesign) {
        deleteOldImage(existingDesign.url).catch((err: unknown) => {
          console.warn('Failed to delete old design image from R2:', err);
        });
      }
    } catch (error) {
      console.error('Failed to upload design image:', error);
      toast.error(isRTL ? 'فشل رفع الصورة' : 'Failed to upload image');
    } finally {
      setUploadingKey(null);
      setUploadTargetCard(null);
    }
  };

  // ── Generate / Regenerate design ─────────────────────────────────────────
  // Maps a backend skip reasonCode to a localized human-readable string,
  // reusing the same keys the execution page already defines.
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

  const runGenerateDesign = async (order: Order, { isRegenerate }: { isRegenerate: boolean }) => {
    if (generatingOrderId) return;
    setGeneratingOrderId(order._id);
    try {
      if (isRegenerate && (order.designUrls || []).length > 0) {
        const delRes = await fetch(`/api/orders/${order._id}/designs`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const delData = await delRes.json();
        if (!delData.success) throw new Error(tExec('table.regenerateDesignFailed'));
      }

      const res = await fetch(`/api/orders/${order._id}/generate-design`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        const code = data.error?.code || 'internalError';
        throw new Error(tExec(designReasonKey[code] || 'table.designReasonUnknown'));
      }

      const generated = data.data?.generated || [];
      const skipped: Array<{ reasonCode?: string }> = data.data?.skipped || [];

      if (generated.length === 0 && skipped.length === 0) {
        toast.error(tExec('table.designCreateFailed'));
      } else if (generated.length === 0) {
        const reasonCode = skipped[0]?.reasonCode || 'unknown';
        const localizedReason = tExec(designReasonKey[reasonCode] || 'table.designReasonUnknown');
        toast.error(tExec('table.designCreateAllSkipped', { reason: localizedReason }));
      } else if (skipped.length > 0) {
        toast.info(tExec('table.designCreatePartial'));
      } else {
        toast.success(isRegenerate ? tExec('table.designRegenerated') : tExec('table.designCreated'));
      }

      // Refetch the order so the newly generated designUrls are accurate
      const updatedOrder = await fetchOrderDetails(order._id, false);
      if (updatedOrder) {
        dispatch({
          type: 'UPDATE_ORDER_IN_LIST',
          payload: { orderId: order._id, updates: { designUrls: updatedOrder.designUrls } },
        });
      }
    } catch (error) {
      const fallback = isRegenerate ? tExec('table.regenerateDesignFailed') : tExec('table.designCreateFailed');
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setGeneratingOrderId(null);
    }
  };

  const handleGenerateDesign = (order: Order) => runGenerateDesign(order, { isRegenerate: false });
  const handleRegenerateDesign = (order: Order) => runGenerateDesign(order, { isRegenerate: true });

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

  const buildDownloadItems = () => {
    const allCards = [...designCards, ...flattenDesigns(categoryModalOrders)];
    const seen = new Set<string>();
    const items: { url: string; filename: string }[] = [];
    for (const card of allCards) {
      if (!card.design) continue;
      const key = cardKey(card.order._id, card.design.productId);
      if (!selectedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      items.push({
        url: card.design.url,
        filename: buildDesignFilename(card.order.orderNumber, getDesignLabel(card, locale), card.itemIndex),
      });
    }
    return items;
  };

  const downloadAsImages = async (items: { url: string; filename: string }[]) => {
    if (items.length === 0) return;
    setIsDownloadingZip(true);
    try {
      for (const item of items) {
        await downloadFile(item.url, item.filename);
      }
      toast.success(isRTL ? 'تم تحميل التصاميم' : 'Designs downloaded');
      clearSelection();
    } catch (error) {
      console.error('Failed to download designs as images:', error);
      toast.error(isRTL ? 'فشل تحميل التصاميم' : 'Failed to download designs');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const downloadAsZip = async (items: { url: string; filename: string }[]) => {
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

  const getSelectedOrderTargets = () => {
    const allCards = [...designCards, ...flattenDesigns(categoryModalOrders)];
    const seen = new Set<string>();
    const orders: Order[] = [];
    for (const card of allCards) {
      if (!card.design) continue;
      const key = cardKey(card.order._id, card.design.productId);
      if (!selectedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      orders.push(card.order);
    }
    return Array.from(new Map(orders.map((o) => [o._id, o])).values());
  };

  const handleApplyOption = async (mode: string) => {
    if (selectedKeys.size === 0 || isDownloadingZip) return;

    const items = buildDownloadItems();
    if (items.length === 0) return;

    if (mode === 'images') {
      await downloadAsImages(items);
    } else if (mode === 'zip') {
      await downloadAsZip(items);
    }
  };

  const getCurrentExecutionDate = () => {
    if (!executionDateTarget || executionDateTarget.length === 0) return '';
    const value = executionDateTarget[0].reservationData?.find((f) => f.key === 'executionDate')?.value;
    return value ? value.substring(0, 10) : '';
  };

  const handleUpdateExecutionDate = async (date: string) => {
    if (!executionDateTarget || executionDateTarget.length === 0 || !date) return;
    setUpdatingExecutionDate(true);
    try {
      if (executionDateTarget.length === 1) {
        const [order] = executionDateTarget;
        const res = await fetch(`/api/orders/${order._id}/execution-date`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ executionDate: date }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to update execution date');
        }
        const hasExecutionDate = order.reservationData?.some((f) => f.key === 'executionDate');
        const nextReservationData = hasExecutionDate
          ? order.reservationData!.map((f) =>
            f.key === 'executionDate' ? { ...f, value: date } : f,
          )
          : [...(order.reservationData ?? []), { key: 'executionDate', label: { ar: 'تاريخ التنفيذ', en: 'Execution Date' }, type: 'date', value: date } as ReservationOrderField];
        dispatch({
          type: 'UPDATE_ORDER_RESERVATION_DATA',
          payload: { orderId: order._id, reservationData: nextReservationData },
        });
      } else {
        const res = await fetch('/api/execution/bulk-date', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderIds: executionDateTarget.map((o) => o._id),
            executionDate: date,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to bulk update execution dates');
        }
        for (const order of executionDateTarget) {
          const hasExecutionDate = order.reservationData?.some((f) => f.key === 'executionDate');
          const nextReservationData = hasExecutionDate
            ? order.reservationData!.map((f) =>
              f.key === 'executionDate' ? { ...f, value: date } : f,
            )
            : [...(order.reservationData ?? []), { key: 'executionDate', label: { ar: 'تاريخ التنفيذ', en: 'Execution Date' }, type: 'date', value: date } as ReservationOrderField];
          dispatch({
            type: 'UPDATE_ORDER_RESERVATION_DATA',
            payload: { orderId: order._id, reservationData: nextReservationData },
          });
        }
      }
      toast.success(isRTL ? 'تم تحديث تاريخ التنفيذ' : 'Execution date updated');
      setExecutionDateTarget(null);
    } catch (error) {
      console.error('Error updating execution date:', error);
      toast.error(isRTL ? 'فشل تحديث تاريخ التنفيذ' : 'Failed to update execution date');
    } finally {
      setUpdatingExecutionDate(false);
    }
  };

  const openExecutionDateForOrder = (order: Order) => {
    setExecutionDateTarget([order]);
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
    const { order: designOrder, design } = deleteDesign;
    try {
      await deleteSingleDesign(designOrder._id, design.productId);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString(isRTL ? 'ar' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // ── Shared design card renderer (used by the main grid + category modal) ─
  // Renders a full card (with the generated design + all its actions) when
  // `card.design` exists, or a "no design yet" placeholder with a single
  // Generate action otherwise.
  const renderDesignCard = (card: DesignCard, counter: string, isPreview = false) => {
    const { order: cardOrder, design, itemIndex } = card;
    const sacrificeFor = getSacrificeFor(cardOrder);
    const displayName = sacrificeFor || cardOrder.billingData?.fullName || cardOrder.orderNumber;
    const productLabel = getDesignLabel(card, locale);
    const isGenerating = generatingOrderId === cardOrder._id;

    const designEditUrl = design && designAppUrl && design.projectId
      ? `${designAppUrl}/editor/d/${design.projectId}`
      : undefined;

    // Preview image URL with cache-busting
    const previewUrl = design?.url
      ? `${design.url}${design.url.includes('?') ? '&' : '?'}v=${cardOrder.statusUpdateTime || cardOrder.updatedAt || ''}`
      : undefined;

    const isSelected = design ? selectedKeys.has(cardKey(cardOrder._id, design.productId)) : false;

    return (
      <div
        key={`${cardOrder._id}-${itemIndex}`}
        className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card-bg shadow-sm transition-shadow hover:shadow-md ${isPreview ? 'cursor-default' : 'cursor-pointer'} ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-stroke'
          }`}
        onClick={isPreview ? undefined : () => setPreviewedCard({ card, counter })}
      >
        {/* Selection checkbox — top left (only for generated designs) */}
        {design && (
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
        )}

        {/* Action buttons — top right, stacked vertically.
            All actions always render. When there's no design image,
            review/edit/download/regenerate/delete are disabled; upload,
            execution date remain enabled. */}
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
          {(() => {
            const hasDesign = !!design;
            const productId = design?.productId || card.item.productId || '';
            const noDesignTooltip = isRTL ? 'لا يوجد تصميم' : 'No design';
            return (
              <>
                {/* Review status toggle — disabled when no design */}
                <Tooltip
                  content={hasDesign ? (design.reviewed ? t('markAsNotReviewed') : t('markAsReviewed')) : noDesignTooltip}
                  position="left"
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (hasDesign) handleToggleReview(cardOrder, design); }}
                    disabled={!hasDesign || reviewingKey === cardKey(cardOrder._id, productId)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg backdrop-blur-sm border border-stroke transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${hasDesign && design.reviewed
                      ? 'bg-success/90 text-white hover:bg-success'
                      : hasDesign
                        ? 'bg-warning/90 text-white hover:bg-warning'
                        : 'bg-background/90 text-secondary'
                      }`}
                  >
                    {hasDesign && design.reviewed ? (
                      <LuCheck className="h-4 w-4" />
                    ) : (
                      <LuClock className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>
                {/* Edit design — disabled when no design */}
                {hasDesign && designEditUrl ? (
                  <Tooltip content={t('editDesign')} position="left">
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
                ) : (
                  <Tooltip content={noDesignTooltip} position="left">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary opacity-40 cursor-not-allowed">
                      <LuPencil className="h-4 w-4" />
                    </span>
                  </Tooltip>
                )}
                {/* Download design image — disabled when no design */}
                <Tooltip content={hasDesign ? t('downloadDesign') : noDesignTooltip} position="left">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    onClick={(e) => { e.stopPropagation(); if (hasDesign) handleDownloadDesignImage(card); }}
                    disabled={!hasDesign || downloadingKey === cardKey(cardOrder._id, productId)}
                  >
                    {hasDesign && downloadingKey === cardKey(cardOrder._id, productId) ? (
                      <LuRefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <LuDownload className="h-4 w-4" />
                    )}
                  </button>
                </Tooltip>
                {/* More actions: upload, regenerate, execution date, delete */}
                {(() => {
                  const moreMenuKey = cardKey(cardOrder._id, productId);
                  const isMoreOpen = openMoreMenuKey === moreMenuKey;
                  return (
                    <>
                      <Tooltip content={t('more')} position="left">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors"
                          onClick={(e) => { e.stopPropagation(); setOpenMoreMenuKey(isMoreOpen ? null : moreMenuKey); }}
                          aria-label={t('more')}
                        >
                          <LuEllipsisVertical className="h-4 w-4" />
                        </button>
                      </Tooltip>
                      {isMoreOpen && (
                        <>
                          {/* Upload a replacement image — always enabled */}
                          <Tooltip content={t('uploadDesign')} position="left">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-60"
                              onClick={(e) => { e.stopPropagation(); triggerUploadDesign(card); }}
                              disabled={uploadingKey === cardKey(cardOrder._id, productId)}
                            >
                              {uploadingKey === cardKey(cardOrder._id, productId) ? (
                                <LuRefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <LuUpload className="h-4 w-4" />
                              )}
                            </button>
                          </Tooltip>
                          {/* Regenerate design — disabled when no design */}
                          <Tooltip content={hasDesign ? tExec('table.regenerateDesign') : noDesignTooltip} position="left">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={(e) => { e.stopPropagation(); if (hasDesign) handleRegenerateDesign(cardOrder); }}
                              disabled={!hasDesign || isGenerating}
                            >
                              {isGenerating ? (
                                <LuRefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <LuRefreshCw className="h-4 w-4" />
                              )}
                            </button>
                          </Tooltip>
                          {/* Change execution date — always enabled */}
                          <Tooltip content={tExec('table.changeExecutionDate')} position="left">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-primary hover:bg-background transition-colors"
                              onClick={(e) => { e.stopPropagation(); openExecutionDateForOrder(cardOrder); }}
                            >
                              <LuCalendar className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          {/* Delete design — disabled when no design */}
                          <Tooltip content={hasDesign ? t('delete') : noDesignTooltip} position="left">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/90 backdrop-blur-sm border border-stroke text-secondary hover:text-error hover:bg-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={(e) => { e.stopPropagation(); if (hasDesign) setDeleteDesign({ order: cardOrder, design }); }}
                              disabled={!hasDesign}
                            >
                              <LuTrash2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            );
          })()}
        </div>

        {/* Preview — generated image, or a "generate" placeholder */}
        <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-muted">
          {previewUrl ? (
            <DesignImage src={previewUrl} alt={productLabel || cardOrder.orderNumber} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-stroke/70 p-4">
              <LuImage className="h-9 w-9 text-secondary/30" />
              <p className="text-center text-xs text-secondary">{t('noDesignYet')}</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleGenerateDesign(cardOrder); }}
                disabled={isGenerating}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-text hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {isGenerating ? (
                  <LuRefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LuSparkles className="h-3.5 w-3.5" />
                )}
                {isGenerating ? t('generatingDesign') : t('generateDesign')}
              </button>
            </div>
          )}

          {/* Floating eye + counter — bottom left */}
          <div className="absolute bottom-2 left-2 z-10 flex flex-col gap-1.5 items-start">
            <Tooltip content={t('viewOrder')} position="right">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-stroke bg-background text-secondary hover:text-primary hover:bg-primary/10 transition-colors"
                onClick={(e) => { e.stopPropagation(); handleViewOrder(cardOrder); }}
                aria-label={t('viewOrder')}
              >
                <LuEye className="h-4 w-4" />
              </button>
            </Tooltip>
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
          )
          }

          {/* Order number — small secondary chip, with copy */}
          <div className="flex flex-col items-start gap-1.5 pt-1 w-full">
            <div className="flex items-center gap-1 w-full">
              <span className="flex min-w-0 flex-1 items-center rounded-full border border-stroke bg-background px-1.5 py-0.5 text-[10px] sm:text-xs text-secondary truncate">
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
            </div>
            <span className="text-xs text-secondary/70">
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


      {/* Bulk-action bar */}
      <BulkAction
        selectedCount={selectedKeys.size}
        hideSelector
        onClear={clearSelection}
        applyLabel={t('downloadSelected')}
        applyingLabel={t('downloadSelected')}
        clearLabel={t('clearSelection')}
        selectionLabel={`${selectedKeys.size} ${t('selectedCount')}`}
        applyOptions={[
          { label: isRTL ? 'صور منفصلة' : 'Separate images', value: 'images', icon: <LuImages size={16} /> },
          { label: isRTL ? 'ملف مضغوط' : 'ZIP file', value: 'zip', icon: <LuFile size={16} /> },
        ]}
        onApplyOption={handleApplyOption}
        extraLabel={isRTL ? 'تغيير تاريخ التنفيذ' : 'Change execution date'}
        onExtraApply={() => setExecutionDateTarget(getSelectedOrderTargets())}
        extraIcon={<LuCalendar size={16} />}
        extraLoading={updatingExecutionDate}
        loading={isDownloadingZip}
      />

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
                categoryProductIds.size === 0 || categoryProductIds.has(card.item.productId || ''),
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
              const categoryCounters = buildCounters(categoryDesignCards, isSingleDay);
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

      {/* Design card click-to-preview overlay */}
      {previewedCard && (
        <div
          className="fixed inset-0 z-50 h-screen w-screen min-h-screen flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewedCard(null)}
          role="button"
          tabIndex={-1}
          aria-label="Close preview"
        >
          {/* Close preview */}
          <button
            type="button"
            className="absolute top-4 left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground hover:bg-background border border-stroke shadow-sm"
            onClick={(e) => { e.stopPropagation(); setPreviewedCard(null); }}
            aria-label={tExec('table.close')}
          >
            <LuX className="h-5 w-5" />
          </button>
          <div
            className="w-64 sm:w-80 max-w-full scale-125 sm:scale-150 origin-center transition-transform"
            onClick={(e) => e.stopPropagation()}
          >
            {renderDesignCard(previewedCard.card, previewedCard.counter, true)}
          </div>
        </div>
      )}

      {/* Hidden file input for the "upload replacement image" action */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUploadFileChange}
      />

      {/* Change Execution Date Modal */}
      <ChangeExecutionDateModal
        isOpen={!!executionDateTarget}
        onClose={() => setExecutionDateTarget(null)}
        currentDate={getCurrentExecutionDate()}
        onUpdateDate={handleUpdateExecutionDate}
        updating={updatingExecutionDate}
        locale={locale}
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
