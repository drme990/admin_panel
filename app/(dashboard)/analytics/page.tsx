'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Loading from '@/components/ui/loading';
import Dropdown from '@/components/ui/dropdown';
import { OrdersByStatusChart } from '@/components/analytics/orders-by-status-chart';
import { PaymentSplitChart } from '@/components/analytics/payment-split-chart';
import { TopProductsChart } from '@/components/analytics/top-products-chart';
import { OrdersByCountryChart } from '@/components/analytics/orders-by-country-chart';
import { OrdersByWeekdayChart } from '@/components/analytics/orders-by-weekday-chart';
import { RevenueOverTimeChart } from '@/components/analytics/revenue-over-time-chart';

type DataPoint = { name: string; value: number };
type RevenuePoint = { label: string; revenue: number };
type PeriodFilter = '7d' | '30d' | '90d' | '12m';
type StatusFilter =
  | 'all'
  | 'pending'
  | 'processing'
  | 'partial-paid'
  | 'paid'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

interface AnalyticsResponse {
  revenueByDay: RevenuePoint[];
  revenueByMonth: RevenuePoint[];
  ordersByStatus: DataPoint[];
  paymentTypeBreakdown: DataPoint[];
  topProducts: DataPoint[];
  ordersByCountry: DataPoint[];
  ordersByWeekday: DataPoint[];
}

export default function AnalyticsPage() {
  const t = useTranslations('admin.analytics');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);

  const [period, setPeriod] = useState<PeriodFilter>('30d');
  const [status, setStatus] = useState<StatusFilter>('all');

  const periodOptions = useMemo(
    () => [
      { value: '7d' as const, label: 'Last 7 Days' },
      { value: '30d' as const, label: 'Last 30 Days' },
      { value: '90d' as const, label: 'Last 90 Days' },
      { value: '12m' as const, label: 'Last 12 Months' },
    ],
    [],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'all' as const, label: 'All Statuses' },
      { value: 'pending' as const, label: 'Pending' },
      { value: 'processing' as const, label: 'Processing' },
      { value: 'partial-paid' as const, label: 'Partial Paid' },
      { value: 'paid' as const, label: 'Paid' },
      { value: 'completed' as const, label: 'Completed' },
      { value: 'cancelled' as const, label: 'Cancelled' },
      { value: 'refunded' as const, label: 'Refunded' },
      { value: 'failed' as const, label: 'Failed' },
    ],
    [],
  );

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        let days = 30;
        let months = 12;

        if (period === '7d') {
          days = 7;
          months = 1;
        } else if (period === '30d') {
          days = 30;
          months = 1;
        } else if (period === '90d') {
          days = 90;
          months = 3;
        } else if (period === '12m') {
          days = 365;
          months = 12;
        }

        const response = await fetch(
          `/api/stats/analytics?days=${days}&months=${months}&status=${status}`,
        );
        const payload = await response.json();
        if (payload?.success) {
          setData(payload.data as AnalyticsResponse);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [period, status]);

  const revenueData =
    period === '12m' ? data?.revenueByMonth || [] : data?.revenueByDay || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>

        {/* Global Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:min-w-105">
          <Dropdown
            value={period}
            options={periodOptions}
            onChange={setPeriod}
            className="sm:w-48"
          />

          <Dropdown
            value={status}
            options={statusOptions}
            onChange={setStatus}
            className="sm:w-48"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loading size="lg" />
        </div>
      ) : !data ? (
        <div className="rounded-site border border-stroke bg-card-bg p-6 text-sm text-secondary">
          {t('loadError')}
        </div>
      ) : (
        <>
          <RevenueOverTimeChart data={revenueData} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <OrdersByStatusChart data={data.ordersByStatus} />
            <PaymentSplitChart data={data.paymentTypeBreakdown} />
          </div>

          <TopProductsChart data={data.topProducts} />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <OrdersByCountryChart data={data.ordersByCountry} />
            <OrdersByWeekdayChart data={data.ordersByWeekday} />
          </div>
        </>
      )}
    </div>
  );
}
