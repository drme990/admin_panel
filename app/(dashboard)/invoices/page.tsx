'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import Tooltip from '@/components/ui/tooltip';
import Modal from '@/components/ui/modal';

import { Order } from '@/types/Order';

import {
    LuSearch,
    LuCheck,
    LuClock,
    LuSave,
    LuExternalLink,
    LuFileText,
} from 'react-icons/lu';

interface InvoiceEntry {
    url: string;
    reviewed: boolean;
    value: number;
    currency?: string;
}

interface InvoiceRow {
    _id: string;
    orderId: string;
    orderNumber: string;
    invoiceIndex: number;
    url: string;
    reviewed: boolean;
    value: number;
    currency: string;
    invoiceCurrency: string;
    orderStatus: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    source: string;
    createdAt: string;
    updatedAt: string;
}

type ReviewFilter = 'all' | 'reviewed' | 'unreviewed';

function isImageUrl(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
}

export default function InvoicesPage() {
    const t = useTranslations('admin.invoices');
    const locale = useLocale();
    const isAr = locale === 'ar';

    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalInvoices, setTotalInvoices] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [searchInput, setSearchInput] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
    const [sourceFilter, setSourceFilter] = useState('all');

    // Edit modal state
    const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editReviewed, setEditReviewed] = useState(false);
    const [editCurrency, setEditCurrency] = useState('EGP');
    const [saving, setSaving] = useState(false);

    // Preview modal state
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Stats
    const [stats, setStats] = useState({ total: 0, reviewed: 0, unreviewed: 0, totalValue: 0 });

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch orders (backend doesn't support invoice-specific filters,
            // so we filter client-side). Pull a large batch to cover filtering.
            const params = new URLSearchParams({
                page: '1',
                limit: '200',
                source: sourceFilter,
            });
            if (searchQuery) params.set('search', searchQuery);

            const res = await fetch(`/api/orders?view=table&${params.toString()}`, {
                cache: 'no-store',
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || t('loadFailed'));
                return;
            }

            // Flatten orders → invoice rows, then apply review filter
            const rows: InvoiceRow[] = [];
            let reviewedCount = 0;
            let unreviewedCount = 0;
            let totalValue = 0;

            for (const order of data.data.orders as Order[]) {
                const invoiceUrls = (order.invoiceUrls || []) as InvoiceEntry[];
                invoiceUrls.forEach((inv, idx) => {
                    if (inv.reviewed) reviewedCount++;
                    else unreviewedCount++;
                    totalValue += inv.value || 0;

                    // Apply review filter
                    if (reviewFilter === 'reviewed' && !inv.reviewed) return;
                    if (reviewFilter === 'unreviewed' && inv.reviewed) return;

                    rows.push({
                        _id: `${order._id}_${idx}`,
                        orderId: order._id,
                        orderNumber: order.orderNumber,
                        invoiceIndex: idx,
                        url: inv.url,
                        reviewed: inv.reviewed,
                        value: inv.value || 0,
                        currency: order.currency || '',
                        invoiceCurrency: inv.currency || 'EGP',
                        orderStatus: order.status,
                        customerName: order.billingData?.fullName || '',
                        customerEmail: order.billingData?.email || '',
                        customerPhone: order.billingData?.phone || '',
                        source: order.source || '',
                        createdAt: order.createdAt,
                        updatedAt: order.updatedAt,
                    });
                });
            }

            setInvoices(rows);
            setTotalInvoices(rows.length);
            setTotalPages(Math.max(1, Math.ceil(rows.length / pageSize)));
            setStats({
                total: reviewedCount + unreviewedCount,
                reviewed: reviewedCount,
                unreviewed: unreviewedCount,
                totalValue,
            });
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error(t('loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [pageSize, reviewFilter, sourceFilter, searchQuery, t]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    // Debounced search
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(searchInput.trim());
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const handleOpenEdit = (invoice: InvoiceRow) => {
        setEditingInvoice(invoice);
        setEditValue(String(invoice.value || ''));
        setEditReviewed(invoice.reviewed);
        setEditCurrency(invoice.invoiceCurrency || 'EGP');
    };

    const handleCloseEdit = () => {
        setEditingInvoice(null);
        setEditValue('');
        setEditReviewed(false);
        setEditCurrency('EGP');
    };

    const handleSaveEdit = async () => {
        if (!editingInvoice) return;
        setSaving(true);
        try {
            // Fetch the full order to get all invoice URLs
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

            // Update the specific invoice at the matching URL
            const updatedInvoices = currentInvoices.map((inv) =>
                inv.url === editingInvoice.url
                    ? { ...inv, value: parseFloat(editValue) || 0, reviewed: editReviewed, currency: editCurrency }
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

            // Update local state
            setInvoices((prev) =>
                prev.map((inv) =>
                    inv._id === editingInvoice._id
                        ? { ...inv, value: parseFloat(editValue) || 0, reviewed: editReviewed, invoiceCurrency: editCurrency }
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

    const handleQuickToggleReviewed = async (invoice: InvoiceRow) => {
        const newReviewed = !invoice.reviewed;
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
                inv.url === invoice.url ? { ...inv, reviewed: newReviewed } : inv,
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
                    inv._id === invoice._id ? { ...inv, reviewed: newReviewed } : inv,
                ),
            );

            toast.success(newReviewed ? t('markedReviewed') : t('markedUnreviewed'));
        } catch (error) {
            console.error('Error toggling reviewed:', error);
            toast.error(t('updateFailed'));
        }
    };

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

    const sourceOptions = useMemo(
        () => [
            { label: t('allSources'), value: 'all' },
            { label: 'Manasik', value: 'manasik' },
            { label: 'Ghadaq', value: 'ghadaq' },
        ],
        [t],
    );

    const currencyOptions = useMemo(
        () => ['EGP', 'SAR', 'USD', 'EUR', 'AED', 'KWD'].map((c) => ({ label: c, value: c })),
        [],
    );

    const reviewTabs = useMemo(
        () => [
            { label: t('filterAll'), value: 'all' as ReviewFilter },
            { label: t('filterReviewed'), value: 'reviewed' as ReviewFilter },
            { label: t('filterUnreviewed'), value: 'unreviewed' as ReviewFilter },
        ],
        [t],
    );

    const columns = useMemo(
        () => [
            {
                header: t('colOrderNumber'),
                accessor: (row: InvoiceRow) => (
                    <span className="font-medium text-foreground whitespace-nowrap">
                        {row.orderNumber}
                    </span>
                ),
                className: 'min-w-32',
            },
            {
                header: t('colPreview'),
                accessor: (row: InvoiceRow) => (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewUrl(row.url);
                        }}
                        className="flex items-center justify-center w-10 h-10 rounded-lg border border-stroke bg-background hover:bg-foreground/5 transition-colors"
                        aria-label={t('preview')}
                    >
                        {isImageUrl(row.url) ? (
                            <img
                                src={row.url}
                                alt="Invoice"
                                className="w-8 h-8 object-cover rounded"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <LuFileText size={18} className="text-secondary" />
                        )}
                    </button>
                ),
                className: 'w-16',
            },
            {
                header: t('colCustomer'),
                accessor: (row: InvoiceRow) => (
                    <div className="flex flex-col gap-0.5 min-w-32">
                        <span className="text-sm text-foreground truncate">{row.customerName || '-'}</span>
                        {row.customerPhone && (
                            <span className="text-xs text-secondary truncate" dir="ltr">{row.customerPhone}</span>
                        )}
                    </div>
                ),
            },
            {
                header: t('colSource'),
                accessor: (row: InvoiceRow) => (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary capitalize">
                        {row.source || '-'}
                    </span>
                ),
                className: 'w-24',
            },
            {
                header: t('colValue'),
                accessor: (row: InvoiceRow) => (
                    <div className="flex flex-col gap-0.5 whitespace-nowrap">
                        <span className="text-sm font-medium text-foreground">
                            {row.value.toFixed(2)} {row.invoiceCurrency}
                        </span>
                        {row.invoiceCurrency !== row.currency && row.currency && (
                            <span className="text-xs text-secondary">
                                {t('orderCurrency')}: {row.currency}
                            </span>
                        )}
                    </div>
                ),
                className: 'w-28',
            },
            {
                header: t('colStatus'),
                accessor: (row: InvoiceRow) => (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleQuickToggleReviewed(row);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full transition-colors ${row.reviewed
                            ? 'bg-success/10 text-success hover:bg-success/20'
                            : 'bg-warning/10 text-warning hover:bg-warning/20'
                            }`}
                        title={row.reviewed ? t('markUnreviewed') : t('markReviewed')}
                    >
                        {row.reviewed ? <LuCheck size={12} /> : <LuClock size={12} />}
                        {row.reviewed ? t('reviewed') : t('unreviewed')}
                    </button>
                ),
                className: 'w-32',
            },
            {
                header: t('colDate'),
                accessor: (row: InvoiceRow) => (
                    <span className="text-xs text-secondary whitespace-nowrap">
                        {formatDate(row.createdAt)}
                    </span>
                ),
                className: 'w-36',
            },
            {
                header: t('colActions'),
                accessor: (row: InvoiceRow) => (
                    <div className="flex items-center gap-1">
                        <Tooltip position={isAr ? 'right' : 'left'} content={t('edit')}>
                            <Button
                                variant="icon-primary"
                                size="custom"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(row);
                                }}
                                aria-label={t('edit')}
                            >
                                <LuSave size={16} />
                            </Button>
                        </Tooltip>
                        <Tooltip position={isAr ? 'right' : 'left'} content={t('openUrl')}>
                            <Button
                                variant="icon-primary"
                                size="custom"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(row.url, '_blank', 'noopener,noreferrer');
                                }}
                                aria-label={t('openUrl')}
                            >
                                <LuExternalLink size={16} />
                            </Button>
                        </Tooltip>
                    </div>
                ),
                className: 'w-24',
            },
        ],
        [t, isAr],
    );

    // Paginate locally (invoices are flattened from orders)
    const paginatedInvoices = useMemo(() => {
        const start = (page - 1) * pageSize;
        return invoices.slice(start, start + pageSize);
    }, [invoices, page, pageSize]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-stroke bg-card-bg">
                    <p className="text-xs text-secondary">{t('statsTotal')}</p>
                    <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </div>
                <div className="p-3 rounded-lg border border-stroke bg-card-bg">
                    <p className="text-xs text-secondary">{t('statsReviewed')}</p>
                    <p className="text-xl font-bold text-success">{stats.reviewed}</p>
                </div>
                <div className="p-3 rounded-lg border border-stroke bg-card-bg">
                    <p className="text-xs text-secondary">{t('statsUnreviewed')}</p>
                    <p className="text-xl font-bold text-warning">{stats.unreviewed}</p>
                </div>
                <div className="p-3 rounded-lg border border-stroke bg-card-bg">
                    <p className="text-xs text-secondary">{t('statsTotalValue')}</p>
                    <p className="text-xl font-bold text-foreground">{stats.totalValue.toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                    <LuSearch
                        size={16}
                        className={`absolute top-1/2 -translate-y-1/2 text-secondary pointer-events-none z-10 ${isAr ? 'right-3' : 'left-3'}`}
                    />
                    <Input
                        type="text"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={t('searchPlaceholder')}
                        className={isAr ? 'pr-10' : 'pl-10'}
                    />
                </div>
                <div className="sm:w-48">
                    <Dropdown
                        value={sourceFilter}
                        options={sourceOptions}
                        onChange={(val) => {
                            setSourceFilter(val);
                            setPage(1);
                        }}
                    />
                </div>
            </div>

            {/* Review filter tabs */}
            <Tabs
                value={reviewFilter}
                options={reviewTabs}
                onChange={(val) => {
                    setReviewFilter(val as ReviewFilter);
                    setPage(1);
                }}
                size="sm"
            />

            {/* Table */}
            <Table
                columns={columns}
                data={paginatedInvoices}
                loading={loading}
                emptyMessage={t('empty')}
            />

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

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingInvoice}
                onClose={handleCloseEdit}
                title={t('editTitle')}
                size="sm"
            >
                {editingInvoice && (
                    <div className="flex flex-col gap-4">
                        {/* Preview */}
                        <div className="flex justify-center">
                            {isImageUrl(editingInvoice.url) ? (
                                <img
                                    src={editingInvoice.url}
                                    alt="Invoice"
                                    className="max-h-48 object-contain rounded-lg border border-stroke"
                                />
                            ) : (
                                <div className="flex flex-col items-center gap-2 p-6 rounded-lg border border-stroke bg-card-bg">
                                    <LuFileText size={32} className="text-secondary" />
                                    <a
                                        href={editingInvoice.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary hover:underline"
                                    >
                                        {t('openUrl')}
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Order info */}
                        <div className="text-sm text-secondary space-y-1">
                            <p><span className="font-medium text-foreground">{t('colOrderNumber')}:</span> {editingInvoice.orderNumber}</p>
                            <p><span className="font-medium text-foreground">{t('colCustomer')}:</span> {editingInvoice.customerName || '-'}</p>
                        </div>

                        {/* Value input with currency selector */}
                        <div className="flex flex-row gap-2 items-end">
                            <div className="flex-1 min-w-0">
                                <Input
                                    label={t('colValue')}
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="shrink-0 w-24">
                                <Dropdown
                                    value={editCurrency}
                                    options={currencyOptions}
                                    onChange={(val) => setEditCurrency(val)}
                                />
                            </div>
                        </div>

                        {/* Reviewed toggle */}
                        <label className="flex items-center gap-3 cursor-pointer">
                            <button
                                type="button"
                                onClick={() => setEditReviewed(!editReviewed)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editReviewed ? 'bg-success' : 'bg-stroke'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editReviewed ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                            <span className="text-sm text-foreground">
                                {editReviewed ? t('reviewed') : t('unreviewed')}
                            </span>
                        </label>

                        {/* Actions */}
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={handleCloseEdit} disabled={saving}>
                                {t('cancel')}
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSaveEdit}
                                disabled={saving}
                            >
                                {saving ? t('saving') : t('save')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Preview lightbox */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setPreviewUrl(null)}
                >
                    {isImageUrl(previewUrl) ? (
                        <img
                            src={previewUrl}
                            alt="Invoice preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg"
                        />
                    ) : (
                        <div className="bg-card-bg rounded-lg p-8 flex flex-col items-center gap-4">
                            <LuFileText size={48} className="text-secondary" />
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {t('openUrl')}
                            </a>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
