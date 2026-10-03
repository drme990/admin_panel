'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuSearch,
  LuRefreshCw,
  LuEye,
  LuTrophy,
  LuCopy,
  LuImage,
  LuDownload,
  LuShare2,
  LuHandHelping,
  LuPhone,
  LuCalendar,
  LuPenLine,
  LuHistory,
  LuBan,
  LuPencil,
  LuUpload,
  LuArrowUp,
  LuArrowDown,
  LuArrowUpDown,
  LuCreditCard,
  LuPhoneOff,
  LuPhoneCall,
  LuCircleCheck,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa';
import type { IconType } from 'react-icons';

import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Tabs from '@/components/ui/tabs';
import Dropdown from '@/components/ui/dropdown';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import CustomDatePicker from '@/components/ui/custom-date-picker';

import { useAuth } from '@/components/providers/auth-provider';
import OrderDetailModal from '@/components/order/order-detail-modal';
import OrderGalleryModal from '@/components/order/order-gallery-modal';
import ChangeStatusModal from '@/components/order/change-status-modal';
import ChangeExecutionDateModal from '@/components/order/change-execution-date-modal';
import OrderHistoryModal, {
  type OrderHistoryEntry,
} from '@/components/order/order-history-modal';
import EditOrderModal from '@/components/order/edit-order-modal';
import AdminAchievementsModal from '@/components/booking-intent/admin-achievements-modal';
import AdminAchievementCards, {
  type AdminStatsCategory,
  type AdminStatsRow,
} from '@/components/booking-intent/admin-achievement-cards';
import AdminCategoryOrdersModal from '@/components/booking-intent/admin-category-orders-modal';
import ExecutionTitle from '@/components/order/execution-title';
import CountrySelector from '@/components/shared/country-selector';
import ReferralFilter, {
  type ReferralFilterItem,
} from '@/components/shared/referral-filter';
import useOrderPage from '@/lib/order/use-order-page';
import { downloadFile } from '@/lib/download-utils';
import { deleteOldImage, uploadImageToR2 } from '@/lib/image-upload-utils';
import {
  addDaysToIsoDate,
  getOrderItemDisplayName,
  getRelativeIsoDate,
} from '@/lib/order/order-utils';
import { RESERVATION_FIELD_PRESETS } from '@/lib/reservation-fields';
import type { Category } from '@/types/Category';
import type {
  Order,
  OrderStatus,
  ReservationOrderField,
} from '@/types/Order';

type IntentStatus = 'new' | 'contacted' | 'converted';
type StatusTab = 'all' | 'new' | 'contacted' | 'converted';
type DateQuickPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'custom';

interface IntentAdmin {
  adminId: string;
  name: string;
  email: string;
}

interface BookingIntentRow {
  _id: string;
  orderId: string;
  orderNumber: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
  };
  items: { productName: { ar: string; en: string }; quantity: number }[];
  reservationName?: string;
  amount: number;
  currency: string;
  source?: 'manasik' | 'ghadaq';
  paymentAttemptCount: number;
  orderCreatedAt: string;
  /** Full order doc — powers the execution-style cells. */
  order: Order;
  status: IntentStatus;
  assignedTo?: IntentAdmin;
  assignedAt?: string;
}

interface IntentListResponse {
  intents: BookingIntentRow[];
  statusCounts: Record<string, number>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalIntents: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  displayDelayMinutes: number;
}

type AdminStats = AdminStatsRow;

// The page tracks 3 visual states only:
//   notConnected (gray)   — nobody talked to this customer yet
//   connected    (orange) — an admin is talking / talked to them
//   confirmed    (green)  — the customer paid
type IntentVisualState = 'notConnected' | 'connected' | 'confirmed';

const INTENT_STATE_BG: Record<IntentVisualState, string> = {
  notConnected: 'bg-gray-400 dark:bg-gray-500',
  connected: 'bg-orange-500',
  confirmed: 'bg-green-500',
};

const INTENT_STATE_ICON: Record<IntentVisualState, IconType> = {
  notConnected: LuPhoneOff,
  connected: LuPhoneCall,
  confirmed: LuCircleCheck,
};

function intentVisualState(status: IntentStatus): IntentVisualState {
  if (status === 'converted') return 'confirmed';
  if (status === 'contacted') return 'connected';
  return 'notConnected';
}

// ── Cell helpers — same markup/behavior as the execution table ───────

function getReservationValue(order: Order, key: string): string | undefined {
  return order.reservationData?.find((f) => f.key === key)?.value;
}

function getNameLines(value?: string): string[] {
  if (!value) return [];
  const normalized = value
    .replace(/\n/g, ',')
    .replace(/;/g, ',')
    .replace(/\r/g, ',');
  return normalized
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getPhotoUrls(order: Order): string[] {
  const raw = getReservationValue(order, 'photo');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
    }
  } catch {
    // Not JSON — treat as a single URL (legacy)
  }
  return [raw];
}

/** Set the `photo` reservation field, adding it when missing (first upload). */
function mergePhotoReservationValue(
  order: Order,
  value: string,
): Order['reservationData'] {
  const data = order.reservationData ?? [];
  const idx = data.findIndex((f) => f.key === 'photo');
  if (idx === -1) {
    const field: ReservationOrderField = {
      key: 'photo',
      label: { ar: 'الصورة', en: 'Photo' },
      type: 'picture',
      value,
    };
    return [...data, field];
  }
  return data.map((f, i) => (i === idx ? { ...f, value } : f));
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (ok) resolve();
    else reject(new Error('Copy failed'));
  });
}

function formatDateTime(date: string | Date | undefined, locale: string): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString(
    locale === 'ar' ? 'ar-SA' : 'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );
}

function relativeAge(value: string): { count: number; unit: 'm' | 'h' | 'd' } {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return { count: Math.max(minutes, 1), unit: 'm' };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { count: hours, unit: 'h' };
  return { count: Math.floor(hours / 24), unit: 'd' };
}

export default function BookingIntentPage() {
  const t = useTranslations('admin.bookingIntent');
  const te = useTranslations('execution');
  const locale = useLocale();
  const { user } = useAuth();
  const canSeeStats =
    user?.role === 'super_admin' ||
    (user?.allowedActions?.includes('achievements') ?? false);
  const tooltipPos = (locale === 'ar' ? 'right' : 'left') as
    | 'left'
    | 'right';
  const tooltipPosReversed = (locale === 'ar' ? 'left' : 'right') as
    | 'left'
    | 'right';

  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [intentionFilter, setIntentionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [referralFilter, setReferralFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState(() => getRelativeIsoDate(0));
  const [toDate, setToDate] = useState(() => getRelativeIsoDate(0));
  const [activeDatePreset, setActiveDatePreset] =
    useState<DateQuickPreset>('today');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(52);
  const [categories, setCategories] = useState<Category[]>([]);
  const [referrals, setReferrals] = useState<ReferralFilterItem[]>([]);

  const [data, setData] = useState<IntentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [achievementsAdmin, setAchievementsAdmin] = useState<{
    _id: string;
    name: string;
  } | null>(null);
  const [categoryOrders, setCategoryOrders] = useState<{
    admin: { _id: string; name: string };
    category: AdminStatsCategory;
  } | null>(null);

  const [photoPreviewOrder, setPhotoPreviewOrder] = useState<Order | null>(null);
  const [uploadingPhotoOrderId, setUploadingPhotoOrderId] = useState<string | null>(null);
  // Amount sort — null = default (newest first), then desc → asc cycles.
  const [amountSort, setAmountSort] = useState<'asc' | 'desc' | null>(null);
  const { confirm, modalProps } = useConfirmModal();

  // Shared order-action layer — same handlers the execution page uses
  // (whatsapp message builder, status change, execution date, history…).
  const {
    state: orderState,
    dispatch: orderDispatch,
    setChangeExecutionDateModalOpen,
    setChangingExecutionDateId,
    setOrderHistoryModalOpen,
    setOrderHistory,
    setLoadingOrderHistory,
    setBlockedUserIds,
    setBlockingOrderId,
    setAsyncAction,
    setEditOrderModalOpen,
    setEditingField,
    fetchOrderDetails,
    photoUploadOrderRef,
    photoInputRef,
    viewOrder,
    closeModal,
    handleChangeStatus,
    closeChangeStatusModal,
    updateOrderStatus,
    updateOrder,
    startOrderWhatsappMessage,
    copyOrderWhatsappNumber,
    copyOrderWhatsappMessage,
  } = useOrderPage({ namespace: 'execution', whatsappFollowUpOnly: true });

  const {
    selectedOrder,
    isModalOpen: orderModalOpen,
    loadingOrderDetails,
    isChangeStatusModalOpen,
    updatingStatus,
    isChangeExecutionDateModalOpen,
    changingExecutionDateId,
    isOrderHistoryModalOpen,
    orderHistory,
    loadingOrderHistory,
    isEditOrderModalOpen,
    editingField,
    savingOrderId,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    blockedUserIds,
    blockingOrderId,
    pendingBanOrder,
  } = orderState;

  // When an order is cancelled with "Scammer" reason, prompt admin to
  // ban the user — same flow as the execution page.
  useEffect(() => {
    if (!pendingBanOrder) return;
    const order = pendingBanOrder;
    orderDispatch({ type: 'SET_PENDING_BAN_ORDER', payload: null });

    if (blockedUserIds.has(order.userId || '')) return;

    (async () => {
      const confirmed = await confirm({
        title: te('banScammerTitle'),
        message: te('banScammerMessage'),
        type: 'danger',
        confirmText: te('blockCustomer'),
        cancelText: te('changeStatusModal.cancel'),
      });
      if (!confirmed || !order.userId) return;

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
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error || te('blockCustomerFailed'));
          return;
        }
        setBlockedUserIds(
          new Set([...Array.from(blockedUserIds), order.userId]),
        );
        toast.success(te('blockCustomerSuccess'));
      } catch {
        toast.error(te('blockCustomerFailed'));
      } finally {
        setBlockingOrderId(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingBanOrder]);

  // Debounce the search box so we don't hit the API per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchIntents = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams({
          status: statusTab,
          page: String(page),
          limit: String(pageSize),
        });
        if (sourceFilter !== 'all') params.set('source', sourceFilter);
        if (categoryFilter !== 'all')
          params.set('category', categoryFilter);
        if (intentionFilter !== 'all')
          params.set('intention', intentionFilter);
        if (countryFilter) params.set('country', countryFilter);
        if (referralFilter) params.set('referralId', referralFilter);
        if (search) params.set('search', search);
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);
        if (amountSort) {
          params.set('sortBy', 'amount');
          params.set('sortOrder', amountSort);
        }

        const res = await fetch(`/api/booking-intents?${params}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          toast.error(t('loadFailed'));
        }
      } catch {
        toast.error(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    },
    [statusTab, sourceFilter, categoryFilter, intentionFilter, countryFilter, referralFilter, search, fromDate, toDate, amountSort, page, pageSize, t],
  );

  // One query string shared by the stats fetch and the achievements
  // modal — both describe the SAME filtered row set the table shows.
  const statsQuery = useMemo(() => {
    const params = new URLSearchParams({ status: statusTab });
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (intentionFilter !== 'all')
      params.set('intention', intentionFilter);
    if (countryFilter) params.set('country', countryFilter);
    if (referralFilter) params.set('referralId', referralFilter);
    if (search) params.set('search', search);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    return params.toString();
  }, [statusTab, sourceFilter, categoryFilter, intentionFilter, countryFilter, referralFilter, search, fromDate, toDate]);

  const fetchStats = useCallback(async () => {
    if (!canSeeStats) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/booking-intents/stats?${statsQuery}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setStats(json.data.admins);
    } catch {
      // Stats are additive — failures don't block the page.
    } finally {
      setStatsLoading(false);
    }
  }, [canSeeStats, statsQuery]);

  useEffect(() => {
    void fetchIntents();
  }, [fetchIntents]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // Filter option sources — same endpoints the execution page uses.
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setCategories(data.data.categories);
      })
      .catch((err) => console.error('Error fetching categories:', err));
    fetch('/api/referrals?limit=100', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setReferrals(data.data.referrals);
      })
      .catch((err) => console.error('Error fetching referrals:', err));
  }, []);

  const applyDatePreset = (preset: DateQuickPreset) => {
    setActiveDatePreset(preset);
    setPage(1);
    if (preset === 'all' || preset === 'custom') {
      if (preset === 'all') {
        setFromDate('');
        setToDate('');
      }
      return;
    }
    const offsets: Record<string, [number, number]> = {
      today: [0, 0],
      yesterday: [-1, -1],
      last7Days: [-6, 0],
    };
    const [fromOffset, toOffset] = offsets[preset];
    setFromDate(getRelativeIsoDate(fromOffset));
    setToDate(getRelativeIsoDate(toOffset));
  };

  // Day arrows — same as execution: shift the single-day window ±1 and
  // re-resolve the matching quick preset.
  const shiftDay = (delta: number) => {
    if (!fromDate) return;
    const next = addDaysToIsoDate(fromDate, delta);
    setFromDate(next);
    setToDate(next);
    setPage(1);
    setActiveDatePreset(
      next === getRelativeIsoDate(0)
        ? 'today'
        : next === getRelativeIsoDate(-1)
          ? 'yesterday'
          : 'custom',
    );
  };

  const isMine = useCallback(
    (intent: BookingIntentRow) =>
      intent.assignedTo?.adminId === user?._id,
    [user?._id],
  );

  // ── Actions ────────────────────────────────────────────────────────
  // Same action set as the execution page. Clicking WhatsApp IS the
  // claim — the first admin who starts a conversation owns the intent.

  /** Patch a row in place — instant feedback, no list reshuffle. */
  const patchIntentRow = (
    intentId: string,
    patch: Partial<BookingIntentRow>,
    orderPatch?: Partial<Order>,
  ) =>
    setData((prev) =>
      prev
        ? {
          ...prev,
          intents: prev.intents.map((r) =>
            r._id === intentId
              ? {
                ...r,
                ...patch,
                order: orderPatch ? { ...r.order, ...orderPatch } : r.order,
              }
              : r,
          ),
        }
        : prev,
    );

  /** Claim the intent — the first WhatsApp click owns the customer. */
  const ensureClaimed = async (intent: BookingIntentRow) => {
    const res = await fetch(`/api/booking-intents/${intent._id}/claim`, {
      method: 'POST',
    });
    const json = await res.json();
    if (!json.success) {
      if (res.status === 409 && json.claimedBy?.name) {
        toast.error(t('claimedByOther', { name: json.claimedBy.name }));
      } else {
        toast.error(t('actionFailed'));
      }
      return false;
    }
    return true;
  };

  const handleIntentWhatsapp = async (intent: BookingIntentRow) => {
    try {
      setAsyncAction({ whatsappOrderId: intent.orderId });
      // Unclaimed intents are claimed by whoever clicks first.
      if (intent.status === 'new') {
        const claimed = await ensureClaimed(intent);
        if (!claimed) {
          void fetchIntents(true);
          void fetchStats();
          return;
        }
        patchIntentRow(intent._id, {
          status: 'contacted',
          assignedTo: {
            adminId: String(user?._id ?? ''),
            name: user?.name ?? '',
            email: user?.email ?? '',
          },
        });
      }
      await startOrderWhatsappMessage(intent.order);
      patchIntentRow(intent._id, {}, { isWhatsappButtonClicked: 'clicked' });
      void fetchStats();
    } finally {
      setAsyncAction({ whatsappOrderId: null });
    }
  };

  // Same field-edit flow as the execution page — pencil buttons in the
  // For / Items / Duaa cells open the shared EditOrderModal.
  const handleEditField = (order: Order, field: 'name' | 'items' | 'duaa') => {
    orderDispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    setEditingField(field);
    setEditOrderModalOpen(true);
  };

  const closeEditOrderModal = () => {
    setEditOrderModalOpen(false);
    setEditingField(null);
  };

  const handleUpdateOrder = async (
    orderId: string,
    fields: Parameters<typeof updateOrder>[1],
  ) => {
    const ok = await updateOrder(orderId, fields);
    if (ok) {
      // Refresh the row's embedded order in place so the table shows the
      // edit without reshuffling.
      const fullOrder = await fetchOrderDetails(orderId, false);
      const intentRow = data?.intents.find((r) => r.orderId === orderId);
      if (intentRow && fullOrder) {
        patchIntentRow(intentRow._id, {}, fullOrder);
      }
      void fetchIntents(true);
    }
    return ok;
  };

  // ── Photo edit — same as the execution page: upload via the cell
  // button, delete/replace single photos from the gallery modal. ──
  const handleUploadPhoto = (order: Order) => {
    photoUploadOrderRef.current = order;
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const order = photoUploadOrderRef.current;
    if (!order) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const existingUrls = getPhotoUrls(order);

    if (existingUrls.length >= 4) {
      toast.error(te('editOrder.maxPhotosReached') || 'Maximum 4 images allowed');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    const remainingSlots = 4 - existingUrls.length;
    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(te('editOrder.maxPhotosReached') || `Only ${remainingSlots} image(s) can be uploaded`);
    }

    for (const file of selectedFiles) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(te('editOrder.invalidImage'));
        if (photoInputRef.current) photoInputRef.current.value = '';
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(te('editOrder.imageTooLarge'));
        if (photoInputRef.current) photoInputRef.current.value = '';
        return;
      }
    }

    try {
      setUploadingPhotoOrderId(order._id);
      const newUrls = await Promise.all(
        selectedFiles.map((file) => uploadImageToR2(file)),
      );
      const updatedUrls = [...existingUrls, ...newUrls];
      await updateOrder(order._id, { photo: JSON.stringify(updatedUrls) });
      const intentRow = data?.intents.find((r) => r.orderId === order._id);
      if (intentRow) {
        patchIntentRow(intentRow._id, {}, {
          reservationData: mergePhotoReservationValue(order, JSON.stringify(updatedUrls)),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : te('editOrder.uploadFailed');
      toast.error(message);
      console.error('Photo upload failed:', error);
    } finally {
      photoUploadOrderRef.current = null;
      setUploadingPhotoOrderId(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Remove one photo — optimistic on the open modal + intent row, then
  // persist and delete the file from R2 in the background.
  const handleDeletePhoto = async (order: Order, urlToDelete: string) => {
    const existingUrls = getPhotoUrls(order);
    const updatedUrls = existingUrls.filter((u) => u !== urlToDelete);
    const newValue = updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : '';
    const updatedReservationData = mergePhotoReservationValue(order, newValue);

    const updatedOrder: Order = { ...order, reservationData: updatedReservationData };
    setPhotoPreviewOrder(updatedOrder);
    patchIntentRow(order._id, {}, { reservationData: updatedReservationData });
    if (updatedUrls.length === 0) setPhotoPreviewOrder(null);

    try {
      await updateOrder(order._id, { photo: newValue });
    } catch (error) {
      console.error('Failed to persist photo deletion:', error);
      setPhotoPreviewOrder(order);
      patchIntentRow(order._id, {}, { reservationData: order.reservationData });
    }

    deleteOldImage(urlToDelete).catch((err: unknown) => {
      console.warn('Failed to delete image from R2:', err);
    });
  };

  // Replace one photo — upload the new file, swap the URL, delete the
  // old one from R2.
  const handleReplacePhoto = async (order: Order, oldUrl: string, file: File) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(te('editOrder.invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(te('editOrder.imageTooLarge'));
      return;
    }

    const existingUrls = getPhotoUrls(order);
    const newUrl = await uploadImageToR2(file);
    const updatedUrls = existingUrls.map((u) => (u === oldUrl ? newUrl : u));
    const updatedReservationData = mergePhotoReservationValue(
      order,
      JSON.stringify(updatedUrls),
    );

    const updatedOrder: Order = { ...order, reservationData: updatedReservationData };
    setPhotoPreviewOrder(updatedOrder);
    patchIntentRow(order._id, {}, { reservationData: updatedReservationData });

    try {
      await updateOrder(order._id, { photo: JSON.stringify(updatedUrls) });
    } catch (error) {
      console.error('Failed to persist photo replacement:', error);
      setPhotoPreviewOrder(order);
      patchIntentRow(order._id, {}, { reservationData: order.reservationData });
    }

    deleteOldImage(oldUrl).catch((err: unknown) => {
      console.warn('Failed to delete old image from R2:', err);
    });
  };

  const handleChangeExecutionDate = (order: Order) => {
    orderDispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    setChangeExecutionDateModalOpen(true);
  };

  const closeChangeExecutionDateModal = () => {
    setChangeExecutionDateModalOpen(false);
    setChangingExecutionDateId(null);
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
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || 'Failed to update execution date');
      }
      toast.success(te('changeExecutionDate.success'));
      const nextReservationData = selectedOrder.reservationData?.map((f) =>
        f.key === 'executionDate' ? { ...f, value: date } : f,
      ) ?? [];
      orderDispatch({
        type: 'UPDATE_ORDER_RESERVATION_DATA',
        payload: { orderId: selectedOrder._id, reservationData: nextReservationData },
      });
      const row = data?.intents.find((r) => r.orderId === selectedOrder._id);
      if (row) {
        patchIntentRow(row._id, {}, { reservationData: nextReservationData });
      }
    } catch {
      toast.error(te('changeExecutionDate.failed'));
    } finally {
      setChangingExecutionDateId(null);
      closeChangeExecutionDateModal();
    }
  };

  const handleViewHistory = async (order: Order) => {
    orderDispatch({ type: 'SET_SELECTED_ORDER', payload: order });
    setOrderHistoryModalOpen(true);
    setLoadingOrderHistory(true);
    setOrderHistory([], false);
    try {
      const res = await fetch(`/api/orders/${order._id}/history`);
      const json = await res.json();
      if (json.success) {
        setOrderHistory(json.data || [], false);
      } else {
        toast.error(json.error || te('orderHistory.loadFailed'));
      }
    } catch {
      toast.error(te('orderHistory.loadFailed'));
    } finally {
      setLoadingOrderHistory(false);
    }
  };

  const closeOrderHistoryModal = () => {
    setOrderHistoryModalOpen(false);
    setOrderHistory([], false);
  };

  const handleBlockCustomer = async (order: Order) => {
    if (order.isGuest || !order.userId || !order.source) {
      toast.error(te('blockCustomerGuest'));
      return;
    }

    const isCurrentlyBanned = blockedUserIds.has(order.userId);
    const confirmed = await confirm({
      title: isCurrentlyBanned ? te('unblockCustomer') : te('blockCustomer'),
      message: isCurrentlyBanned
        ? te('unblockCustomerConfirm')
        : te('blockCustomerConfirm'),
      type: isCurrentlyBanned ? 'info' : 'danger',
      confirmText: isCurrentlyBanned
        ? te('unblockCustomer')
        : te('blockCustomer'),
      cancelText: te('changeStatusModal.cancel'),
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
      const json = await res.json();
      if (!json.success) {
        toast.error(
          json.error ||
          (isCurrentlyBanned
            ? te('unblockCustomerFailed')
            : te('blockCustomerFailed')),
        );
        return;
      }
      setBlockedUserIds(
        new Set(
          isCurrentlyBanned
            ? Array.from(blockedUserIds).filter((id) => id !== order.userId)
            : [...Array.from(blockedUserIds), order.userId],
        ),
      );
      toast.success(
        isCurrentlyBanned
          ? te('unblockCustomerSuccess')
          : te('blockCustomerSuccess'),
      );
    } catch {
      toast.error(
        isCurrentlyBanned
          ? te('unblockCustomerFailed')
          : te('blockCustomerFailed'),
      );
    } finally {
      setBlockingOrderId(null);
    }
  };

  const getCurrentExecutionDate = () => {
    if (!selectedOrder) return '';
    const value = selectedOrder.reservationData?.find(
      (f) => f.key === 'executionDate',
    )?.value;
    return value ? value.substring(0, 10) : '';
  };

  // A paid-like status change flips the talking achievement to paid
  // (→ 'converted' row) — patch in place first, then refetch so the
  // list reconciles (paid rows drop out) without a visual jump.
  const handleUpdateOrderStatus = async (
    status: OrderStatus,
    cancellationReason?: string,
    isScammer?: boolean,
  ) => {
    const success = await updateOrderStatus(status, cancellationReason, isScammer);
    if (success) {
      const row = data?.intents.find((r) => r.orderId === selectedOrder?._id);
      if (row) {
        const nextStatus = ['paid', 'partial-paid', 'completed'].includes(
          status,
        )
          ? 'converted'
          : row.status;
        patchIntentRow(row._id, { status: nextStatus }, { status });
      }
      void fetchIntents(true);
      void fetchStats();
    }
  };

  // ── Filter option lists ────────────────────────────────────────────

  const tabOptions = useMemo(() => {
    const counts = data?.statusCounts;
    const label = (key: StatusTab) =>
      counts ? `${t(`status.${key}`)} (${counts[key] ?? 0})` : t(`status.${key}`);
    const base =
      'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground';
    const active = 'bg-foreground text-background shadow-sm';
    return [
      { value: 'all' as const, label: label('all'), className: base, activeClassName: active },
      { value: 'new' as const, label: label('new'), className: base, activeClassName: active },
      { value: 'contacted' as const, label: label('contacted'), className: base, activeClassName: active },
      { value: 'converted' as const, label: label('converted'), className: base, activeClassName: active },
    ];
  }, [data?.statusCounts, t]);

  const sourceOptions = useMemo(
    () => [
      { label: t('filters.sourceAll'), value: 'all' },
      { label: 'Manasik', value: 'manasik' },
      { label: 'Ghadaq', value: 'ghadaq' },
    ],
    [t],
  );

  const intentionOptions = useMemo(() => {
    const preset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'intention');
    return [
      { label: t('filters.allIntentions'), value: 'all' },
      ...(preset?.options?.map((option) => ({
        label: locale === 'ar' ? option.ar : option.en,
        value: locale === 'ar' ? option.ar : option.en,
      })) ?? []),
    ];
  }, [locale, t]);

  const categoryTabOptions = useMemo(() => {
    const base =
      'border border-stroke text-foreground/80 hover:bg-background hover:text-foreground';
    const active = 'bg-foreground text-background shadow-sm';
    return [
      { label: t('filters.allCategories'), value: 'all', className: base, activeClassName: active },
      ...categories.map((cat) => ({
        label: cat.name,
        value: cat._id,
        className: base,
        activeClassName: active,
      })),
    ];
  }, [categories, t]);

  const datePresetOptions = useMemo(
    () =>
      (
        [
          'dateModeAll',
          'today',
          'yesterday',
          'last7Days',
        ] as const
      ).map((key) => ({
        label: t(`filters.${key}`),
        value: (key === 'dateModeAll' ? 'all' : key) as DateQuickPreset,
      })),
    [t],
  );

  // Amount sort cycles: default (newest) → desc → asc → default.
  const cycleAmountSort = () => {
    setAmountSort((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : null));
    setPage(1);
  };

  // ── Table columns ──────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        header: '#',
        accessor: (_row: BookingIntentRow, index?: number) => (
          <span className="text-sm font-semibold text-foreground">
            {(page - 1) * pageSize + (index ?? 0) + 1}
          </span>
        ),
        className: 'w-12',
      },
      {
        header: te('table.sacrificeFor'),
        accessor: (row: BookingIntentRow) => {
          const order = row.order;
          const names = getNameLines(
            getReservationValue(order, 'sacrificeFor'),
          );
          const intentState = intentVisualState(row.status);
          const IntentIcon = INTENT_STATE_ICON[intentState];
          const age = relativeAge(row.orderCreatedAt);
          return (
            <div className="flex items-center gap-3 min-w-48">
              <Tooltip
                position={tooltipPosReversed}
                content={t(`intentState.${intentState}`)}
              >
                <span
                  className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${INTENT_STATE_BG[intentState]}`}
                >
                  <IntentIcon size={18} />
                </span>
              </Tooltip>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium leading-snug text-foreground">
                    {names[0] || '-'}
                  </span>
                  {names.length > 0 && (
                    <Tooltip position={tooltipPos} content={te('table.copyName')}>
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyToClipboard(names.join(', '))
                            .then(() => toast.success(te('table.copied')))
                            .catch(() => toast.error('Copy failed'));
                        }}
                        aria-label={te('table.copyName')}
                      >
                        <LuCopy size={12} />
                      </Button>
                    </Tooltip>
                  )}
                  <Tooltip position={tooltipPos} content={te('table.editName')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditField(order, 'name');
                      }}
                      aria-label={te('table.editName')}
                    >
                      <LuPencil size={12} />
                    </Button>
                  </Tooltip>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold whitespace-nowrap text-sm text-foreground">
                      {order.orderNumber}
                    </span>
                    <Tooltip
                      position={tooltipPos}
                      content={te('table.copyOrderNumber')}
                    >
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          void copyToClipboard(order.orderNumber)
                            .then(() => toast.success(te('table.copied')))
                            .catch(() => toast.error('Copy failed'));
                        }}
                        aria-label={te('table.copyOrderNumber')}
                      >
                        <LuCopy size={12} />
                      </Button>
                    </Tooltip>
                  </div>
                  <span className="text-xs text-secondary whitespace-nowrap">
                    {formatDateTime(row.orderCreatedAt, locale)}
                    {' · '}
                    {t(`age.${age.unit}`, { count: age.count })}
                  </span>
                  <span
                    className={`mt-0.5 inline-flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.paymentAttemptCount > 0
                      ? 'bg-warning/15 text-warning'
                      : 'bg-background text-secondary'
                      }`}
                  >
                    <LuCreditCard size={11} />
                    {t('attempts', { count: row.paymentAttemptCount })}
                  </span>
                </div>
              </div>
            </div>
          );
        },
        className: 'min-w-48',
      },
      {
        header: te('table.items'),
        accessor: (row: BookingIntentRow) => {
          const order = row.order;
          const items = order.items || [];
          if (items.length === 0)
            return <span className="text-secondary">-</span>;
          const itemTexts = items.map((item) => {
            const qty = item.quantity || 1;
            const name = getOrderItemDisplayName(item, locale);
            return qty > 1 ? `${qty} ${name}` : name || '';
          });
          return (
            <div className="flex flex-col gap-1 min-w-52">
              {items.map((item, i) => {
                const qty = item.quantity || 1;
                const name = getOrderItemDisplayName(item, locale);
                return (
                  <span
                    key={i}
                    className="text-sm font-medium text-foreground"
                  >
                    {qty > 1 ? `${qty} ${name}` : name}
                  </span>
                );
              })}
              <div className="flex flex-row gap-1 self-start">
                <Tooltip position={tooltipPos} content={te('table.copyItems')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyToClipboard(itemTexts.join('\n'))
                        .then(() => toast.success(te('table.copied')))
                        .catch(() => toast.error('Copy failed'));
                    }}
                    aria-label={te('table.copyItems')}
                  >
                    <LuCopy size={12} />
                  </Button>
                </Tooltip>
                <Tooltip position={tooltipPos} content={te('table.editItems')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditField(order, 'items');
                    }}
                    aria-label={te('table.editItems')}
                  >
                    <LuPencil size={12} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        },
      },
      {
        header: te('table.photo'),
        accessor: (row: BookingIntentRow) => {
          const order = row.order;
          const photoUrls = getPhotoUrls(order);
          const photoUrl = photoUrls[0] || '';
          const hasPhoto = photoUrls.length > 0;
          const iconColor = hasPhoto ? 'text-primary' : 'text-secondary/50';
          return (
            <div className="flex flex-col items-center gap-1">
              {hasPhoto ? (
                <Tooltip
                  position={tooltipPos}
                  content={
                    photoUrls.length > 1
                      ? `${te('table.viewPhoto')} (${photoUrls.length})`
                      : te('table.viewPhoto')
                  }
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPhotoPreviewOrder(order);
                    }}
                    className={`inline-flex items-center justify-center p-2 relative ${iconColor}`}
                    aria-label={te('table.viewPhoto')}
                  >
                    <LuImage size={24} />
                    {photoUrls.length > 1 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-primary-text text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                        {photoUrls.length}
                      </span>
                    )}
                  </button>
                </Tooltip>
              ) : (
                <span
                  className={`inline-flex items-center justify-center p-2 ${iconColor}`}
                >
                  <LuImage size={24} />
                </span>
              )}
              <div className="flex flex-row gap-1">
                <Tooltip
                  position={tooltipPos}
                  content={
                    photoUrls.length >= 4
                      ? te('table.maxPhotosReached') || 'Maximum 4 images'
                      : te('table.uploadPhoto')
                  }
                >
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUploadPhoto(order);
                    }}
                    disabled={
                      uploadingPhotoOrderId === order._id ||
                      photoUrls.length >= 4
                    }
                    aria-label={te('table.uploadPhoto')}
                  >
                    {uploadingPhotoOrderId === order._id ? (
                      <LuRefreshCw size={12} className="animate-spin" />
                    ) : (
                      <LuUpload size={12} />
                    )}
                  </Button>
                </Tooltip>
                <Tooltip
                  position={tooltipPos}
                  content={te('table.downloadPhoto')}
                >
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (photoUrl) {
                        void downloadFile(photoUrl, `photo-${order.orderNumber}`)
                          .then(() => toast.success(te('table.downloaded')))
                          .catch(() => toast.error(te('messages.downloadFailed')));
                      }
                    }}
                    disabled={!hasPhoto}
                    aria-label={te('table.downloadPhoto')}
                  >
                    <LuDownload size={12} />
                  </Button>
                </Tooltip>
                <Tooltip position={tooltipPos} content={te('table.sharePhoto')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (photoUrl) {
                        void copyToClipboard(photoUrl)
                          .then(() => toast.success(te('table.copied')))
                          .catch(() => toast.error('Copy failed'));
                      }
                    }}
                    disabled={!hasPhoto}
                    aria-label={te('table.sharePhoto')}
                  >
                    <LuShare2 size={12} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        },
        className: 'min-w-20',
      },
      {
        header: te('table.shortDuaa'),
        accessor: (row: BookingIntentRow) => {
          const duaa = getReservationValue(row.order, 'shortDuaa');
          const hasDuaa = Boolean(duaa);
          const iconColor = hasDuaa ? 'text-primary' : 'text-secondary';
          return (
            <div className="flex flex-col items-center gap-1">
              <span
                className={`inline-flex items-center justify-center p-2 ${iconColor}`}
              >
                <LuHandHelping size={24} />
              </span>
              <div className="flex flex-row gap-1">
                <Tooltip position={tooltipPos} content={te('table.copyDuaa')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (duaa) {
                        void copyToClipboard(duaa)
                          .then(() => toast.success(te('table.copied')))
                          .catch(() => toast.error('Copy failed'));
                      }
                    }}
                    disabled={!hasDuaa}
                    aria-label={te('table.copyDuaa')}
                  >
                    <LuCopy size={12} />
                  </Button>
                </Tooltip>
                <Tooltip position={tooltipPos} content={te('table.editDuaa')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditField(row.order, 'duaa');
                    }}
                    aria-label={te('table.editDuaa')}
                  >
                    <LuPencil size={12} />
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        },
        className: 'min-w-16',
      },
      {
        header: (
          <button
            type="button"
            onClick={cycleAmountSort}
            className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            aria-label={t('colAmount')}
          >
            {t('colAmount')}
            {amountSort === 'desc' ? (
              <LuArrowDown size={13} className="text-primary" />
            ) : amountSort === 'asc' ? (
              <LuArrowUp size={13} className="text-primary" />
            ) : (
              <LuArrowUpDown size={13} className="text-secondary/60" />
            )}
          </button>
        ),
        accessor: (row: BookingIntentRow) => (
          <span className="font-bold text-foreground" dir="ltr">
            {row.amount.toFixed(2)} {row.currency}
          </span>
        ),
        className: 'min-w-24',
      },
      {
        header: t('colActions'),
        accessor: (row: BookingIntentRow) => {
          const order = row.order;
          const spinner = (
            <LuRefreshCw size={16} className="animate-spin" />
          );

          // The intent is owned by another admin — their conversation,
          // so the WhatsApp button (which would claim it) stays hidden.
          const ownedByOther =
            row.status === 'contacted' &&
            Boolean(row.assignedTo) &&
            !isMine(row) &&
            user?.role !== 'super_admin';

          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <Tooltip position={tooltipPos} content={te('table.copyPhone')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyOrderWhatsappNumber(order);
                    }}
                    disabled={copyingPhoneOrderId === order._id}
                    aria-label={te('table.copyPhone')}
                  >
                    {copyingPhoneOrderId === order._id
                      ? spinner
                      : <LuPhone size={16} />}
                  </Button>
                </Tooltip>

                <Tooltip position={tooltipPos} content={te('table.copyMessage')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      void copyOrderWhatsappMessage(order);
                    }}
                    disabled={copyingMessageOrderId === order._id}
                    aria-label={te('table.copyMessage')}
                  >
                    {copyingMessageOrderId === order._id
                      ? spinner
                      : <LuCopy size={16} />}
                  </Button>
                </Tooltip>

                {!ownedByOther && (
                  <Tooltip position={tooltipPos} content={te('table.whatsapp')}>
                    <Button
                      variant="icon-primary"
                      size="custom"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleIntentWhatsapp(row);
                      }}
                      disabled={whatsappOrderId === order._id}
                      aria-label={te('table.whatsapp')}
                    >
                      {whatsappOrderId === order._id
                        ? spinner
                        : <FaWhatsapp size={16} />}
                    </Button>
                  </Tooltip>
                )}

                {order.userId && blockedUserIds.has(order.userId) ? (
                  <Tooltip position={tooltipPos} content={te('table.unblockCustomer')}>
                    <Button
                      variant="icon-danger"
                      size="custom"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleBlockCustomer(order);
                      }}
                      disabled={blockingOrderId === order._id}
                      aria-label={te('table.unblockCustomer')}
                    >
                      {blockingOrderId === order._id
                        ? spinner
                        : <LuBan size={16} />}
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip position={tooltipPos} content={te('table.blockCustomer')}>
                    <Button
                      variant="icon-primary"
                      size="custom"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleBlockCustomer(order);
                      }}
                      disabled={
                        blockingOrderId === order._id ||
                        order.isGuest ||
                        !order.userId
                      }
                      aria-label={te('table.blockCustomer')}
                    >
                      {blockingOrderId === order._id
                        ? spinner
                        : <LuBan size={16} />}
                    </Button>
                  </Tooltip>
                )}
              </div>

              <div className="flex flex-row gap-2">
                <Tooltip position={tooltipPos} content={te('table.viewDetails')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      void viewOrder(order);
                    }}
                    aria-label={te('table.viewDetails')}
                  >
                    <LuEye size={16} />
                  </Button>
                </Tooltip>

                <Tooltip position={tooltipPos} content={te('table.changeExecutionDate')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeExecutionDate(order);
                    }}
                    aria-label={te('table.changeExecutionDate')}
                  >
                    <LuCalendar size={16} />
                  </Button>
                </Tooltip>

                <Tooltip position={tooltipPos} content={te('table.changeStatus')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeStatus(order);
                    }}
                    aria-label={te('table.changeStatus')}
                  >
                    <LuPenLine size={16} />
                  </Button>
                </Tooltip>

                <Tooltip position={tooltipPos} content={te('table.orderHistory')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleViewHistory(order);
                    }}
                    aria-label={te('table.orderHistory')}
                  >
                    <LuHistory size={16} />
                  </Button>
                </Tooltip>

              </div>
            </div>
          );
        },
        className: 'min-w-56',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, te, locale, tooltipPos, isMine, data, user?.role, page, pageSize, amountSort, whatsappOrderId, copyingPhoneOrderId, copyingMessageOrderId, blockedUserIds, blockingOrderId],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">
            {t('description', {
              minutes: data?.displayDelayMinutes ?? 60,
            })}
          </p>
        </div>
        <Button
          variant="icon-primary"
          size="custom"
          onClick={() => {
            void fetchIntents();
            void fetchStats();
          }}
        >
          <LuRefreshCw size={18} />
        </Button>
      </div>

      {/* Filters — same set as the execution page */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <LuSearch
              size={16}
              className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
            />
            <input
              type="text"
              placeholder={t('filters.search')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
            />
          </div>
          <Dropdown
            value={sourceFilter}
            options={sourceOptions}
            onChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.source')}
            className="w-full sm:w-36"
          />
          <Dropdown
            value={intentionFilter}
            options={intentionOptions}
            onChange={(v) => {
              setIntentionFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.intention')}
            className="w-full sm:w-40"
          />
          <CountrySelector
            value={countryFilter}
            onChange={(v) => {
              setCountryFilter(v);
              setPage(1);
            }}
            placeholder={t('filters.country')}
            allowClear
            clearLabel={t('filters.allCountries')}
            className="w-full sm:w-48"
          />
        </div>

        <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomDatePicker
              value={fromDate}
              onChange={(v) => {
                setFromDate(v);
                setActiveDatePreset('custom');
                setPage(1);
              }}
              locale={locale}
              label={t('filters.fromDate')}
              placeholder={t('filters.fromDate')}
            />
            <CustomDatePicker
              value={toDate}
              onChange={(v) => {
                setToDate(v);
                setActiveDatePreset('custom');
                setPage(1);
              }}
              locale={locale}
              label={t('filters.toDate')}
              placeholder={t('filters.toDate')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {datePresetOptions.map((preset) => (
              <Button
                key={preset.value}
                variant="custom"
                type="button"
                size="custom"
                onClick={() => applyDatePreset(preset.value)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${activeDatePreset === preset.value
                  ? 'bg-foreground border-foreground text-background shadow-sm'
                  : 'bg-background border-stroke text-foreground hover:bg-foreground/5'
                  }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <ReferralFilter
          value={referralFilter}
          onChange={(v) => {
            setReferralFilter(v);
            setPage(1);
          }}
          referrals={referrals}
          allLabel={t('filters.allReferrals')}
        />

        <div className="overflow-x-auto pb-1">
          <Tabs<string>
            value={categoryFilter}
            options={categoryTabOptions}
            onChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
            className="min-w-max"
          />
        </div>

        <div className="overflow-x-auto pb-1">
          <Tabs<StatusTab>
            value={statusTab}
            options={tabOptions}
            onChange={(v) => {
              setStatusTab(v);
              setPage(1);
            }}
            className="min-w-max"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-secondary">
          <span>
            {t('filters.total')}: {data?.pagination.totalIntents ?? 0}
          </span>
        </div>
      </div>

      {fromDate && (
        <ExecutionTitle
          date={fromDate}
          locale={locale}
          label={t('title')}
          onPrevDay={() => shiftDay(-1)}
          onNextDay={() => shiftDay(1)}
        />
      )}

      {/* Table */}
      <Table<BookingIntentRow>
        columns={columns}
        data={data?.intents ?? []}
        loading={loading}
        emptyMessage={t('empty')}
        onRowClick={(row) => void viewOrder(row.order)}
      />

      <Pagination
        currentPage={data?.pagination.currentPage ?? page}
        totalPages={data?.pagination.totalPages ?? 1}
        onPageChange={setPage}
        hasNextPage={data?.pagination.hasNextPage}
        hasPrevPage={data?.pagination.hasPrevPage}
        pageSize={pageSize}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* Stats strip — customers permission only */}
      {canSeeStats && (
        <div className="bg-card-bg border border-stroke rounded-site p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LuTrophy size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{t('stats.title')}</h2>
              <p className="text-sm text-secondary">{t('stats.hint')}</p>
            </div>
          </div>
          {statsLoading && !stats ? (
            <p className="text-sm text-secondary">{t('loading')}</p>
          ) : !stats || stats.length === 0 ? (
            <p className="text-sm text-secondary">{t('stats.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-stroke">
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.admin')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.claimed')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.contacted')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.converted')}
                    </th>
                    <th className="text-start px-3 py-2 text-sm font-semibold">
                      {t('stats.rate')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stroke">
                  {stats.map((row) => (
                    <tr
                      key={row.adminId}
                      onClick={() =>
                        setAchievementsAdmin({
                          _id: row.adminId,
                          name: row.name || row.email,
                        })
                      }
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-sm font-medium text-foreground">
                        {row.name || row.email}
                      </td>
                      <td className="px-3 py-2 text-sm">{row.claimed}</td>
                      <td className="px-3 py-2 text-sm">
                        {row.contacted}
                      </td>
                      <td className="px-3 py-2 text-sm text-success">
                        {row.converted}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {row.conversionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Per-admin achievement cards — separate component under the
          stats table, gated by the same `achievements` permission. */}
      {canSeeStats && (
        <AdminAchievementCards
          stats={stats}
          onOpenAdmin={(admin) => setAchievementsAdmin(admin)}
          onCategoryClick={(admin, category) =>
            setCategoryOrders({ admin, category })
          }
        />
      )}

      {/* Category orders modal — orders this admin owns in the clicked
          category, under the same filters */}
      <AdminCategoryOrdersModal
        isOpen={categoryOrders !== null}
        onClose={() => setCategoryOrders(null)}
        admin={categoryOrders?.admin ?? null}
        category={categoryOrders?.category ?? null}
        query={statsQuery}
      />

      {/* Per-admin achievements — click a stats row to open */}
      <AdminAchievementsModal
        isOpen={achievementsAdmin !== null}
        onClose={() => setAchievementsAdmin(null)}
        admin={achievementsAdmin}
        query={statsQuery}
      />

      {/* Photo gallery lightbox — same as the execution page */}
      <OrderGalleryModal
        key={`photo-${photoPreviewOrder?._id ?? 'closed'}`}
        order={photoPreviewOrder}
        mode="photo"
        onClose={() => setPhotoPreviewOrder(null)}
        onDeletePhoto={
          photoPreviewOrder
            ? (url) => handleDeletePhoto(photoPreviewOrder, url)
            : undefined
        }
        onReplacePhoto={
          photoPreviewOrder
            ? (oldUrl, file) =>
              handleReplacePhoto(photoPreviewOrder, oldUrl, file)
            : undefined
        }
      />

      {/* Order details — the order that put this customer on the page */}
      <OrderDetailModal
        isOpen={orderModalOpen}
        onClose={closeModal}
        order={selectedOrder}
        loadingDetails={loadingOrderDetails}
      />

      {/* Same modals as the execution page */}
      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        onClose={closeChangeStatusModal}
        currentStatus={selectedOrder?.status || 'paid'}
        onUpdateStatus={handleUpdateOrderStatus}
        updating={updatingStatus}
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
        onUpdate={handleUpdateOrder}
        updating={savingOrderId !== null}
      />

      <OrderHistoryModal
        isOpen={isOrderHistoryModalOpen}
        onClose={closeOrderHistoryModal}
        orderNumber={selectedOrder?.orderNumber || ''}
        history={orderHistory as OrderHistoryEntry[]}
        loading={loadingOrderHistory}
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
    </div>
  );
}
