'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

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

export function OrdersByStatusChart({ data }: { data: DataPoint[] }) {
  return (
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
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
