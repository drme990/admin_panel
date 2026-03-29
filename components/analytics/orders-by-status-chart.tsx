'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DataPoint {
  name: string;
  value: number;
}

const COLORS = [
  '#eab308',
  '#3b82f6',
  '#22c55e',
  '#10b981',
  '#ef4444',
  '#a855f7',
  '#6b7280',
];

export function OrdersByStatusChart({
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
        {title || t('ordersByStatus')}
      </h2>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              dataKey="value"
              nameKey="name"
              outerRadius={110}
              label={({ name, value }) => `${name}: ${value}`}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`${entry.name}-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border-stroke)',
                borderRadius: '8px',
                color: 'var(--foreground)',
              }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
