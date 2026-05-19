'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Tabs from '@/components/ui/tabs';
import Table from '@/components/ui/table';
import Input from '@/components/ui/input';
import Pagination from '@/components/ui/pagination';
import Button from '@/components/ui/button';

type RefTrackerAction =
  | 'session_created'
  | 'navigate_products'
  | 'select_product'
  | 'pay_now'
  | 'checkout_choice'
  | 'proceed_to_payment';

type RefTrackerAppId = 'manasik' | 'ghadaq';

interface RefTrackerEvent {
  _id: string;
  appId: RefTrackerAppId;
  sessionNumber: string;
  userId?: string;
  ref?: string;
  ip?: string;
  action: RefTrackerAction;
  path: string;
  productName?: string;
  buttonLabel?: string;
  choice?: string;
  createdAt: string;
}

type TabOption = { value: string; label: string };

const appOptions: TabOption[] = [
  { value: '', label: 'all' },
  { value: 'manasik', label: 'manasik' },
  { value: 'ghadaq', label: 'ghadaq' },
];

const actionOptions: TabOption[] = [
  { value: '', label: 'all' },
  { value: 'session_created', label: 'session_created' },
  { value: 'navigate_products', label: 'navigate_products' },
  { value: 'select_product', label: 'select_product' },
  { value: 'pay_now', label: 'pay_now' },
  { value: 'checkout_choice', label: 'checkout_choice' },
  { value: 'proceed_to_payment', label: 'proceed_to_payment' },
];

export default function RefTrackerPage() {
  const t = useTranslations('admin.refTracker');
  const locale = useLocale();

  const [events, setEvents] = useState<RefTrackerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    appId: '',
    action: '',
    sessionNumber: '',
    userId: '',
    ref: '',
    ip: '',
    productName: '',
  });

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '25');
      if (filters.appId) params.set('appId', filters.appId);
      if (filters.action) params.set('action', filters.action);
      if (filters.sessionNumber)
        params.set('sessionNumber', filters.sessionNumber);
      if (filters.userId) params.set('userId', filters.userId);
      if (filters.ref) params.set('ref', filters.ref);
      if (filters.ip) params.set('ip', filters.ip);
      if (filters.productName) params.set('productName', filters.productName);

      const response = await fetch(`/api/ref-tracker?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setEvents(data.data.events || []);
        setTotalPages(data.data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error('Error fetching ref tracker events:', error);
    } finally {
      setLoading(false);
    }
  }, [
    filters.action,
    filters.appId,
    filters.ip,
    filters.productName,
    filters.ref,
    filters.sessionNumber,
    filters.userId,
    page,
  ]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const translateApp = (appId: string) => {
    if (appId === 'manasik') return t('app.manasik');
    if (appId === 'ghadaq') return t('app.ghadaq');
    return t('app.all');
  };

  const actionLabel = (action: RefTrackerAction) => {
    switch (action) {
      case 'session_created':
        return t('actions.sessionCreated');
      case 'navigate_products':
        return t('actions.navigateProducts');
      case 'select_product':
        return t('actions.selectProduct');
      case 'pay_now':
        return t('actions.payNow');
      case 'checkout_choice':
        return t('actions.checkoutChoice');
      case 'proceed_to_payment':
        return t('actions.proceedToPayment');
      default:
        return action;
    }
  };

  const choiceLabel = (choice?: string) => {
    switch (choice) {
      case 'full':
        return t('choices.full');
      case 'half':
        return t('choices.half');
      case 'custom':
        return t('choices.custom');
      case 'custom_amount':
        return t('choices.customAmount');
      case 'custom_quantity_keep':
        return t('choices.customQuantityKeep');
      case 'custom_quantity_set_one':
        return t('choices.customQuantitySetOne');
      case 'reservation_details':
        return t('choices.reservationDetails');
      default:
        return choice || '—';
    }
  };

  const columns = [
    {
      header: t('table.createdAt'),
      accessor: (event: RefTrackerEvent) => (
        <span className="text-sm text-secondary">
          {new Date(event.createdAt).toLocaleString(locale)}
        </span>
      ),
    },
    {
      header: t('table.app'),
      accessor: (event: RefTrackerEvent) => (
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
          {translateApp(event.appId)}
        </span>
      ),
    },
    {
      header: t('table.sessionNumber'),
      accessor: (event: RefTrackerEvent) => (
        <span className="font-mono text-xs">{event.sessionNumber}</span>
      ),
    },
    {
      header: t('table.userId'),
      accessor: (event: RefTrackerEvent) => (
        <span className="font-mono text-xs">{event.userId || '—'}</span>
      ),
    },
    {
      header: t('table.ref'),
      accessor: (event: RefTrackerEvent) => (
        <span className="font-mono text-xs">{event.ref || '—'}</span>
      ),
    },
    {
      header: t('table.ip'),
      accessor: (event: RefTrackerEvent) => (
        <span className="font-mono text-xs">{event.ip || '—'}</span>
      ),
    },
    {
      header: t('table.action'),
      accessor: (event: RefTrackerEvent) => (
        <span className="rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-secondary">
          {actionLabel(event.action)}
        </span>
      ),
    },
    {
      header: t('table.path'),
      accessor: (event: RefTrackerEvent) => (
        <span className="text-xs text-foreground break-all">{event.path}</span>
      ),
    },
    {
      header: t('table.productName'),
      accessor: (event: RefTrackerEvent) => (
        <span className="text-sm">{event.productName || '—'}</span>
      ),
    },
    {
      header: t('table.buttonLabel'),
      accessor: (event: RefTrackerEvent) => (
        <span className="text-sm">{event.buttonLabel || '—'}</span>
      ),
    },
    {
      header: t('table.choice'),
      accessor: (event: RefTrackerEvent) => (
        <span className="text-sm">{choiceLabel(event.choice)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>

        <Button onClick={() => void fetchEvents()} className="shrink-0">
          {t('refresh')}
        </Button>
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs
            value={filters.appId}
            onChange={(value) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, appId: value }));
            }}
            options={appOptions.map((option) => ({
              value: option.value,
              label: option.value ? translateApp(option.value) : t('app.all'),
            }))}
            size="sm"
          />

          <Tabs
            value={filters.action}
            onChange={(value) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, action: value }));
            }}
            options={actionOptions.map((option) => ({
              value: option.value,
              label: option.value
                ? actionLabel(option.value as RefTrackerAction)
                : t('actions.all'),
            }))}
            size="sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Input
            value={filters.sessionNumber}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({
                ...prev,
                sessionNumber: e.target.value,
              }));
            }}
            placeholder={t('filters.session')}
          />
          <Input
            value={filters.userId}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, userId: e.target.value }));
            }}
            placeholder={t('filters.user')}
          />
          <Input
            value={filters.ref}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, ref: e.target.value }));
            }}
            placeholder={t('filters.ref')}
          />
          <Input
            value={filters.ip}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, ip: e.target.value }));
            }}
            placeholder={t('filters.ip')}
          />
          <Input
            value={filters.productName}
            onChange={(e) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, productName: e.target.value }));
            }}
            placeholder={t('filters.product')}
          />
        </div>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setPage(1);
              setFilters({
                appId: '',
                action: '',
                sessionNumber: '',
                userId: '',
                ref: '',
                ip: '',
                productName: '',
              });
            }}
          >
            {t('filters.clear')}
          </Button>
        </div>
      </div>

      <Table<RefTrackerEvent>
        columns={columns}
        data={events}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      {!loading && totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
