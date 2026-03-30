'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type RevenuePoint = {
  label: string;
  revenue: number;
};

interface RevenueOverTimeChartProps {
  data: RevenuePoint[];
  lineColor?: string;
  className?: string;
  title?: string;
}

export function RevenueOverTimeChart({
  data,
  lineColor = '#0ea5e9',
  className,
  title,
}: RevenueOverTimeChartProps) {
  const t = useTranslations('admin.analytics');

  return (
    <div
      className={cn(
        'rounded-site border border-stroke bg-card-bg p-6',
        className,
      )}
    >
      <h2 className="text-xl font-semibold text-foreground mb-6">
        {title || t('revenueOverTime')}
      </h2>

      {/* Chart */}
      <div dir="ltr" className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-stroke)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--secondary)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-stroke)',
                borderRadius: '8px',
                color: 'var(--foreground)',
              }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={lineColor}
              strokeWidth={3}
              dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
