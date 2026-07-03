'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import BulkAction from '@/components/ui/bulk-action';
import Tabs from '@/components/ui/tabs';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { LuList, LuLayoutGrid } from 'react-icons/lu';

import { Order, OrderStatus, PaymentMethod, InvoiceStatus } from '@/types/Order';

import InvoiceFilters from './components/invoice-filters';
import InvoiceEditModal from './components/invoice-edit-modal';
import InvoicePreviewModal from './components/invoice-preview-modal';
import InvoicePaymentMethodModal from './components/invoice-payment-method-modal';
import InvoiceRejectionModal from './components/invoice-rejection-modal';
import InvoiceTitle from './components/invoice-title';
import { useInvoiceColumns } from './components/invoice-table-columns';
import InvoiceCardView from './components/invoice-card-view';
import OrderDetailModal from '../(orders-execution)/components/order-detail-modal';
import ChangeStatusModal from '../(orders-execution)/components/change-status-modal';
import OrderHistoryModal, { OrderHistoryEntry } from '../(orders-execution)/components/order-history-modal';
import {
    normalizeWhatsappPhone,
    copyToClipboard,
} from '../(orders-execution)/lib/order-utils';
import { buildOrderWhatsappMessageFromOrder } from '@/lib/order-whatsapp';
import type {
    InvoiceEntry,
    InvoiceRow,
    ReviewFilter,
} from './lib/invoice-utils';
import {
    getRelativeIsoDate,
    normalizeDateRange,
    addDaysToIsoDate,
    downloadInvoiceFile,
} from './lib/invoice-utils';
import { uploadInvoiceToR2 } from '@/lib/image-upload-utils';

type DateQuickPreset = 'today' | 'tomorrow' | 'yesterday' | 'last7Days' | 'all';

export default function InvoicesPage() {
    const t = useTranslations('admin.invoices');
    const locale = useLocale();
    const isAr = locale === 'ar';
    const { confirm, modalProps } = useConfirmModal();

    const today = getRelativeIsoDate(0);

    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
    const [fromDateFilter, setFromDateFilter] = useState(today);
    const [toDateFilter, setToDateFilter] = useState(today);

    // Edit modal state
    const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
    const [saving, setSaving] = useState(false);

    // Preview modal state
    const [previewInvoice, setPreviewInvoice] = useState<InvoiceRow | null>(null);

    // Payment method edit modal state
    const [editingPaymentMethodInvoice, setEditingPaymentMethodInvoice] = useState<InvoiceRow | null>(null);
    const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);

    // Invoice status rejection reason modal state
    const [statusChangeInvoice, setStatusChangeInvoice] = useState<InvoiceRow | null>(null);
    const [statusChangeTarget, setStatusChangeTarget] = useState<InvoiceStatus | null>(null);
    const [savingStatus, setSavingStatus] = useState(false);

    // Invoice upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadInvoiceTarget, setUploadInvoiceTarget] = useState<InvoiceRow | null>(null);
    const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);

    // Order detail modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);

    // Change status modal
    const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    // Order history modal
    const [isOrderHistoryModalOpen, setIsOrderHistoryModalOpen] = useState(false);
    const [orderHistory, setOrderHistory] = useState<OrderHistoryEntry[]>([]);
    const [loadingOrderHistory, setLoadingOrderHistory] = useState(false);

    // Async action tracking (by orderId)
    const [whatsappOrderId, setWhatsappOrderId] = useState<string | null>(null);
    const [copyingPhoneOrderId, setCopyingPhoneOrderId] = useState<string | null>(null);
    const [copyingMessageOrderId, setCopyingMessageOrderId] = useState<string | null>(null);
    const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
    const [blockingOrderId, setBlockingOrderId] = useState<string | null>(null);

    // Bulk selection
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
    const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
    const [bulkUpdating, setBulkUpdating] = useState(false);

    // View mode: list or card
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');

    const fetchInvoices = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: '1',
                limit: '200',
                view: 'table',
                source: sourceFilter,
                tzOffsetMinutes: String(new Date().getTimezoneOffset()),
            });
            if (searchQuery) params.set('search', searchQuery);

            const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
            if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
            if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);

            const res = await fetch(`/api/orders?${params.toString()}`, {
                cache: 'no-store',
                signal,
            });
            const data = await res.json();
            if (!data.success) {
                if (!signal?.aborted) toast.error(data.error || t('loadFailed'));
                return;
            }

            const rows: InvoiceRow[] = [];

            for (const order of data.data.orders as Order[]) {
                const invoiceUrls = (order.invoiceUrls || []) as InvoiceEntry[];
                // Derive payment method from the latest paid payment
                const payments = order.payments || [];
                const paidPayment = [...payments]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .find((p) => p.status === 'paid');
                const paymentMethod = paidPayment?.paymentMethod || order.paymentMethod;

                invoiceUrls.forEach((inv, idx) => {
                    const invoiceStatus: string = inv.invoiceStatus ?? 'waiting';

                    if (reviewFilter !== 'all' && invoiceStatus !== reviewFilter) return;
                    if (paymentMethodFilter !== 'all' && paymentMethod !== paymentMethodFilter) return;

                    rows.push({
                        _id: `${order._id}_${idx}`,
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        invoiceIndex: idx,
                        url: inv.url,
                        invoiceStatus,
                        rejectionReason: inv.rejectionReason || '',
                        value: inv.value || 0,
                        currency: order.currency || '',
                        invoiceCurrency: inv.currency || 'EGP',
                        orderStatus: order.status,
                        customerName: order.billingData?.fullName || '',
                        customerEmail: order.billingData?.email || '',
                        customerPhone: order.billingData?.phone || '',
                        source: order.source || '',
                        paymentMethod,
                        reservationData: order.reservationData,
                        items: order.items || [],
                        userId: order.userId,
                        isGuest: order.isGuest,
                        createdAt: order.createdAt,
                        updatedAt: order.updatedAt,
                    });
                });
            }

            setInvoices(rows);
            setTotalPages(Math.max(1, Math.ceil(rows.length / pageSize)));
        } catch (error) {
            if ((error as { name?: string })?.name === 'AbortError') {
                return;
            }
            console.error('Error fetching invoices:', error);
            toast.error(t('loadFailed'));
        } finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [pageSize, reviewFilter, sourceFilter, paymentMethodFilter, searchQuery, fromDateFilter, toDateFilter, t]);

    useEffect(() => {
        const controller = new AbortController();
        void fetchInvoices(controller.signal);

        return () => {
            controller.abort();
        };
    }, [fetchInvoices]);

    // Debounced search
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    // ---------- Date filter helpers ----------

    const tomorrow = getRelativeIsoDate(1);
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
        if (preset === 'all') {
            setFromDateFilter('');
            setToDateFilter('');
            return;
        }
        if (preset === 'today') {
            setFromDateFilter(today);
            setToDateFilter(today);
            return;
        }
        if (preset === 'tomorrow') {
            setFromDateFilter(tomorrow);
            setToDateFilter(tomorrow);
            return;
        }
        if (preset === 'yesterday') {
            setFromDateFilter(yesterday);
            setToDateFilter(yesterday);
            return;
        }
        setFromDateFilter(lastSevenDaysStart);
        setToDateFilter(today);
    };

    const handleFromDateChange = (value: string) => {
        const r = normalizeDateRange(value, toDateFilter);
        setFromDateFilter(r.fromDate);
        setToDateFilter(r.toDate);
    };

    const handleToDateChange = (value: string) => {
        const r = normalizeDateRange(fromDateFilter, value);
        setFromDateFilter(r.fromDate);
        setToDateFilter(r.toDate);
    };

    // ---------- Invoice edit ----------

    const handleCloseEdit = () => {
        setEditingInvoice(null);
    };

    const handleSaveEdit = async (value: number, currency: string) => {
        if (!editingInvoice) return;
        setSaving(true);
        try {
            const fetchRes = await fetch(`/api/orders/${editingInvoice.orderId}`, {
                cache: 'no-store',
            });
            const fetchData = await fetchRes.json();
            if (!fetchData.success) {
                toast.error(t('updateFailed'));
                return;
            }

            const order = fetchData.data as Order;
            const currentInvoices = (order.invoiceUrls || []) as InvoiceEntry[];

            const updatedInvoices = currentInvoices.map((inv) =>
                inv.url === editingInvoice.url
                    ? { ...inv, value, currency }
                    : inv,
            );

            const patchRes = await fetch(`/api/orders/${editingInvoice.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceUrls: updatedInvoices }),
            });
            const patchData = await patchRes.json();

            if (!patchData.success) {
                toast.error(patchData.error || t('updateFailed'));
                return;
            }

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv._id === editingInvoice._id
                        ? { ...inv, value, invoiceCurrency: currency }
                        : inv,
                ),
            );

            toast.success(t('updateSuccess'));
            handleCloseEdit();
        } catch (error) {
            console.error('Error updating invoice:', error);
            toast.error(t('updateFailed'));
        } finally {
            setSaving(false);
        }
    };

    // ---------- Payment method edit ----------

    const handleClosePaymentMethodEdit = () => {
        setEditingPaymentMethodInvoice(null);
    };

    const handleSavePaymentMethod = async (invoice: InvoiceRow, paymentMethod: PaymentMethod) => {
        setSavingPaymentMethod(true);
        try {
            const fetchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                cache: 'no-store',
            });
            const fetchData = await fetchRes.json();
            if (!fetchData.success) {
                toast.error(t('updateFailed'));
                return;
            }

            const order = fetchData.data as Order;
            const payments = (order.payments || []).map((p) => ({ ...p }));
            const paidPaymentIndex = payments.findIndex((p) => p.status === 'paid');
            if (paidPaymentIndex >= 0) {
                payments[paidPaymentIndex] = {
                    ...payments[paidPaymentIndex],
                    paymentMethod,
                };
            }

            const patchBody: Record<string, unknown> = { paymentMethod };
            if (paidPaymentIndex >= 0) {
                patchBody.payments = payments;
            }

            const patchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchBody),
            });
            const patchData = await patchRes.json();

            if (!patchData.success) {
                toast.error(patchData.error || t('updateFailed'));
                return;
            }

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv.orderId === invoice.orderId
                        ? { ...inv, paymentMethod }
                        : inv,
                ),
            );

            toast.success(t('updateSuccess'));
            handleClosePaymentMethodEdit();
        } catch (error) {
            console.error('Error updating payment method:', error);
            toast.error(t('updateFailed'));
        } finally {
            setSavingPaymentMethod(false);
        }
    };

    // ---------- Invoice status change ----------

    const handleStatusChange = (invoice: InvoiceRow, status: InvoiceStatus) => {
        if (status === 'rejected') {
            setStatusChangeInvoice(invoice);
            setStatusChangeTarget(status);
            return;
        }
        void applyInvoiceStatusChange(invoice, status, '');
    };

    const handleCloseStatusChange = () => {
        setStatusChangeInvoice(null);
        setStatusChangeTarget(null);
    };

    const handleStatusChangeWithReason = async (
        invoice: InvoiceRow,
        status: InvoiceStatus,
        reason: string,
    ) => {
        await applyInvoiceStatusChange(invoice, status, reason);
    };

    const applyInvoiceStatusChange = async (
        invoice: InvoiceRow,
        status: InvoiceStatus,
        rejectionReason: string,
    ) => {
        setSavingStatus(true);
        try {
            const fetchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                cache: 'no-store',
            });
            const fetchData = await fetchRes.json();
            if (!fetchData.success) {
                toast.error(t('updateFailed'));
                return;
            }

            const order = fetchData.data as Order;
            const currentInvoices = (order.invoiceUrls || []) as InvoiceEntry[];
            const updatedInvoices = currentInvoices.map((inv) =>
                inv.url === invoice.url
                    ? { ...inv, invoiceStatus: status, rejectionReason }
                    : inv,
            );

            const patchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceUrls: updatedInvoices }),
            });
            const patchData = await patchRes.json();

            if (!patchData.success) {
                toast.error(patchData.error || t('updateFailed'));
                return;
            }

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv._id === invoice._id
                        ? { ...inv, invoiceStatus: status, rejectionReason }
                        : inv,
                ),
            );

            toast.success(t('statusUpdated'));
            handleCloseStatusChange();
        } catch (error) {
            console.error('Error updating invoice status:', error);
            toast.error(t('updateFailed'));
        } finally {
            setSavingStatus(false);
        }
    };

    // ---------- Invoice preview actions ----------

    const handleDownloadInvoice = async (invoice: InvoiceRow) => {
        try {
            await downloadInvoiceFile(invoice.url, `invoice-${invoice.orderNumber}`);
        } catch (error) {
            console.error('Error downloading invoice:', error);
            toast.error(t('downloadFailed') || 'Failed to download invoice');
        }
    };

    const handleUploadInvoiceClick = (invoice: InvoiceRow) => {
        setUploadInvoiceTarget(invoice);
        fileInputRef.current?.click();
    };

    const handleUploadInvoiceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadInvoiceTarget) return;

        const allowedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
        ];
        if (!allowedTypes.includes(file.type)) {
            toast.error(t('invalidInvoice'));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error(t('invoiceTooLarge'));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploadingInvoiceId(uploadInvoiceTarget._id);
        try {
            const newUrl = await uploadInvoiceToR2(file);
            const fetchRes = await fetch(`/api/orders/${uploadInvoiceTarget.orderId}`, { cache: 'no-store' });
            const fetchData = await fetchRes.json();
            if (!fetchData.success) {
                throw new Error(fetchData.error || t('updateFailed'));
            }

            const order = fetchData.data as Order;
            const currentInvoices = (order.invoiceUrls || []) as InvoiceEntry[];
            const updatedInvoices = currentInvoices.map((inv) =>
                inv.url === uploadInvoiceTarget.url
                    ? { ...inv, url: newUrl }
                    : inv,
            );

            const patchRes = await fetch(`/api/orders/${uploadInvoiceTarget.orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ invoiceUrls: updatedInvoices }),
            });
            const patchData = await patchRes.json();
            if (!patchData.success) {
                throw new Error(patchData.error || t('updateFailed'));
            }

            setInvoices((prev) =>
                prev.map((inv) =>
                    inv._id === uploadInvoiceTarget._id
                        ? { ...inv, url: newUrl }
                        : inv,
                ),
            );

            toast.success(t('updateSuccess'));
        } catch (error) {
            console.error('Error replacing invoice:', error);
            toast.error(t('updateFailed'));
        } finally {
            setUploadingInvoiceId(null);
            setUploadInvoiceTarget(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ---------- Order actions (matching orders/execution page) ----------

    const handleViewOrder = async (order: Order) => {
        setSelectedOrder(order);
        setIsOrderModalOpen(true);
        setLoadingOrderDetails(true);
        try {
            const res = await fetch(`/api/orders/${order._id}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setSelectedOrder(data.data as Order);
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingOrderDetails(false);
        }
    };

    const closeModal = () => {
        setIsOrderModalOpen(false);
        setSelectedOrder(null);
    };

    const startOrderWhatsappMessage = (order: Order) => {
        const phone = normalizeWhatsappPhone(order.billingData?.phone);
        if (!phone) {
            toast.error(t('copyFailed'));
            return;
        }
        setWhatsappOrderId(order._id);
        try {
            const message = buildOrderWhatsappMessageFromOrder(order);
            const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            toast.error(t('copyFailed'));
        } finally {
            setWhatsappOrderId(null);
        }
    };

    const copyOrderWhatsappNumber = async (order: Order) => {
        const phone = normalizeWhatsappPhone(order.billingData?.phone, true);
        if (!phone) {
            toast.error(t('copyFailed'));
            return;
        }
        setCopyingPhoneOrderId(order._id);
        try {
            await copyToClipboard(phone);
            toast.success(t('copied'));
        } catch {
            toast.error(t('copyFailed'));
        } finally {
            setCopyingPhoneOrderId(null);
        }
    };

    const copyOrderWhatsappMessage = async (order: Order) => {
        setCopyingMessageOrderId(order._id);
        try {
            const message = buildOrderWhatsappMessageFromOrder(order);
            await copyToClipboard(message);
            toast.success(t('copied'));
        } catch {
            toast.error(t('copyFailed'));
        } finally {
            setCopyingMessageOrderId(null);
        }
    };

    const handleChangeStatus = (order: Order) => {
        setSelectedOrder(order);
        setIsChangeStatusModalOpen(true);
    };

    const closeChangeStatusModal = () => {
        setIsChangeStatusModalOpen(false);
    };

    const updateOrderStatus = async (
        status: OrderStatus,
        cancellationReason?: string,
        _isScammer?: boolean,
    ) => {
        if (!selectedOrder) return;
        setUpdatingStatus(true);
        try {
            const res = await fetch(`/api/orders/${selectedOrder._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, cancellationReason }),
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || t('updateFailed'));
                return;
            }
            const updated = data.data as Order;
            setInvoices((prev) =>
                prev.map((inv) =>
                    inv.orderId === selectedOrder._id
                        ? { ...inv, orderStatus: updated.status }
                        : inv,
                ),
            );
            toast.success(t('statusUpdated'));
            closeChangeStatusModal();
        } catch (error) {
            console.error('Error updating order status:', error);
            toast.error(t('updateFailed'));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleViewHistory = async (order: Order) => {
        setSelectedOrder(order);
        setIsOrderHistoryModalOpen(true);
        setLoadingOrderHistory(true);
        setOrderHistory([]);
        try {
            const res = await fetch(`/api/orders/${order._id}/history`);
            const data = await res.json();
            if (data.success) {
                setOrderHistory(data.data || []);
            } else {
                toast.error(data.error || t('updateFailed'));
            }
        } catch (error) {
            console.error('Error fetching order history:', error);
            toast.error(t('updateFailed'));
        } finally {
            setLoadingOrderHistory(false);
        }
    };

    const closeOrderHistoryModal = () => {
        setIsOrderHistoryModalOpen(false);
        setOrderHistory([]);
    };

    const handleBlockCustomer = async (order: Order) => {
        if (order.isGuest || !order.userId || !order.source) {
            toast.error(t('blockCustomer'));
            return;
        }

        const isCurrentlyBanned = blockedUserIds.has(order.userId);

        const confirmed = await confirm({
            title: isCurrentlyBanned ? t('unblockCustomer') : t('blockCustomer'),
            message: isCurrentlyBanned ? t('unblockCustomer') : t('blockCustomer'),
            type: isCurrentlyBanned ? 'info' : 'danger',
            confirmText: isCurrentlyBanned ? t('unblockCustomer') : t('blockCustomer'),
            cancelText: t('cancel'),
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
                toast.error(data.error || t('updateFailed'));
                return;
            }

            setBlockedUserIds(
                new Set(
                    isCurrentlyBanned
                        ? Array.from(blockedUserIds).filter((id) => id !== order.userId)
                        : [...Array.from(blockedUserIds), order.userId],
                ),
            );
            toast.success(t('statusUpdated'));
        } catch {
            toast.error(t('updateFailed'));
        } finally {
            setBlockingOrderId(null);
        }
    };

    // ---------- Format helpers ----------

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Paginate locally (invoices are flattened from orders)
    const paginatedInvoices = useMemo(() => {
        const start = (page - 1) * pageSize;
        return invoices.slice(start, start + pageSize);
    }, [invoices, page, pageSize]);

    // ---------- Bulk selection & actions ----------

    const toggleInvoiceSelection = (invoiceId: string) => {
        setSelectedInvoiceIds((prev) =>
            prev.includes(invoiceId)
                ? prev.filter((id) => id !== invoiceId)
                : [...prev, invoiceId],
        );
    };

    const allVisibleSelected =
        paginatedInvoices.length > 0 &&
        paginatedInvoices.every((invoice) => selectedInvoiceIds.includes(invoice._id));

    const toggleSelectAll = () => {
        const paginatedIds = paginatedInvoices.map((invoice) => invoice._id);
        if (allVisibleSelected) {
            setSelectedInvoiceIds((prev) => prev.filter((id) => !paginatedIds.includes(id)));
        } else {
            setSelectedInvoiceIds((prev) => Array.from(new Set([...prev, ...paginatedIds])));
        }
    };

    const clearSelection = () => {
        setSelectedInvoiceIds([]);
        setBulkStatusValue('');
    };

    const applyBulkInvoiceStatus = async () => {
        if (selectedInvoiceIds.length === 0 || !bulkStatusValue) return;
        const selected = invoices.filter((inv) => selectedInvoiceIds.includes(inv._id));
        if (selected.length === 0) return;

        setBulkUpdating(true);
        try {
            await Promise.all(
                selected.map(async (invoice) => {
                    const fetchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                        cache: 'no-store',
                    });
                    const fetchData = await fetchRes.json();
                    if (!fetchData.success) {
                        throw new Error(fetchData.error || t('updateFailed'));
                    }

                    const order = fetchData.data as Order;
                    const currentInvoices = (order.invoiceUrls || []) as InvoiceEntry[];
                    const updatedInvoices = currentInvoices.map((inv) =>
                        inv.url === invoice.url
                            ? { ...inv, invoiceStatus: bulkStatusValue, rejectionReason: '' }
                            : inv,
                    );

                    const patchRes = await fetch(`/api/orders/${invoice.orderId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ invoiceUrls: updatedInvoices }),
                    });
                    const patchData = await patchRes.json();
                    if (!patchData.success) {
                        throw new Error(patchData.error || t('updateFailed'));
                    }
                }),
            );

            setInvoices((prev) =>
                prev.map((inv) =>
                    selectedInvoiceIds.includes(inv._id)
                        ? { ...inv, invoiceStatus: bulkStatusValue, rejectionReason: '' }
                        : inv,
                ),
            );

            toast.success(t('statusUpdated'));
            clearSelection();
        } catch (error) {
            console.error('Error bulk updating invoice statuses:', error);
            toast.error(t('updateFailed'));
        } finally {
            setBulkUpdating(false);
        }
    };

    const bulkStatusOptions = [
        { label: t('status.confirmed'), value: 'confirmed' },
        { label: t('status.waiting'), value: 'waiting' },
        { label: t('status.pending'), value: 'pending' },
        { label: t('status.rejected'), value: 'rejected' },
    ];

    // ---------- Columns ----------

    const columns = useInvoiceColumns({
        onEdit: (invoice) => setEditingInvoice(invoice),
        onPreview: (invoice) => setPreviewInvoice(invoice),
        onViewOrder: handleViewOrder,
        onWhatsapp: startOrderWhatsappMessage,
        onCopyPhone: copyOrderWhatsappNumber,
        onCopyMessage: copyOrderWhatsappMessage,
        onChangeStatus: handleChangeStatus,
        onViewHistory: handleViewHistory,
        onBlock: handleBlockCustomer,
        onToggleSelect: toggleInvoiceSelection,
        onToggleSelectAll: toggleSelectAll,
        selectedInvoiceIds,
        allVisibleSelected,
        onEditPaymentMethod: (invoice) => setEditingPaymentMethodInvoice(invoice),
        onStatusChange: handleStatusChange,
        onDownloadInvoice: handleDownloadInvoice,
        onUploadInvoice: handleUploadInvoiceClick,
        uploadingInvoiceId,
        tooltipPos: isAr ? 'right' : 'left',
        formatDate,
        whatsappOrderId,
        copyingPhoneOrderId,
        copyingMessageOrderId,
        blockingOrderId,
        blockedUserIds,
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
            </div>

            {/* Filters */}
            <InvoiceFilters
                searchInput={searchInput}
                onSearchChange={setSearchInput}
                sourceFilter={sourceFilter}
                onSourceChange={(val) => {
                    setSourceFilter(val);
                    setPage(1);
                }}
                reviewFilter={reviewFilter}
                onReviewChange={(val) => {
                    setReviewFilter(val);
                    setPage(1);
                }}
                paymentMethodFilter={paymentMethodFilter}
                onPaymentMethodChange={(val) => {
                    setPaymentMethodFilter(val);
                    setPage(1);
                }}
                onRefresh={() => void fetchInvoices()}
                fromDateFilter={fromDateFilter}
                toDateFilter={toDateFilter}
                onFromDateChange={handleFromDateChange}
                onToDateChange={handleToDateChange}
                activeDatePreset={activeDatePreset}
                onDatePreset={applyDatePreset}
                locale={locale}
            />

            {/* Total + view switcher */}
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-secondary">
                    {t('total')}: {invoices.length}
                </span>
                <Tabs<'list' | 'card'>
                    value={viewMode}
                    options={[
                        { value: 'list', label: <LuList size={16} />, ariaLabel: t('view.list') },
                        { value: 'card', label: <LuLayoutGrid size={16} />, ariaLabel: t('view.card') },
                    ]}
                    onChange={setViewMode}
                    size="sm"
                />
            </div>

            {/* Date title (only when a single day is selected) */}
            {fromDateFilter && fromDateFilter === toDateFilter && (
                <InvoiceTitle
                    date={fromDateFilter}
                    locale={locale}
                    onPrevDay={() => {
                        const prev = addDaysToIsoDate(fromDateFilter, -1);
                        setFromDateFilter(prev);
                        setToDateFilter(prev);
                    }}
                    onNextDay={() => {
                        const next = addDaysToIsoDate(fromDateFilter, 1);
                        setFromDateFilter(next);
                        setToDateFilter(next);
                    }}
                />
            )}

            {/* Bulk action */}
            <BulkAction
                selectedCount={selectedInvoiceIds.length}
                value={bulkStatusValue}
                options={bulkStatusOptions}
                onValueChange={setBulkStatusValue}
                onApply={applyBulkInvoiceStatus}
                onClear={clearSelection}
                applyLabel={t('bulkAction.apply')}
                applyingLabel={t('bulkAction.applying')}
                clearLabel={t('bulkAction.clear')}
                selectionLabel={t('bulkAction.selectedCount', { count: selectedInvoiceIds.length })}
                dropdownLabel={t('bulkAction.statusLabel')}
                locale={locale}
                disabled={!bulkStatusValue}
                loading={bulkUpdating}
            />

            {/* List view */}
            {viewMode === 'list' && (
                <Table
                    columns={columns}
                    data={paginatedInvoices}
                    loading={loading}
                    emptyMessage={t('empty')}
                />
            )}

            {/* Card view */}
            {viewMode === 'card' && (
                <InvoiceCardView
                    invoices={paginatedInvoices}
                    loading={loading}
                    emptyMessage={t('empty')}
                    onEdit={(invoice) => setEditingInvoice(invoice)}
                    onPreview={(invoice) => setPreviewInvoice(invoice)}
                    onViewOrder={handleViewOrder}
                    onWhatsapp={startOrderWhatsappMessage}
                    onCopyPhone={copyOrderWhatsappNumber}
                    onCopyMessage={copyOrderWhatsappMessage}
                    onChangeStatus={handleChangeStatus}
                    onViewHistory={handleViewHistory}
                    onBlock={handleBlockCustomer}
                    onToggleSelect={toggleInvoiceSelection}
                    selectedInvoiceIds={selectedInvoiceIds}
                    onEditPaymentMethod={(invoice) => setEditingPaymentMethodInvoice(invoice)}
                    onStatusChange={handleStatusChange}
                    onDownloadInvoice={handleDownloadInvoice}
                    onUploadInvoice={handleUploadInvoiceClick}
                    uploadingInvoiceId={uploadingInvoiceId}
                    tooltipPos={isAr ? 'right' : 'left'}
                    whatsappOrderId={whatsappOrderId}
                    copyingPhoneOrderId={copyingPhoneOrderId}
                    copyingMessageOrderId={copyingMessageOrderId}
                    blockingOrderId={blockingOrderId}
                    blockedUserIds={blockedUserIds}
                />
            )}

            {/* Pagination */}
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
                pageSize={pageSize}
            />

            {/* Hidden file input for invoice upload */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt"
                onChange={handleUploadInvoiceFile}
            />

            {/* Edit Modal */}
            <InvoiceEditModal
                invoice={editingInvoice}
                saving={saving}
                onClose={handleCloseEdit}
                onSave={handleSaveEdit}
            />

            {/* Preview lightbox */}
            <InvoicePreviewModal
                url={previewInvoice?.url || null}
                onClose={() => setPreviewInvoice(null)}
            />

            {/* Payment Method Modal */}
            <InvoicePaymentMethodModal
                invoice={editingPaymentMethodInvoice}
                isOpen={!!editingPaymentMethodInvoice}
                onClose={handleClosePaymentMethodEdit}
                onSave={handleSavePaymentMethod}
                saving={savingPaymentMethod}
            />

            {/* Rejection Reason Modal */}
            <InvoiceRejectionModal
                invoice={statusChangeInvoice}
                status={statusChangeTarget}
                isOpen={!!statusChangeInvoice && !!statusChangeTarget}
                onClose={handleCloseStatusChange}
                onConfirm={handleStatusChangeWithReason}
                loading={savingStatus}
            />

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={isOrderModalOpen}
                onClose={closeModal}
                order={selectedOrder}
                loadingDetails={loadingOrderDetails}
                formatDate={formatDate}
                locale={locale}
                namespace="orders"
            />

            {/* Change Status Modal */}
            <ChangeStatusModal
                isOpen={isChangeStatusModalOpen}
                onClose={closeChangeStatusModal}
                currentStatus={selectedOrder?.status ?? 'paid'}
                onUpdateStatus={updateOrderStatus}
                updating={updatingStatus}
                namespace="orders"
            />

            {/* Order History Modal */}
            <OrderHistoryModal
                isOpen={isOrderHistoryModalOpen}
                onClose={closeOrderHistoryModal}
                orderNumber={selectedOrder?.orderNumber || ''}
                history={orderHistory}
                loading={loadingOrderHistory}
                namespace="orders"
            />

            <ConfirmModal {...modalProps} />
        </div>
    );
}
