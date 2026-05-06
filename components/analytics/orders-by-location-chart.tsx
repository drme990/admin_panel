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

export default function OrdersByLocationChart({
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
      {/* Header */}
      <h2 className="text-xl font-semibold text-foreground mb-4">
        {title || t('ordersByLocation')}
      </h2>

      {/* Chart */}
      <div dir="ltr" className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 20, bottom: 0 }}
          >
            {/* Grid */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--stroke)"
              horizontal={false}
            />

            {/* X Axis */}
            <XAxis
              type="number"
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />

            {/* Y Axis */}
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={110}
            />

            {/* Tooltip */}
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-site)',
                color: 'var(--foreground)',
              }}
              cursor={{
                fill: 'var(--stroke)',
                opacity: 0.3,
              }}
              itemStyle={{
                color: 'var(--foreground)',
              }}
            />

            {/* Bar */}
            <Bar
              dataKey="value"
              fill="var(--primary)"
              radius={[0, 6, 6, 0]}
              barSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
