'use client';

import { useMemo, useState } from 'react';
import Tabs from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type RevenuePeriod = 'day' | 'month';

type RevenuePoint = {
  label: string;
  revenue: number;
};

interface RevenueOverTimeChartProps {
  dayData: RevenuePoint[];
  monthData: RevenuePoint[];
  dayLabel: string;
  monthLabel: string;
  initialPeriod?: RevenuePeriod;
  lineColor?: string;
}

export function RevenueOverTimeChart({
  dayData,
  monthData,
  dayLabel,
  monthLabel,
  initialPeriod = 'day',
  lineColor = '#0ea5e9',
}: RevenueOverTimeChartProps) {
  const [period, setPeriod] = useState<RevenuePeriod>(initialPeriod);

  const options = useMemo(
    () => [
      { value: 'day' as const, label: dayLabel },
      { value: 'month' as const, label: monthLabel },
    ],
    [dayLabel, monthLabel],
  );

  const data = period === 'day' ? dayData : monthData;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Tabs value={period} onChange={setPeriod} options={options} />

      {/* Chart */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-stroke)"
            />
            <XAxis dataKey="label" stroke="var(--foreground)" />
            <YAxis stroke="var(--foreground)" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--background)',
                border: '1px solid var(--border-stroke)',
                borderRadius: '8px',
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke={lineColor}
              strokeWidth={3}
              dot={{ r: 2 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}