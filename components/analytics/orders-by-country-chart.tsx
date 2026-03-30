'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DataPoint {
  name: string;
  value: number;
}

export function OrdersByCountryChart({
  data,
  className,
  title,
}: {
  data: DataPoint[];
  className?: string;
  title?: string;
}) {
  const t = useTranslations('admin.analytics');

  return (
    <div
      className={cn(
        'rounded-site border border-stroke bg-card-bg p-6',
        className,
      )}
    >
      <h2 className="text-xl font-semibold text-foreground mb-4">
        {title || t('ordersByCountry')}
      </h2>
      <div dir="ltr" className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-stroke)"
              horizontal={false}
            />
            <XAxis
              type="number"
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-stroke)',
                borderRadius: '8px',
                color: 'var(--foreground)',
              }}
              cursor={{ fill: 'var(--border-stroke)', opacity: 0.4 }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Bar
              dataKey="value"
              fill="#ec4899"
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
