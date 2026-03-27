'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Loading from '@/components/ui/loading';
import { OrdersByStatusChart } from '@/components/analytics/orders-by-status-chart';
import { PaymentSplitChart } from '@/components/analytics/payment-split-chart';
import { TopProductsChart } from '@/components/analytics/top-products-chart';
import { OrdersByCountryChart } from '@/components/analytics/orders-by-country-chart';
import { OrdersByWeekdayChart } from '@/components/analytics/orders-by-weekday-chart';
import { RevenueOverTimeChart } from '@/components/analytics/revenue-over-time-chart';

type DataPoint = { name: string; value: number };
type RevenuePoint = { label: string; revenue: number };

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

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/api/stats/analytics');
        const payload = await response.json();
        if (payload?.success) {
          setData(payload.data as AnalyticsResponse);
        }
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const revenueData = useMemo(
    () => ({
      day: data?.revenueByDay || [],
      month: data?.revenueByMonth || [],
    }),
    [data],
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-site border border-stroke bg-card-bg p-6 text-sm text-secondary">
        {t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('description')}</p>
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {t('revenueOverTime')}
          </h2>
        </div>
        <RevenueOverTimeChart
          dayData={revenueData.day}
          monthData={revenueData.month}
          dayLabel={t('period.day')}
          monthLabel={t('period.month')}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-site border border-stroke bg-card-bg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('ordersByStatus')}
          </h2>
          <OrdersByStatusChart data={data.ordersByStatus} />
        </div>

        <div className="rounded-site border border-stroke bg-card-bg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('paymentSplit')}
          </h2>
          <PaymentSplitChart data={data.paymentTypeBreakdown} />
        </div>
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">
          {t('topProducts')}
        </h2>
        <TopProductsChart data={data.topProducts} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-site border border-stroke bg-card-bg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('ordersByCountry')}
          </h2>
          <OrdersByCountryChart data={data.ordersByCountry} />
        </div>

        <div className="rounded-site border border-stroke bg-card-bg p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            {t('ordersByWeekday')}
          </h2>
          <OrdersByWeekdayChart data={data.ordersByWeekday} />
        </div>
      </div>
    </div>
  );
}
