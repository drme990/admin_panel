'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuChevronLeft,
  LuChevronRight,
  LuCalendarDays,
  LuShoppingCart,
  LuClipboardCheck,
} from 'react-icons/lu';

import Table from '@/components/ui/table';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import ExecutionStats from './components/execution-stats';

import { Order } from '@/types/Order';

interface ExecutionStatsData {
  totalOrders: number;
  totalItems: number;
  byProduct: Array<{
    productName: string;
    productNameAr: string;
    quantity: number;
    percentage: number;
  }>;
}

interface ExecutionResponse {
  success: boolean;
  data?: {
    orders: Order[];
    stats: ExecutionStatsData;
    date: string;
  };
  error?: string;
}

function toIsoDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateForDisplay(dateStr: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split('-');
  if (locale === 'ar') {
    return `${day}/${month}/${year}`;
  }
  return `${month}/${day}/${year}`;
}

export default function ExecutionPage() {
  const t = useTranslations('execution');
  const locale = useLocale();

  const [selectedDate, setSelectedDate] = useState<string>(toIsoDateInput(new Date()));
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manasik' | 'ghadaq'>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<ExecutionStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchExecution = useCallback(
    async (date: string, source: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('date', date);
        if (source !== 'all') params.set('source', source);

        const res = await fetch(`/api/execution?${params.toString()}`);
        const data: ExecutionResponse = await res.json();

        if (!data.success || !data.data) {
          toast.error(data.error || t('messages.loadFailed'));
          setOrders([]);
          setStats(null);
          return;
        }

        setOrders(data.data.orders);
        setStats(data.data.stats);
      } catch {
        toast.error(t('messages.loadFailed'));
        setOrders([]);
        setStats(null);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void fetchExecution(selectedDate, sourceFilter);
  }, [selectedDate, sourceFilter, fetchExecution]);

  const handlePrevDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() - 1);
    setSelectedDate(toIsoDateInput(d));
  };

  const handleNextDay = () => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + 1);
    setSelectedDate(toIsoDateInput(d));
  };

  const handleToday = () => {
    setSelectedDate(toIsoDateInput(new Date()));
  };

  const isToday = selectedDate === toIsoDateInput(new Date());

  const columns = useMemo(
    () => [
      {
        header: t('table.orderNumber'),
        accessor: (order: Order) => (
          <span className="font-semibold text-foreground">{order.orderNumber}</span>
        ),
        className: 'min-w-32',
      },
      {
        header: t('table.customer'),
        accessor: (order: Order) => (
          <div className="flex flex-col gap-0.5 min-w-44">
            <span className="font-medium text-foreground">
              {order.billingData?.fullName || '-'}
            </span>
            <span className="text-xs text-secondary">{order.billingData?.phone || '-'}</span>
          </div>
        ),
      },
      {
        header: t('table.items'),
        accessor: (order: Order) => {
          const items = order.items || [];
          const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          return (
            <div className="flex flex-col gap-0.5 min-w-56">
              <span className="text-sm text-secondary">
                {totalQty} {t('table.itemsCount')}
              </span>
              <div className="flex flex-wrap gap-1">
                {items.slice(0, 3).map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-background text-secondary border border-stroke"
                  >
                    {locale === 'ar' ? item.productName?.ar : item.productName?.en}
                    {item.quantity > 1 ? ` x${item.quantity}` : ''}
                  </span>
                ))}
                {items.length > 3 && (
                  <span className="text-[10px] text-secondary">+{items.length - 3}</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: t('table.total'),
        accessor: (order: Order) => (
          <span className="font-semibold text-foreground whitespace-nowrap">
            {order.totalAmount?.toLocaleString()} {order.currency}
          </span>
        ),
        className: 'min-w-28',
      },
      {
        header: t('table.status'),
        accessor: (order: Order) => {
          const statusColors: Record<string, string> = {
            pending: 'bg-yellow-500/10 text-yellow-500',
            processing: 'bg-blue-500/10 text-blue-500',
            'partial-paid': 'bg-purple-500/10 text-purple-500',
            paid: 'bg-emerald-500/10 text-emerald-500',
            completed: 'bg-emerald-500/10 text-emerald-600',
            failed: 'bg-red-500/10 text-red-500',
            refunded: 'bg-gray-500/10 text-gray-500',
            cancelled: 'bg-red-500/10 text-red-400',
          };
          return (
            <span
              className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-500/10 text-gray-500'}`}
            >
              {order.status}
            </span>
          );
        },
        className: 'min-w-28',
      },
      {
        header: t('table.source'),
        accessor: (order: Order) => (
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 uppercase">
            {order.source || '-'}
          </span>
        ),
        className: 'min-w-20',
      },
    ],
    [t, locale],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary mt-1">{t('description')}</p>
        </div>
      </div>

      {/* Date navigation + filters */}
      <div className="bg-card-bg border border-stroke rounded-site p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Day navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevDay}>
              <LuChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-background rounded-lg border border-stroke">
              <LuCalendarDays className="w-4 h-4 text-secondary" />
              <span className="text-sm font-medium text-foreground min-w-[100px] text-center">
                {formatDateForDisplay(selectedDate, locale)}
                {isToday && (
                  <span className="ml-1.5 text-xs text-primary">
                    {t('todayLabel')}
                  </span>
                )}
              </span>
            </div>

            <Button variant="outline" size="sm" onClick={handleNextDay}>
              <LuChevronRight className="w-4 h-4" />
            </Button>

            <Button
              variant={isToday ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToday}
              className="ml-1"
            >
              {t('todayButton')}
            </Button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="w-40"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'all' | 'manasik' | 'ghadaq')}
              className="h-9 px-3 rounded-lg border border-stroke bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">{t('filters.allSources')}</option>
              <option value="manasik">{t('filters.manasik')}</option>
              <option value="ghadaq">{t('filters.ghadaq')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <ExecutionStats stats={stats} loading={loading} />

      {/* Orders table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <LuClipboardCheck className="w-5 h-5 text-primary" />
            {t('ordersTitle')}
          </h2>
          <span className="text-sm text-secondary">
            {orders.length} {t('ordersCount')}
          </span>
        </div>

        <Table<Order>
          columns={columns}
          data={orders}
          loading={loading}
          emptyMessage={t('emptyMessage')}
        />
      </div>
    </div>
  );
}
