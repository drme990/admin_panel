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

interface DataPoint {
  name: string;
  value: number;
}

export function TopProductsChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-stroke)" />
          <XAxis
            dataKey="name"
            stroke="var(--foreground)"
            tickFormatter={(v) => String(v).slice(0, 14)}
          />
          <YAxis stroke="var(--foreground)" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border-stroke)',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="value" fill="#06b6d4" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
