'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface DataPoint {
  name: string;
  value: number;
}

const COLORS = ['#10b981', '#f59e0b'];

export function PaymentSplitChart({
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
        {title || t('paymentSplit')}
      </h2>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={100}
              dataKey="value"
              nameKey="name"
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
