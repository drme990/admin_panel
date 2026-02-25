'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ActivityLog } from '@/types/ActivityLog';
import { Filter, RefreshCw } from 'lucide-react';
import Table from '@/components/ui/table';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    action: '',
    resource: '',
  });
  const t = useTranslations('admin.logs');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (filter.action) params.append('action', filter.action);
        if (filter.resource) params.append('resource', filter.resource);
        params.append('limit', '100');

        const res = await fetch(`/api/logs?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setLogs(data.data.logs);
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.action) params.append('action', filter.action);
      if (filter.resource) params.append('resource', filter.resource);
      params.append('limit', '100');

      const res = await fetch(`/api/logs?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLogs(data.data.logs);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'bg-green-500/10 text-green-500';
      case 'update':
        return 'bg-blue-500/10 text-blue-500';
      case 'delete':
        return 'bg-red-500/10 text-red-500';
      case 'login':
        return 'bg-purple-500/10 text-purple-500';
      case 'logout':
        return 'bg-gray-500/10 text-gray-500';
      default:
        return 'bg-secondary/10 text-secondary';
    }
  };

  const getResourceColor = (resource: string) => {
    switch (resource) {
      case 'product':
        return 'bg-success/10 text-success';
      case 'user':
        return 'bg-blue-500/10 text-blue-500';
      case 'auth':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-secondary/10 text-secondary';
    }
  };

  const columns = [
    {
      header: t('table.user'),
      accessor: (log: ActivityLog) => (
        <div>
          <p className="font-medium text-sm">{log.userName}</p>
          <p className="text-secondary text-xs">{log.userEmail}</p>
        </div>
      ),
    },
    {
      header: t('table.action'),
      accessor: (log: ActivityLog) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}
        >
          {t(`actions.${log.action}`)}
        </span>
      ),
    },
    {
      header: t('table.resource'),
      accessor: (log: ActivityLog) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getResourceColor(log.resource)}`}
        >
          {t(`resources.${log.resource}`)}
        </span>
      ),
    },
    {
      header: t('table.details'),
      accessor: (log: ActivityLog) => (
        <span className="text-sm max-w-md block">{log.details}</span>
      ),
    },
    {
      header: t('table.date'),
      accessor: (log: ActivityLog) => (
        <span className="text-secondary text-sm">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const actionOptions = [
    { value: '', label: t('actions.allActions') },
    { value: 'create', label: t('actions.create') },
    { value: 'update', label: t('actions.update') },
    { value: 'delete', label: t('actions.delete') },
    { value: 'login', label: t('actions.login') },
    { value: 'logout', label: t('actions.logout') },
  ];

  const resourceOptions = [
    { value: '', label: t('resources.allResources') },
    { value: 'product', label: t('resources.product') },
    { value: 'user', label: t('resources.user') },
    { value: 'auth', label: t('resources.auth') },
    { value: 'referral', label: t('resources.referral') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <Button onClick={fetchLogs} className="flex gap-2">
          <RefreshCw size={18} />
          {t('refresh')}
        </Button>
      </div>

      <div className="bg-card-bg border border-stroke rounded-site p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={18} />
          <h3 className="font-semibold">{t('filters.title')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Dropdown
            label={t('filters.actionLabel')}
            value={filter.action}
            options={actionOptions}
            onChange={(value: string) =>
              setFilter({ ...filter, action: value })
            }
          />
          <Dropdown
            label={t('filters.resourceLabel')}
            value={filter.resource}
            options={resourceOptions}
            onChange={(value: string) =>
              setFilter({ ...filter, resource: value })
            }
          />
        </div>
      </div>

      <Table<ActivityLog>
        columns={columns}
        data={logs}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />
    </div>
  );
}
