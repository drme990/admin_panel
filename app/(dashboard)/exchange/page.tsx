'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { RefreshCw, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import Button from '@/components/ui/button';
import Table from '@/components/ui/table';

interface CronLog {
  _id: string;
  jobName: string;
  status: 'success' | 'failed';
  source: 'cron' | 'manual';
  totalProducts: number;
  updatedCount: number;
  targetCurrencies: string[];
  errorMessage?: string;
  duration: number;
  createdAt: string;
}

export default function ExchangePage() {
  const t = useTranslations('admin.exchange');
  const [logs, setLogs] = useState<CronLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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

  const columns = [
    {
      header: t('table.date'),
      accessor: (log: CronLog) => (
        <span className="text-sm whitespace-nowrap">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: t('table.status'),
      accessor: (log: CronLog) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            log.status === 'success'
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
          }`}
        >
          {log.status === 'success' ? (
            <CheckCircle size={12} />
          ) : (
            <XCircle size={12} />
          )}
          {t(`status.${log.status}`)}
        </span>
      ),
    },
    {
      header: t('table.source'),
      accessor: (log: CronLog) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            log.source === 'cron'
              ? 'bg-blue-500/10 text-blue-500'
              : 'bg-purple-500/10 text-purple-500'
          }`}
        >
          {log.source === 'cron' ? <Clock size={12} /> : <User size={12} />}
          {t(`source.${log.source}`)}
        </span>
      ),
    },
    {
      header: t('table.products'),
      accessor: (log: CronLog) => (
        <span className="text-sm">
          {log.updatedCount}/{log.totalProducts}
        </span>
      ),
    },
    {
      header: t('table.currencies'),
      accessor: (log: CronLog) => (
        <div className="flex flex-wrap gap-1">
          {log.targetCurrencies.map((c) => (
            <span
              key={c}
              className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium"
            >
              {c}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: t('table.duration'),
      accessor: (log: CronLog) => (
        <span className="text-sm text-secondary">
          {formatDuration(log.duration)}
        </span>
      ),
    },
    {
      header: t('table.error'),
      accessor: (log: CronLog) =>
        log.errorMessage ? (
          <span className="text-sm text-red-500">{log.errorMessage}</span>
        ) : (
          <span className="text-sm text-secondary">—</span>
        ),
    },
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
        <div className="flex gap-2">
          <Button onClick={fetchLogs} variant="outline" size="sm">
            <RefreshCw size={16} className="me-1.5" />
            {t('refresh')}
          </Button>

          <Button onClick={handleUpdatePrices} disabled={updating} size="md">
            <RefreshCw
              size={16}
              className={`me-2 ${updating ? 'animate-spin' : ''}`}
            />
            {updating ? t('updating') : t('updatePrices')}
          </Button>
        </div>
      </div>

      {/* Cron Logs */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            {t('cronLogs')}
          </h2>
          <p className="text-secondary text-sm">{t('cronLogsDescription')}</p>
        </div>

        <Table<CronLog>
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage={t('noLogs')}
        />
      </div>
    </div>
  );
}
