'use client';

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import { Order, OrderStatus } from '@/types/Order';
import { OrderStatsData } from '../components/order-stats';
import { copyToClipboard, normalizeWhatsappPhone } from './order-utils';
import {
  buildOrderWhatsappMessageFromOrder,
  buildProcessingOrderWhatsappFollowUpMessage,
} from '@/lib/order-whatsapp';

export interface OrderPageState {
  // Data
  orders: Order[];
  totalOrders: number;
  totalPages: number;

  // Pagination
  page: number;
  pageSize: number | 'all';

  // Filters
  statusFilter: string;
  fromDateFilter: string;
  toDateFilter: string;
  sourceFilter: string;
  referralFilter: string;
  searchInput: string;
  searchQuery: string;
  whatsappFilter?: string;
  categoryFilter?: string;
  intentionFilter?: string;
  countryFilter?: string;

  // Loading
  loading: boolean;
  loadingStats: boolean;

  // Stats
  stats: OrderStatsData | null;

  // Selection
  selectedOrderIds: string[];
  bulkValue: string;
  bulkUpdating: boolean;

  // Common modals
  selectedOrder: Order | null;
  isModalOpen: boolean;
  loadingOrderDetails: boolean;
  isChangeStatusModalOpen: boolean;
  updatingStatus: boolean;

  // Execution-specific modals
  isChangeExecutionDateModalOpen: boolean;
  changingExecutionDateId: string | null;
  isEditOrderModalOpen: boolean;
  editingField: 'name' | 'items' | 'duaa' | null;
  savingOrderId: string | null;
  isOrderHistoryModalOpen: boolean;
  orderHistory: unknown[];
  loadingOrderHistory: boolean;

  // Orders-specific
  blockedUserIds: Set<string>;
  blockingOrderId: string | null;
  pendingBanOrder: Order | null;

  // Async action tracking
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
}

export const initialOrderPageState: OrderPageState = {
  orders: [],
  totalOrders: 0,
  totalPages: 1,
  page: 1,
  pageSize: 50,
  statusFilter: 'all',
  fromDateFilter: '',
  toDateFilter: '',
  sourceFilter: '',
  referralFilter: '',
  searchInput: '',
  searchQuery: '',
  whatsappFilter: 'all',
  categoryFilter: 'all',
  intentionFilter: 'all',
  countryFilter: '',
  loading: false,
  loadingStats: false,
  stats: null,
  selectedOrderIds: [],
  bulkValue: '',
  bulkUpdating: false,
  selectedOrder: null,
  isModalOpen: false,
  loadingOrderDetails: false,
  isChangeStatusModalOpen: false,
  updatingStatus: false,
  isChangeExecutionDateModalOpen: false,
  changingExecutionDateId: null,
  isEditOrderModalOpen: false,
  editingField: null,
  savingOrderId: null,
  isOrderHistoryModalOpen: false,
  orderHistory: [],
  loadingOrderHistory: false,
  blockedUserIds: new Set(),
  blockingOrderId: null,
  pendingBanOrder: null,
  whatsappOrderId: null,
  copyingPhoneOrderId: null,
  copyingMessageOrderId: null,
};

export type FilterPayload = Partial<
  Pick<
    OrderPageState,
    | 'statusFilter'
    | 'fromDateFilter'
    | 'toDateFilter'
    | 'sourceFilter'
    | 'referralFilter'
    | 'searchInput'
    | 'searchQuery'
    | 'whatsappFilter'
    | 'categoryFilter'
    | 'intentionFilter'
    | 'countryFilter'
    | 'pageSize'
  >
>;

export type OrderPageAction =
  | { type: 'SET_ORDERS'; payload: { orders: Order[]; totalOrders: number; totalPages: number } }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_PAGE_SIZE'; payload: number | 'all' }
  | { type: 'SET_FILTER'; payload: FilterPayload }
  | { type: 'SET_DATE_RANGE'; payload: { fromDateFilter: string; toDateFilter: string } }
  | { type: 'RESET_PAGE' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STATS'; payload: OrderStatsData | null }
  | { type: 'SET_LOADING_STATS'; payload: boolean }
  | { type: 'TOGGLE_ORDER_SELECTION'; payload: string }
  | { type: 'TOGGLE_SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_BULK_VALUE'; payload: string }
  | { type: 'SET_BULK_UPDATING'; payload: boolean }
  | { type: 'SET_SELECTED_ORDER'; payload: Order | null }
  | { type: 'SET_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_LOADING_ORDER_DETAILS'; payload: boolean }
  | { type: 'SET_CHANGE_STATUS_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_UPDATING_STATUS'; payload: boolean }
  | { type: 'SET_CHANGE_EXECUTION_DATE_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_CHANGING_EXECUTION_DATE_ID'; payload: string | null }
  | { type: 'SET_EDIT_ORDER_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_EDITING_FIELD'; payload: 'name' | 'items' | 'duaa' | null }
  | { type: 'SET_SAVING_ORDER_ID'; payload: string | null }
  | { type: 'SET_ORDER_HISTORY_MODAL_OPEN'; payload: boolean }
  | { type: 'SET_ORDER_HISTORY'; payload: { history: unknown[]; loading: boolean } }
  | { type: 'SET_LOADING_ORDER_HISTORY'; payload: boolean }
  | { type: 'SET_BLOCKED_USER_IDS'; payload: Set<string> }
  | { type: 'SET_BLOCKING_ORDER_ID'; payload: string | null }
  | { type: 'SET_ASYNC_ACTION'; payload: Partial<Pick<OrderPageState, 'whatsappOrderId' | 'copyingPhoneOrderId' | 'copyingMessageOrderId'>> }
  | { type: 'UPDATE_ORDER_IN_LIST'; payload: { orderId: string; updates: Partial<Order> } }
  | { type: 'UPDATE_ORDER_RESERVATION_DATA'; payload: { orderId: string; reservationData: Order['reservationData'] } }
  | { type: 'SET_ORDERS_ITEMS'; payload: { orderId: string; items: Order['items'] } }
  | { type: 'TOGGLE_BLOCKED_USER'; payload: { userId: string; isBlocked: boolean } }
  | { type: 'SET_PENDING_BAN_ORDER'; payload: Order | null };

export function orderPageReducer(state: OrderPageState, action: OrderPageAction): OrderPageState {
  switch (action.type) {
    case 'SET_ORDERS':
      return {
        ...state,
        orders: action.payload.orders,
        totalOrders: action.payload.totalOrders,
        totalPages: action.payload.totalPages,
        selectedOrderIds: [],
      };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'SET_PAGE_SIZE':
      return { ...state, pageSize: action.payload, page: 1 };
    case 'SET_FILTER':
      return { ...state, ...action.payload, page: 1 };
    case 'SET_DATE_RANGE':
      return { ...state, ...action.payload, page: 1 };
    case 'RESET_PAGE':
      return { ...state, page: 1 };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_STATS':
      return { ...state, stats: action.payload };
    case 'SET_LOADING_STATS':
      return { ...state, loadingStats: action.payload };
    case 'TOGGLE_ORDER_SELECTION': {
      const id = action.payload;
      return {
        ...state,
        selectedOrderIds: state.selectedOrderIds.includes(id)
          ? state.selectedOrderIds.filter((oid) => oid !== id)
          : [...state.selectedOrderIds, id],
      };
    }
    case 'TOGGLE_SELECT_ALL': {
      const visibleIds = state.orders.map((o) => o._id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selectedOrderIds.includes(id));
      return { ...state, selectedOrderIds: allSelected ? [] : visibleIds };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedOrderIds: [], bulkValue: '' };
    case 'SET_BULK_VALUE':
      return { ...state, bulkValue: action.payload };
    case 'SET_BULK_UPDATING':
      return { ...state, bulkUpdating: action.payload };
    case 'SET_SELECTED_ORDER':
      return { ...state, selectedOrder: action.payload };
    case 'SET_MODAL_OPEN':
      return { ...state, isModalOpen: action.payload };
    case 'SET_LOADING_ORDER_DETAILS':
      return { ...state, loadingOrderDetails: action.payload };
    case 'SET_CHANGE_STATUS_MODAL_OPEN':
      return { ...state, isChangeStatusModalOpen: action.payload };
    case 'SET_UPDATING_STATUS':
      return { ...state, updatingStatus: action.payload };
    case 'SET_CHANGE_EXECUTION_DATE_MODAL_OPEN':
      return { ...state, isChangeExecutionDateModalOpen: action.payload };
    case 'SET_CHANGING_EXECUTION_DATE_ID':
      return { ...state, changingExecutionDateId: action.payload };
    case 'SET_EDIT_ORDER_MODAL_OPEN':
      return { ...state, isEditOrderModalOpen: action.payload };
    case 'SET_EDITING_FIELD':
      return { ...state, editingField: action.payload };
    case 'SET_SAVING_ORDER_ID':
      return { ...state, savingOrderId: action.payload };
    case 'SET_ORDER_HISTORY_MODAL_OPEN':
      return { ...state, isOrderHistoryModalOpen: action.payload };
    case 'SET_ORDER_HISTORY':
      return {
        ...state,
        orderHistory: action.payload.history,
        loadingOrderHistory: action.payload.loading,
      };
    case 'SET_LOADING_ORDER_HISTORY':
      return { ...state, loadingOrderHistory: action.payload };
    case 'SET_BLOCKED_USER_IDS':
      return { ...state, blockedUserIds: action.payload };
    case 'SET_BLOCKING_ORDER_ID':
      return { ...state, blockingOrderId: action.payload };
    case 'SET_ASYNC_ACTION':
      return { ...state, ...action.payload };
    case 'UPDATE_ORDER_IN_LIST':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o._id === action.payload.orderId ? { ...o, ...action.payload.updates } : o,
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder._id === action.payload.orderId
            ? { ...state.selectedOrder, ...action.payload.updates }
            : state.selectedOrder,
      };
    case 'UPDATE_ORDER_RESERVATION_DATA':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o._id === action.payload.orderId
            ? { ...o, reservationData: action.payload.reservationData }
            : o,
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder._id === action.payload.orderId
            ? { ...state.selectedOrder, reservationData: action.payload.reservationData }
            : state.selectedOrder,
      };
    case 'SET_ORDERS_ITEMS':
      return {
        ...state,
        orders: state.orders.map((o) =>
          o._id === action.payload.orderId ? { ...o, items: action.payload.items } : o,
        ),
        selectedOrder:
          state.selectedOrder && state.selectedOrder._id === action.payload.orderId
            ? { ...state.selectedOrder, items: action.payload.items }
            : state.selectedOrder,
      };
    case 'TOGGLE_BLOCKED_USER': {
      const next = new Set(state.blockedUserIds);
      if (action.payload.isBlocked) {
        next.add(action.payload.userId);
      } else {
        next.delete(action.payload.userId);
      }
      return { ...state, blockedUserIds: next };
    }
    case 'SET_PENDING_BAN_ORDER':
      return { ...state, pendingBanOrder: action.payload };
    default:
      return state;
  }
}

export interface UseOrderPageOptions {
  namespace: 'orders' | 'execution';
  initialState?: Partial<OrderPageState>;
}

export function useOrderPage(options: UseOrderPageOptions) {
  const { namespace, initialState } = options;
  const t = useTranslations(namespace);
  const [state, dispatch] = useReducer(
    orderPageReducer,
    { ...initialOrderPageState, ...initialState },
  );

  const photoUploadOrderRef = useRef<Order | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceUploadOrderRef = useRef<Order | null>(null);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);

  const setPage = useCallback((page: number) => dispatch({ type: 'SET_PAGE', payload: page }), []);
  const setPageSize = useCallback((size: number | 'all') => {
    const action: OrderPageAction = { type: 'SET_PAGE_SIZE', payload: size };
    return dispatch(action);
  }, []);
  const setFilter = useCallback(
    (filter: FilterPayload) => dispatch({ type: 'SET_FILTER', payload: filter }),
    [],
  );
  const setDateRange = useCallback(
    (range: { fromDateFilter: string; toDateFilter: string }) =>
      dispatch({ type: 'SET_DATE_RANGE', payload: range }),
    [],
  );
  const resetPage = useCallback(() => dispatch({ type: 'RESET_PAGE' }), []);
  const setLoading = useCallback((value: boolean) => dispatch({ type: 'SET_LOADING', payload: value }), []);
  const setLoadingStats = useCallback((value: boolean) => dispatch({ type: 'SET_LOADING_STATS', payload: value }), []);
  const setStats = useCallback((stats: OrderStatsData | null) => dispatch({ type: 'SET_STATS', payload: stats }), []);
  const toggleOrderSelection = useCallback((id: string) => dispatch({ type: 'TOGGLE_ORDER_SELECTION', payload: id }), []);
  const toggleSelectAll = useCallback(() => dispatch({ type: 'TOGGLE_SELECT_ALL' }), []);
  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);
  const setBulkValue = useCallback((value: string) => dispatch({ type: 'SET_BULK_VALUE', payload: value }), []);
  const setBulkUpdating = useCallback((value: boolean) => dispatch({ type: 'SET_BULK_UPDATING', payload: value }), []);
  const setSelectedOrder = useCallback((order: Order | null) => dispatch({ type: 'SET_SELECTED_ORDER', payload: order }), []);
  const setModalOpen = useCallback((value: boolean) => dispatch({ type: 'SET_MODAL_OPEN', payload: value }), []);
  const setLoadingOrderDetails = useCallback((value: boolean) => dispatch({ type: 'SET_LOADING_ORDER_DETAILS', payload: value }), []);
  const setChangeStatusModalOpen = useCallback((value: boolean) => dispatch({ type: 'SET_CHANGE_STATUS_MODAL_OPEN', payload: value }), []);
  const setUpdatingStatus = useCallback((value: boolean) => dispatch({ type: 'SET_UPDATING_STATUS', payload: value }), []);
  const setChangeExecutionDateModalOpen = useCallback((value: boolean) => dispatch({ type: 'SET_CHANGE_EXECUTION_DATE_MODAL_OPEN', payload: value }), []);
  const setChangingExecutionDateId = useCallback((value: string | null) => dispatch({ type: 'SET_CHANGING_EXECUTION_DATE_ID', payload: value }), []);
  const setEditOrderModalOpen = useCallback((value: boolean) => dispatch({ type: 'SET_EDIT_ORDER_MODAL_OPEN', payload: value }), []);
  const setEditingField = useCallback((field: 'name' | 'items' | 'duaa' | null) => dispatch({ type: 'SET_EDITING_FIELD', payload: field }), []);
  const setSavingOrderId = useCallback((value: string | null) => dispatch({ type: 'SET_SAVING_ORDER_ID', payload: value }), []);
  const setOrderHistoryModalOpen = useCallback((value: boolean) => dispatch({ type: 'SET_ORDER_HISTORY_MODAL_OPEN', payload: value }), []);
  const setOrderHistory = useCallback((history: unknown[], loading: boolean) => dispatch({ type: 'SET_ORDER_HISTORY', payload: { history, loading } }), []);
  const setLoadingOrderHistory = useCallback((value: boolean) => dispatch({ type: 'SET_LOADING_ORDER_HISTORY', payload: value }), []);
  const setBlockedUserIds = useCallback((ids: Set<string>) => dispatch({ type: 'SET_BLOCKED_USER_IDS', payload: ids }), []);
  const setBlockingOrderId = useCallback((value: string | null) => dispatch({ type: 'SET_BLOCKING_ORDER_ID', payload: value }), []);
  const setPendingBanOrder = useCallback((value: Order | null) => dispatch({ type: 'SET_PENDING_BAN_ORDER', payload: value }), []);
  const setAsyncAction = useCallback(
    (payload: Partial<Pick<OrderPageState, 'whatsappOrderId' | 'copyingPhoneOrderId' | 'copyingMessageOrderId'>>) =>
      dispatch({ type: 'SET_ASYNC_ACTION', payload }),
    [],
  );

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
          toast.error(t('detailsLoadFailed') || t('messages.loadFailed'));
        }
        return null;
      }
    },
    [t],
  );

  const resolveOrderWhatsappPayload = useCallback(
    async (order: Order) => {
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
    },
    [fetchOrderDetails],
  );

  const viewOrder = useCallback(
    async (order: Order) => {
      setSelectedOrder(order);
      setModalOpen(true);
      setLoadingOrderDetails(true);
      const fullOrder = await fetchOrderDetails(order._id);
      if (fullOrder) {
        setSelectedOrder(fullOrder);
      }
      setLoadingOrderDetails(false);
    },
    [fetchOrderDetails, setSelectedOrder, setModalOpen, setLoadingOrderDetails],
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedOrder(null);
    setLoadingOrderDetails(false);
  }, [setModalOpen, setSelectedOrder, setLoadingOrderDetails]);

  const handleChangeStatus = useCallback((order: Order) => {
    setSelectedOrder(order);
    setChangeStatusModalOpen(true);
  }, [setSelectedOrder, setChangeStatusModalOpen]);

  const closeChangeStatusModal = useCallback(() => {
    setChangeStatusModalOpen(false);
  }, [setChangeStatusModalOpen]);

  const startOrderWhatsappMessage = useCallback(
    async (order: Order) => {
      try {
        setAsyncAction({ whatsappOrderId: order._id });
        const { message, whatsappPhone } = await resolveOrderWhatsappPayload(order);

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
        setAsyncAction({ whatsappOrderId: null });
      }
    },
    [resolveOrderWhatsappPayload, setAsyncAction, t],
  );

  const copyOrderWhatsappNumber = useCallback(
    async (order: Order) => {
      try {
        setAsyncAction({ copyingPhoneOrderId: order._id });
        const whatsappPhone = normalizeWhatsappPhone(order.billingData?.phone, true);

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
        setAsyncAction({ copyingPhoneOrderId: null });
      }
    },
    [setAsyncAction, t],
  );

  const copyOrderWhatsappMessage = useCallback(
    async (order: Order) => {
      try {
        setAsyncAction({ copyingMessageOrderId: order._id });
        const { message } = await resolveOrderWhatsappPayload(order);
        await copyToClipboard(message);
        toast.success(t('copyWhatsapp.copyMessageSuccess'));
      } catch (error) {
        console.error('Error copying WhatsApp message:', error);
        toast.error(t('copyWhatsapp.copyMessageFailed'));
      } finally {
        setAsyncAction({ copyingMessageOrderId: null });
      }
    },
    [resolveOrderWhatsappPayload, setAsyncAction, t],
  );

  // Update status (PUT /api/orders/:id)
  const updateOrderStatus = useCallback(
    async (status: OrderStatus, cancellationReason?: string, isScammer?: boolean) => {
      if (!state.selectedOrder || status === state.selectedOrder.status) {
        closeChangeStatusModal();
        return;
      }

      try {
        setUpdatingStatus(true);
        const payload: Record<string, unknown> = { status };
        if (status === 'cancelled' && cancellationReason) {
          payload.cancellationReason = cancellationReason;
        }
        const res = await fetch(`/api/orders/${state.selectedOrder._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to update order status');
        }

        const updated = data.data as Order;
        dispatch({
          type: 'UPDATE_ORDER_IN_LIST',
          payload: {
            orderId: state.selectedOrder._id,
            updates: {
              status: updated.status,
              cancellationReason: updated.cancellationReason,
            },
          },
        });
        toast.success(t('statusUpdateSuccess') || t('changeStatusModal.success'));
        closeChangeStatusModal();

        // If the order was cancelled due to scammer and the user is not a guest, prompt to ban
        if (isScammer && status === 'cancelled' && state.selectedOrder.userId && !state.selectedOrder.isGuest) {
          dispatch({ type: 'SET_PENDING_BAN_ORDER', payload: state.selectedOrder });
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        toast.error(t('statusUpdateFailed') || t('changeStatusModal.failed'));
      } finally {
        setUpdatingStatus(false);
      }
    },
    [state.selectedOrder, closeChangeStatusModal, setUpdatingStatus, t],
  );

  // Update order (PATCH /api/orders/:id)
  const updateOrder = useCallback(
    async (
      orderId: string,
      fields: {
        sacrificeFor?: string;
        shortDuaa?: string;
        photo?: string;
        invoiceUrl?: string;
        invoiceStatus?: 'confirmed' | 'waiting' | 'pending' | 'rejected';
        invoiceValue?: number;
        invoiceUrls?: Array<{
          url: string;
          invoiceStatus?: 'confirmed' | 'waiting' | 'pending' | 'rejected';
          rejectionReason?: string;
          value: number;
          currency?: string;
        }>;
        items?: Order['items'];
        gender?: string;
        isAlive?: string;
        intention?: string;
      },
    ): Promise<boolean> => {
      try {
        setSavingOrderId(orderId);
        const body: Record<string, unknown> = {};
        if ('sacrificeFor' in fields) body.sacrificeFor = fields.sacrificeFor;
        if ('shortDuaa' in fields) body.shortDuaa = fields.shortDuaa;
        if ('photo' in fields) body.photo = fields.photo;
        if ('invoiceUrl' in fields) body.invoiceUrl = fields.invoiceUrl;
        if ('invoiceStatus' in fields) body.invoiceStatus = fields.invoiceStatus;
        if ('invoiceValue' in fields) body.invoiceValue = fields.invoiceValue;
        if ('invoiceUrls' in fields) body.invoiceUrls = fields.invoiceUrls;
        if ('items' in fields) body.items = fields.items;
        if ('gender' in fields) body.gender = fields.gender;
        if ('isAlive' in fields) body.isAlive = fields.isAlive;
        if ('intention' in fields) body.intention = fields.intention;

        const res = await fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to update order');
        }

        toast.success(t('editOrder.success'));

        const order = state.orders.find((o) => o._id === orderId);
        if (!order) return true;

        const nextReservationData = [...(order.reservationData || [])];
        if (fields.sacrificeFor !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'sacrificeFor');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.sacrificeFor };
          } else {
            nextReservationData.push({
              key: 'sacrificeFor',
              label: { ar: 'المؤدى عنه', en: 'Sacrifice For' },
              type: 'text',
              value: fields.sacrificeFor,
            });
          }
        }
        if (fields.shortDuaa !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'shortDuaa');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.shortDuaa };
          } else {
            nextReservationData.push({
              key: 'shortDuaa',
              label: { ar: 'الدعاء المختصر', en: 'Short Duaa' },
              type: 'textarea',
              value: fields.shortDuaa,
            });
          }
        }
        if (fields.photo !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'photo');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.photo };
          } else {
            nextReservationData.push({
              key: 'photo',
              label: { ar: 'الصورة', en: 'Photo' },
              type: 'picture',
              value: fields.photo,
            });
          }
        }
        if (fields.gender !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'gender');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.gender };
          } else {
            nextReservationData.push({
              key: 'gender',
              label: { ar: 'الجنس', en: 'Gender' },
              type: 'radio',
              value: fields.gender,
            });
          }
        }
        if (fields.isAlive !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'isAlive');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.isAlive };
          } else {
            nextReservationData.push({
              key: 'isAlive',
              label: { ar: 'الحالة', en: 'Status' },
              type: 'radio',
              value: fields.isAlive,
            });
          }
        }
        if (fields.intention !== undefined) {
          const idx = nextReservationData.findIndex((f) => f.key === 'intention');
          if (idx >= 0) {
            nextReservationData[idx] = { ...nextReservationData[idx], value: fields.intention };
          } else {
            nextReservationData.push({
              key: 'intention',
              label: { ar: 'النية', en: 'Intention' },
              type: 'select',
              value: fields.intention,
            });
          }
        }

        dispatch({
          type: 'UPDATE_ORDER_RESERVATION_DATA',
          payload: { orderId, reservationData: nextReservationData },
        });
        if (fields.items !== undefined) {
          dispatch({ type: 'SET_ORDERS_ITEMS', payload: { orderId, items: fields.items } });
        }
        if (fields.invoiceUrl !== undefined) {
          const currentOrder = state.orders.find((o) => o._id === orderId);
          const currentInvoices = currentOrder?.invoiceUrls || [];
          const alreadyExists = currentInvoices.some((invoice) => invoice.url === fields.invoiceUrl);
          const invoiceStatus = fields.invoiceStatus ?? 'waiting';
          const nextInvoices = alreadyExists
            ? currentInvoices
            : [...currentInvoices, { url: fields.invoiceUrl, invoiceStatus, rejectionReason: '', value: fields.invoiceValue ?? 0 }];

          dispatch({
            type: 'UPDATE_ORDER_IN_LIST',
            payload: {
              orderId,
              updates: {
                invoiceUrls: nextInvoices,
              },
            },
          });
        }

        if (fields.invoiceUrls !== undefined) {
          dispatch({
            type: 'UPDATE_ORDER_IN_LIST',
            payload: {
              orderId,
              updates: {
                invoiceUrls: fields.invoiceUrls,
              },
            },
          });
        }
        return true;
      } catch (error) {
        console.error('Error updating order:', error);
        toast.error(t('editOrder.failed'));
        return false;
      } finally {
        setSavingOrderId(null);
      }
    },
    [state.orders, setSavingOrderId, t],
  );

  return {
    state,
    dispatch,
    // Direct dispatch helpers
    setPage,
    setPageSize,
    setFilter,
    setDateRange,
    resetPage,
    setLoading,
    setLoadingStats,
    setStats,
    toggleOrderSelection,
    toggleSelectAll,
    clearSelection,
    setBulkValue,
    setBulkUpdating,
    setSelectedOrder,
    setModalOpen,
    setLoadingOrderDetails,
    setChangeStatusModalOpen,
    setUpdatingStatus,
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
    setAsyncAction,
    // Refs
    photoUploadOrderRef,
    photoInputRef,
    invoiceUploadOrderRef,
    invoiceInputRef,
    // Common actions
    fetchOrderDetails,
    resolveOrderWhatsappPayload,
    viewOrder,
    closeModal,
    handleChangeStatus,
    closeChangeStatusModal,
    startOrderWhatsappMessage,
    copyOrderWhatsappNumber,
    copyOrderWhatsappMessage,
    updateOrderStatus,
    updateOrder,
  };
}

export default useOrderPage;
