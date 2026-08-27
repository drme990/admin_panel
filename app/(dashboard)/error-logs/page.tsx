'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuRefreshCw as RefreshCw,
  LuTrash2 as TrashIcon,
  LuCircleAlert as ErrorIcon,
  LuTriangleAlert as WarnIcon,
  LuOctagonAlert as FatalIcon,
  LuChevronDown as ChevronDown,
  LuChevronUp as ChevronUp,
  LuX as XIcon,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { PageLoading } from '@/components/ui/loading';

interface ErrorLog {
  _id: string;
  level: 'error' | 'warn' | 'fatal';
  message: string;
  stack?: string;
  source?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  appId?: string;
  user?: {
    userId?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  session?: {
    ip?: string;
    userAgent?: string;
    locale?: string;
    traceId?: string;
    referrer?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const PAGE_SIZE = 50;

export default function ErrorLogsPage() {
  const t = useTranslations('admin.errorLogs');
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    level: '',
    search: '',
  });
  const { confirm, modalProps } = useConfirmModal();

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(PAGE_SIZE));
      if (filter.level) params.append('level', filter.level);
      if (filter.search) params.append('search', filter.search);

      const res = await fetch(`/api/error-logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.pages);
      } else {
        toast.error(data.error || 'Failed to fetch error logs');
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch error logs');
    } finally {
      setLoading(false);
    }
  }, [page, filter.level, filter.search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleDeleteAll = async () => {
    const confirmed = await confirm({
      title: t('deleteAllTitle'),
      message: t('deleteAllMessage'),
      type: 'danger',
      confirmText: t('deleteAllConfirm'),
      cancelText: t('cancel'),
    });
    if (!confirmed) return;

    try {
      const params = new URLSearchParams();
      if (filter.level) params.append('level', filter.level);
      const res = await fetch(`/api/error-logs?${params.toString()}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('deletedCount', { count: data.deletedCount }));
        setPage(1);
        fetchLogs();
      } else {
        toast.error(data.error || 'Failed to delete logs');
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Failed to delete logs');
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      const res = await fetch(`/api/error-logs/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('deletedOne'));
        fetchLogs();
      } else {
        toast.error(data.error || 'Failed to delete log');
      }
    } catch (error) {
      console.error('Error deleting log:', error);
      toast.error('Failed to delete log');
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'fatal':
        return <FatalIcon size={16} className="text-error" />;
      case 'warn':
        return <WarnIcon size={16} className="text-warning" />;
      default:
        return <ErrorIcon size={16} className="text-error" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      fatal: 'bg-error/10 text-error border-error/20',
      error: 'bg-error/10 text-error border-error/20',
      warn: 'bg-warning/10 text-warning border-warning/20',
    };
    return styles[level] || styles.error;
  };

  const levelOptions = [
    { value: '', label: t('allLevels') },
    { value: 'error', label: t('levelError') },
    { value: 'warn', label: t('levelWarn') },
    { value: 'fatal', label: t('levelFatal') },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={fetchLogs} variant="outline" className="gap-2">
            <RefreshCw size={18} />
            {t('refresh')}
          </Button>
          <Button
            onClick={handleDeleteAll}
            variant="custom"
            className="bg-error text-white hover:bg-error/90 gap-2"
          >
            <TrashIcon size={18} />
            {t('deleteAll')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-secondary text-sm">{t('totalErrors')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{total}</p>
        </div>
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-secondary text-sm">{t('currentPage')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {page} / {totalPages || 1}
          </p>
        </div>
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-secondary text-sm">{t('showing')}</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {logs.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card-bg border border-stroke rounded-site p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Dropdown
            label={t('filterLevel')}
            value={filter.level}
            options={levelOptions}
            onChange={(value: string) => {
              setFilter({ ...filter, level: value });
              setPage(1);
            }}
          />
          <Input
            label={t('search')}
            value={filter.search}
            onChange={(e) =>
              setFilter({ ...filter, search: e.target.value })
            }
            placeholder={t('searchPlaceholder')}
          />
        </div>
        {(filter.level || filter.search) && (
          <button
            onClick={() => {
              setFilter({ level: '', search: '' });
              setPage(1);
            }}
            className="mt-3 text-sm text-secondary hover:text-foreground flex items-center gap-1"
          >
            <XIcon size={14} />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="bg-card-bg border border-stroke rounded-site">
          <PageLoading />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card-bg border border-stroke rounded-site p-12 text-center">
          <ErrorIcon size={48} className="text-secondary mx-auto mb-4" />
          <p className="text-secondary text-lg">{t('emptyMessage')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const isExpanded = expandedId === log._id;
            return (
              <div
                key={log._id}
                className="bg-card-bg border border-stroke rounded-site overflow-hidden"
              >
                {/* Summary row */}
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : log._id)
                  }
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-foreground/5 transition-colors"
                >
                  <div className="mt-1">{getLevelIcon(log.level)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getLevelBadge(log.level)}`}
                      >
                        {log.level.toUpperCase()}
                      </span>
                      {log.statusCode && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                          {log.statusCode}
                        </span>
                      )}
                      {log.method && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-info/10 text-info border border-info/20">
                          {log.method}
                        </span>
                      )}
                      {log.source && (
                        <span className="text-xs text-secondary font-mono truncate">
                          {log.source}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground font-medium truncate">
                      {log.message}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-secondary">
                      <span>
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      {log.url && (
                        <span className="font-mono truncate">{log.url}</span>
                      )}
                      {log.session?.ip && <span>IP: {log.session.ip}</span>}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-secondary mt-1" />
                  ) : (
                    <ChevronDown size={18} className="text-secondary mt-1" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-stroke p-4 space-y-4 bg-background/50">
                    {/* User data */}
                    {log.user && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          {t('userData')}
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          {log.user.userId && (
                            <div>
                              <span className="text-secondary">ID: </span>
                              <span className="font-mono">
                                {log.user.userId}
                              </span>
                            </div>
                          )}
                          {log.user.email && (
                            <div>
                              <span className="text-secondary">Email: </span>
                              {log.user.email}
                            </div>
                          )}
                          {log.user.name && (
                            <div>
                              <span className="text-secondary">Name: </span>
                              {log.user.name}
                            </div>
                          )}
                          {log.user.role && (
                            <div>
                              <span className="text-secondary">Role: </span>
                              {log.user.role}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Session data */}
                    {log.session && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          {t('sessionData')}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                          {log.session.ip && (
                            <div>
                              <span className="text-secondary">IP: </span>
                              <span className="font-mono">
                                {log.session.ip}
                              </span>
                            </div>
                          )}
                          {log.session.userAgent && (
                            <div className="col-span-2">
                              <span className="text-secondary">
                                User Agent:{' '}
                              </span>
                              <span className="font-mono text-xs break-all">
                                {log.session.userAgent}
                              </span>
                            </div>
                          )}
                          {log.session.locale && (
                            <div>
                              <span className="text-secondary">Locale: </span>
                              {log.session.locale}
                            </div>
                          )}
                          {log.session.traceId && (
                            <div>
                              <span className="text-secondary">Trace: </span>
                              <span className="font-mono">
                                {log.session.traceId}
                              </span>
                            </div>
                          )}
                          {log.session.referrer && (
                            <div className="col-span-2">
                              <span className="text-secondary">
                                Referrer:{' '}
                              </span>
                              <span className="font-mono text-xs break-all">
                                {log.session.referrer}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stack trace */}
                    {log.stack && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          {t('stackTrace')}
                        </h4>
                        <pre className="bg-background border border-stroke rounded-site p-3 text-xs font-mono overflow-x-auto text-secondary whitespace-pre-wrap break-all">
                          {log.stack}
                        </pre>
                      </div>
                    )}

                    {/* Metadata */}
                    {log.metadata && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">
                          {t('metadata')}
                        </h4>
                        <pre className="bg-background border border-stroke rounded-site p-3 text-xs font-mono overflow-x-auto text-secondary whitespace-pre-wrap break-all">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Delete button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => handleDeleteOne(log._id)}
                        variant="custom"
                        className="bg-error/10 text-error hover:bg-error/20 gap-2"
                      >
                        <TrashIcon size={16} />
                        {t('deleteOne')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            variant="outline"
            size="sm"
          >
            {t('prev')}
          </Button>
          <span className="text-sm text-secondary px-3">
            {page} / {totalPages}
          </span>
          <Button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            variant="outline"
            size="sm"
          >
            {t('next')}
          </Button>
        </div>
      )}

      <ConfirmModal {...modalProps} />
    </div>
  );
}
