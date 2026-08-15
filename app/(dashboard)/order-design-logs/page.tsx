'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
    LuRefreshCw,
    LuSearch,
    LuFilter,
    LuCircleCheck,
    LuCircleX,
    LuCircleAlert,
    LuCircleMinus,
    LuClock,
    LuUser,
    LuImage,
    LuFileText,
    LuChevronDown,
    LuChevronUp,
} from 'react-icons/lu';
import Loading from '@/components/ui/loading';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import {
    type OrderDesignLog,
    type OrderDesignLogPagination,
    type DesignGenTrigger,
    type DesignGenStatus,
} from '@/types/OrderDesignLog';

const STATUS_OPTIONS: DesignGenStatus[] = ['success', 'partial', 'failed', 'skipped'];
const TRIGGER_OPTIONS: DesignGenTrigger[] = ['auto_webhook', 'auto_admin', 'manual_admin'];

function getStatusIcon(status: DesignGenStatus) {
    switch (status) {
        case 'success':
            return <LuCircleCheck className="text-success" size={16} />;
        case 'partial':
            return <LuCircleAlert className="text-orange-500" size={16} />;
        case 'failed':
            return <LuCircleX className="text-error" size={16} />;
        case 'skipped':
            return <LuCircleMinus className="text-secondary" size={16} />;
    }
}

function getStatusColor(status: DesignGenStatus) {
    switch (status) {
        case 'success':
            return 'bg-success/10 text-success';
        case 'partial':
            return 'bg-orange-500/10 text-orange-500';
        case 'failed':
            return 'bg-error/10 text-error';
        case 'skipped':
            return 'bg-secondary/10 text-secondary';
    }
}

function getTriggerColor(trigger: DesignGenTrigger) {
    switch (trigger) {
        case 'auto_webhook':
            return 'bg-blue-500/10 text-blue-500';
        case 'auto_admin':
            return 'bg-purple-500/10 text-purple-500';
        case 'manual_admin':
            return 'bg-teal-500/10 text-teal-600';
    }
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.round((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
}

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString();
}

export default function OrderDesignLogsPage() {
    const t = useTranslations('orderDesignLogs');
    const [logs, setLogs] = useState<OrderDesignLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState<OrderDesignLogPagination | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        status: '',
        trigger: '',
        search: '',
    });

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', String(page));
            params.append('limit', String(pageSize));
            if (filters.status) params.append('status', filters.status);
            if (filters.trigger) params.append('trigger', filters.trigger);
            if (filters.search.trim()) params.append('search', filters.search.trim());

            const res = await fetch(`/api/order-design-logs?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                setLogs(data.data.logs);
                setPagination(data.data.pagination);
            }
        } catch (error) {
            console.error('Error fetching design logs:', error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleFilterChange = (key: keyof typeof filters, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const handleRefresh = () => {
        fetchLogs();
    };

    const statusOptions = [
        { value: '', label: t('filters.allStatuses') },
        ...STATUS_OPTIONS.map((s) => ({ value: s, label: t(`status.${s}`) })),
    ];

    const triggerOptions = [
        { value: '', label: t('filters.allTriggers') },
        ...TRIGGER_OPTIONS.map((tr) => ({ value: tr, label: t(`trigger.${tr}`) })),
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground mb-2">
                        {t('title')}
                    </h1>
                    <p className="text-secondary">{t('description')}</p>
                </div>
                <Button onClick={handleRefresh} className="flex gap-2" disabled={loading}>
                    <LuRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    {t('refresh')}
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-card-bg border border-stroke rounded-site p-4">
                <div className="flex items-center gap-2 mb-3">
                    <LuFilter size={18} className="text-secondary" />
                    <h3 className="font-semibold">{t('filters.title')}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Dropdown
                        label={t('filters.statusLabel')}
                        value={filters.status}
                        options={statusOptions}
                        onChange={(value: string) => handleFilterChange('status', value)}
                    />
                    <Dropdown
                        label={t('filters.triggerLabel')}
                        value={filters.trigger}
                        options={triggerOptions}
                        onChange={(value: string) => handleFilterChange('trigger', value)}
                    />
                    <Input
                        label={t('filters.searchLabel')}
                        value={filters.search}
                        onChange={(e) => handleFilterChange('search', e.target.value)}
                        placeholder={t('filters.searchPlaceholder')}
                        suffix={<LuSearch size={16} className="text-secondary" />}
                    />
                </div>
            </div>

            {/* Table with inline expandable rows */}
            <div className="bg-card-bg border border-stroke rounded-site overflow-hidden">
                {loading ? (
                    <Loading size="md" text="Loading..." className="h-64" />
                ) : logs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                        <p className="text-secondary">{t('emptyMessage')}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-background border-b border-stroke">
                                <tr>
                                    <th className="text-start px-4 py-3 text-sm font-semibold min-w-32">
                                        {t('table.orderNumber')}
                                    </th>
                                    <th className="text-start px-4 py-3 text-sm font-semibold">
                                        {t('table.status')}
                                    </th>
                                    <th className="text-start px-4 py-3 text-sm font-semibold">
                                        {t('table.trigger')}
                                    </th>
                                    <th className="text-start px-4 py-3 text-sm font-semibold">
                                        {t('table.results')}
                                    </th>
                                    <th className="text-start px-4 py-3 text-sm font-semibold">
                                        {t('table.duration')}
                                    </th>
                                    <th className="text-start px-4 py-3 text-sm font-semibold min-w-40">
                                        {t('table.date')}
                                    </th>
                                    <th className="w-10 px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stroke">
                                {logs.map((log) => (
                                    <LogRow
                                        key={log._id}
                                        log={log}
                                        isExpanded={expandedId === log._id}
                                        onToggle={() =>
                                            setExpandedId(expandedId === log._id ? null : log._id)
                                        }
                                        t={t}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && (
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={setPage}
                    hasNextPage={pagination.hasNextPage}
                    hasPrevPage={pagination.hasPrevPage}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setPage(1);
                    }}
                />
            )}
        </div>
    );
}

/**
 * A single log row + its inline expanded details.
 *
 * When expanded, renders an extra <tr> right below the data row
 * with a full-width <td> containing the details panel.
 */
function LogRow({
    log,
    isExpanded,
    onToggle,
    t,
}: {
    log: OrderDesignLog;
    isExpanded: boolean;
    onToggle: () => void;
    t: ReturnType<typeof useTranslations>;
}) {
    return (
        <>
            <tr
                className={`hover:bg-background transition-colors cursor-pointer ${log.status === 'failed' ? 'bg-error/5' : ''}`}
                onClick={onToggle}
            >
                {/* Order number */}
                <td className="px-4 py-3 text-start">
                    <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-sm font-semibold text-foreground">
                            {log.orderNumber}
                        </span>
                        {log.source && (
                            <span className="text-xs text-secondary uppercase">{log.source}</span>
                        )}
                    </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-start">
                    <div className="flex items-center gap-1.5">
                        {getStatusIcon(log.status)}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                            {t(`status.${log.status}`)}
                        </span>
                    </div>
                </td>

                {/* Trigger */}
                <td className="px-4 py-3 text-start">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTriggerColor(log.trigger)}`}>
                        {t(`trigger.${log.trigger}`)}
                    </span>
                </td>

                {/* Results */}
                <td className="px-4 py-3 text-start">
                    {log.totalProducts === 0 ? (
                        <span className="text-secondary text-sm">—</span>
                    ) : (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-success font-medium">{log.generatedCount}</span>
                            <span className="text-secondary">/</span>
                            <span className="text-secondary">{log.totalProducts}</span>
                            {log.failedCount > 0 && (
                                <span className="text-error font-medium">
                                    ({log.failedCount} {t('table.failed')})
                                </span>
                            )}
                        </div>
                    )}
                </td>

                {/* Duration */}
                <td className="px-4 py-3 text-start">
                    <span className="text-secondary text-sm whitespace-nowrap">
                        {formatDuration(log.durationMs)}
                    </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3 text-start">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-secondary text-sm whitespace-nowrap">
                            {formatDate(log.createdAt)}
                        </span>
                        {log.trigger !== 'auto_webhook' && log.triggeredByUserName && (
                            <span className="text-xs text-secondary flex items-center gap-1">
                                <LuUser size={10} />
                                {log.triggeredByUserName}
                            </span>
                        )}
                    </div>
                </td>

                {/* Expand/collapse button */}
                <td className="px-4 py-3 text-start">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggle();
                        }}
                        className="p-1 rounded hover:bg-background transition-colors"
                        aria-label={isExpanded ? t('table.collapse') : t('table.expand')}
                    >
                        {isExpanded ? (
                            <LuChevronUp size={16} className="text-secondary" />
                        ) : (
                            <LuChevronDown size={16} className="text-secondary" />
                        )}
                    </button>
                </td>
            </tr>

            {/* Expanded details — inline below the row */}
            {isExpanded && (
                <tr>
                    <td colSpan={7} className="p-0">
                        <ExpandedDetails log={log} t={t} />
                    </td>
                </tr>
            )}
        </>
    );
}

/**
 * Expanded details panel for a single log entry.
 * Renders inside the table as a full-width row below the clicked log.
 */
function ExpandedDetails({
    log,
    t,
}: {
    log: OrderDesignLog;
    t: ReturnType<typeof useTranslations>;
}) {
    return (
        <div className="bg-background/50 px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                    {t('details.title')} — <span className="font-mono">{log.orderNumber}</span>
                </h3>
                <span className="text-secondary text-sm">
                    {t('details.orderId')}: <span className="font-mono text-xs">{log.orderId}</span>
                </span>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                    <span className="text-secondary block">{t('details.orderStatus')}</span>
                    <span className="font-medium">{log.orderStatus || '—'}</span>
                </div>
                <div>
                    <span className="text-secondary block">{t('details.templateType')}</span>
                    <span className="font-medium flex items-center gap-1">
                        {log.hasReservationPhoto ? (
                            <>
                                <LuImage size={14} /> {t('details.imageTemplate')}
                            </>
                        ) : (
                            <>
                                <LuFileText size={14} /> {t('details.textTemplate')}
                            </>
                        )}
                    </span>
                </div>
                <div>
                    <span className="text-secondary block">{t('details.startedAt')}</span>
                    <span className="font-medium flex items-center gap-1">
                        <LuClock size={14} /> {formatDate(log.startedAt)}
                    </span>
                </div>
                <div>
                    <span className="text-secondary block">{t('details.finishedAt')}</span>
                    <span className="font-medium flex items-center gap-1">
                        <LuClock size={14} /> {formatDate(log.finishedAt)}
                    </span>
                </div>
            </div>

            {/* Error (if the whole attempt failed) */}
            {log.error && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-3">
                    <p className="text-error font-medium text-sm mb-1">{t('details.error')}</p>
                    <p className="text-error/80 text-sm font-mono break-all">{log.error}</p>
                </div>
            )}

            {/* Per-product results */}
            {log.results.length > 0 ? (
                <div className="space-y-2">
                    <h4 className="font-medium text-sm">{t('details.products')}</h4>
                    <div className="space-y-2">
                        {log.results.map((result, i) => (
                            <div
                                key={i}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${result.success
                                    ? 'border-success/20 bg-success/5'
                                    : 'border-error/20 bg-error/5'
                                    }`}
                            >
                                <div className="shrink-0 mt-0.5">
                                    {result.success ? (
                                        <LuCircleCheck className="text-success" size={18} />
                                    ) : (
                                        <LuCircleX className="text-error" size={18} />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium text-sm">
                                            {result.productName || result.productId}
                                        </span>
                                        {result.templateType && (
                                            <span className="text-xs text-secondary flex items-center gap-0.5">
                                                {result.templateType === 'image' ? (
                                                    <LuImage size={10} />
                                                ) : (
                                                    <LuFileText size={10} />
                                                )}
                                                {result.templateType}
                                            </span>
                                        )}
                                    </div>
                                    {result.success && result.url && (
                                        <a
                                            href={result.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline break-all mt-1 block"
                                        >
                                            {result.url}
                                        </a>
                                    )}
                                    {!result.success && (
                                        <div className="mt-1 text-xs">
                                            <span className="text-error font-mono font-medium">
                                                {result.errorCode || 'unknown'}
                                            </span>
                                            {result.errorMessage && (
                                                <span className="text-error/70 ms-2">
                                                    {result.errorMessage}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-secondary text-sm">{t('details.noProducts')}</p>
            )}
        </div>
    );
}
