'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuRefreshCw as RefreshCw,
  LuCircleCheck as CheckCircle,
  LuCircleX as XCircle,
  LuClock as Clock,
  LuUser as User,
  LuLock as LockIcon,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';

interface PriceChange {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  sizeNameAr: string;
  sizeNameEn: string;
  currencyCode: string;
  prevValue: number;
  newValue: number;
  changed: boolean;
  isManual: boolean;
}

interface CronLog {
  _id: string;
  jobName: string;
  status: 'success' | 'failed';
  source: 'cron' | 'manual';
  totalProducts: number;
  updatedCount: number;
  totalCoupons?: number;
  updatedCouponCount?: number;
  targetCurrencies: string[];
  errorMessage?: string;
  duration: number;
  priceChanges?: PriceChange[];
  createdAt: string;
}

type StatusFilter = 'all' | 'changed' | 'not_changed' | 'manual';

export default function ExchangePage() {
  const t = useTranslations('admin.exchange');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CronLog | null>(null);

  // Modal filters
  const [productFilter, setProductFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/exchange/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching exchange logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleUpdatePrices = async () => {
    try {
      setUpdating(true);
      const res = await fetch('/api/exchange/update-prices', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        toast.success(
          `${t('updateSuccess')} (${data.updatedCount}/${data.totalProducts})`,
        );
        fetchLogs();
      } else {
        toast.error(data.error || t('updateFailed'));
      }
    } catch {
      toast.error(t('updateFailed'));
    } finally {
      setUpdating(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const openLogModal = (log: CronLog) => {
    setSelectedLog(log);
    setProductFilter('all');
    setStatusFilter('all');
    setCurrencyFilter('all');
  };

  const closeLogModal = () => {
    setSelectedLog(null);
  };

  // Build filter option lists from the selected log's priceChanges
  const productOptions = useMemo(() => {
    if (!selectedLog?.priceChanges) return [];
    const map = new Map<string, string>();
    for (const c of selectedLog.priceChanges) {
      const name = isRTL ? c.productNameAr : c.productNameEn;
      if (name) map.set(c.productId, name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [selectedLog, isRTL]);

  const currencyOptions = useMemo(() => {
    if (!selectedLog?.priceChanges) return [];
    const set = new Set<string>();
    for (const c of selectedLog.priceChanges) set.add(c.currencyCode);
    return Array.from(set).sort();
  }, [selectedLog]);

  // Apply all filters
  const filteredChanges = useMemo(() => {
    if (!selectedLog?.priceChanges) return [];
    return selectedLog.priceChanges.filter((c) => {
      if (productFilter !== 'all' && c.productId !== productFilter) return false;
      if (currencyFilter !== 'all' && c.currencyCode !== currencyFilter) return false;
      if (statusFilter === 'changed' && !c.changed) return false;
      if (statusFilter === 'not_changed' && (c.changed || c.isManual)) return false;
      if (statusFilter === 'manual' && !c.isManual) return false;
      return true;
    });
  }, [selectedLog, productFilter, statusFilter, currencyFilter]);

  // Group filtered changes by product + size
  const groupedChanges = useMemo(() => {
    const groups: Record<string, {
      productId: string;
      productNameAr: string;
      productNameEn: string;
      sizeNameAr: string;
      sizeNameEn: string;
      entries: PriceChange[];
    }> = {};
    for (const change of filteredChanges) {
      const key = `${change.productId}-${change.sizeNameEn}`;
      if (!groups[key]) {
        groups[key] = {
          productId: change.productId,
          productNameAr: change.productNameAr,
          productNameEn: change.productNameEn,
          sizeNameAr: change.sizeNameAr,
          sizeNameEn: change.sizeNameEn,
          entries: [],
        };
      }
      groups[key].entries.push(change);
    }
    return Object.values(groups);
  }, [filteredChanges]);

  // Stats for the modal header
  const modalStats = useMemo(() => {
    if (!selectedLog?.priceChanges) return { total: 0, changed: 0, notChanged: 0, manual: 0 };
    const total = selectedLog.priceChanges.length;
    const changed = selectedLog.priceChanges.filter((c) => c.changed).length;
    const manual = selectedLog.priceChanges.filter((c) => c.isManual).length;
    return { total, changed, notChanged: total - changed - manual, manual };
  }, [selectedLog]);

  const hasPriceChangesData = Array.isArray(selectedLog?.priceChanges);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-secondary">{t('description')}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw size={16} className="me-1.5" />
            {t('refresh')}
          </Button>

          <Button onClick={handleUpdatePrices} disabled={updating} size="sm">
            <RefreshCw
              size={16}
              className={`me-2 ${updating ? 'animate-spin' : ''}`}
            />
            {updating ? t('updating') : t('updatePrices')}
          </Button>
        </div>
      </div>

      {/* Logs List */}
      {loading ? (
        <div className="bg-card-bg border border-stroke rounded-site p-12 text-center text-secondary">
          {t('loading')}
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-card-bg border border-stroke rounded-site p-12 text-center text-secondary">
          {t('noLogs')}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const hasChanges = (log.priceChanges?.length ?? 0) > 0;
            const logChangedCount = log.priceChanges?.filter((c) => c.changed).length ?? 0;
            const logDate = new Date(log.createdAt);
            const dateStr = logDate.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
            const timeStr = logDate.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

            return (
              <button
                key={log._id}
                type="button"
                onClick={() => openLogModal(log)}
                className="w-full bg-card-bg border border-stroke rounded-site px-4 py-3 hover:bg-background hover:border-primary/30 transition-all text-start group"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Status dot */}
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${log.status === 'success'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                      }`}
                  >
                    {log.status === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    {t(`status.${log.status}`)}
                  </span>

                  {/* Source badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${log.source === 'cron'
                      ? 'bg-blue-500/10 text-blue-500'
                      : 'bg-purple-500/10 text-purple-500'
                      }`}
                  >
                    {log.source === 'cron' ? <Clock size={10} /> : <User size={10} />}
                    {t(`source.${log.source}`)}
                  </span>

                  {/* Changed count badge (only if there are changes) */}
                  {hasChanges && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 shrink-0">
                      {logChangedCount} {t('changed')}
                    </span>
                  )}

                  {/* Duration (push to end) */}
                  <span className="text-xs text-secondary ms-auto shrink-0 tabular-nums">
                    {formatDuration(log.duration)}
                  </span>
                </div>

                {/* Second row: date + products */}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {dateStr}
                    <span className="text-secondary font-normal mx-1">·</span>
                    <span className="text-secondary font-normal">{timeStr}</span>
                  </span>
                  <span className="text-xs text-secondary">
                    {log.updatedCount}/{log.totalProducts} {t('table.products').toLowerCase()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Log Details Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={closeLogModal}
        title={selectedLog ? `${t('logDetails')} — ${new Date(selectedLog.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US')}` : ''}
        size="xl"
        contentClassName="p-0"
      >
        {selectedLog && (
          <div className="flex flex-col">
            {/* Stats bar */}
            {hasPriceChangesData && (
              <div className="flex items-center gap-3 px-4 py-3 bg-background/50 border-b border-stroke flex-wrap">
                <span className="text-xs text-secondary">{t('summary')}:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stroke/50 text-secondary">
                  {t('filter.all')}: {modalStats.total}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                  {t('changed')}: {modalStats.changed}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                  {t('notChanged')}: {modalStats.notChanged}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stroke/50 text-secondary">
                  {t('manual')}: {modalStats.manual}
                </span>
              </div>
            )}

            {/* Filters */}
            {hasPriceChangesData && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-stroke flex-wrap">
                {/* Product filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-secondary whitespace-nowrap">
                    {t('table.product')}:
                  </label>
                  <select
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-stroke bg-card-bg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">{t('filter.all')}</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Currency filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-secondary whitespace-nowrap">
                    {t('table.currency')}:
                  </label>
                  <select
                    value={currencyFilter}
                    onChange={(e) => setCurrencyFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-stroke bg-card-bg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">{t('filter.all')}</option>
                    {currencyOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-secondary whitespace-nowrap">
                    {t('table.state')}:
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-2 py-1 rounded-lg border border-stroke bg-card-bg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="all">{t('filter.all')}</option>
                    <option value="changed">{t('changed')}</option>
                    <option value="not_changed">{t('notChanged')}</option>
                    <option value="manual">{t('manual')}</option>
                  </select>
                </div>

                {/* Result count */}
                <span className="text-xs text-secondary ms-auto">
                  {filteredChanges.length} {t('entries')}
                </span>
              </div>
            )}

            {/* Content */}
            {selectedLog.status === 'failed' ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-red-500">
                  {selectedLog.errorMessage || t('errorGeneric')}
                </p>
              </div>
            ) : !hasPriceChangesData ? (
              <div className="px-4 py-8 text-center text-sm text-secondary">
                {t('oldLogNoData')}
              </div>
            ) : filteredChanges.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-secondary">
                {t('noMatchingEntries')}
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-stroke">
                {groupedChanges.map((group) => (
                  <div key={`${group.productId}-${group.sizeNameEn}`}>
                    {/* Product + Size sub-header */}
                    <div className="px-4 py-2 bg-background/30 flex items-center gap-2 sticky top-0 z-10">
                      <span className="text-sm font-medium text-foreground">
                        {isRTL ? group.productNameAr : group.productNameEn}
                      </span>
                      <span className="text-xs text-secondary">
                        — {isRTL ? group.sizeNameAr : group.sizeNameEn}
                      </span>
                    </div>

                    {/* 4-column table: CURRENCY, PREV, NEW, STATE */}
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-stroke/50">
                          <th className="text-start px-4 py-1.5 text-xs font-semibold text-secondary">
                            {t('table.currency')}
                          </th>
                          <th className="text-end px-4 py-1.5 text-xs font-semibold text-secondary">
                            {t('table.prevValue')}
                          </th>
                          <th className="text-end px-4 py-1.5 text-xs font-semibold text-secondary">
                            {t('table.newValue')}
                          </th>
                          <th className="text-center px-4 py-1.5 text-xs font-semibold text-secondary">
                            {t('table.state')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stroke/30">
                        {group.entries.map((change, idx) => (
                          <tr
                            key={`${change.currencyCode}-${idx}`}
                            className={change.changed ? 'bg-amber-500/5' : ''}
                          >
                            {/* Currency */}
                            <td className="px-4 py-1.5">
                              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                                {change.currencyCode}
                              </span>
                            </td>
                            {/* Previous value */}
                            <td className="px-4 py-1.5 text-end text-sm text-secondary tabular-nums">
                              {change.prevValue.toLocaleString()}
                            </td>
                            {/* New value */}
                            <td className="px-4 py-1.5 text-end text-sm tabular-nums">
                              {change.changed ? (
                                <span className="text-foreground font-medium">
                                  {change.newValue.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-secondary">
                                  {change.newValue.toLocaleString()}
                                </span>
                              )}
                            </td>
                            {/* State */}
                            <td className="px-4 py-1.5 text-center">
                              {change.isManual ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-stroke/50 text-secondary">
                                  <LockIcon size={10} />
                                  {t('manual')}
                                </span>
                              ) : change.changed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500">
                                  {t('changed')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                  {t('notChanged')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
