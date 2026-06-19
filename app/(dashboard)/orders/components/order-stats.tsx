'use client';

import { useTranslations } from 'next-intl';
import { LuPackage, LuShoppingBag } from 'react-icons/lu';

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  color: string;
  totalItems: number;
  percentage: number;
}

interface OrderStatsData {
  totalItems: number;
  byCategory: CategoryStat[];
}

interface OrderStatsProps {
  stats: OrderStatsData | null;
  loading: boolean;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const bigint = Number.parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function OrderStats({ stats, loading }: OrderStatsProps) {
  const t = useTranslations('orders');

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-pulse">
        <div className="col-span-full h-28 rounded-site bg-muted" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-site bg-muted" />
        ))}
      </div>
    );
  }

  if (!stats || stats.totalItems === 0) {
    return null;
  }

  const { totalItems, byCategory } = stats;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Total items card */}
      <div className="bg-card-bg border border-stroke rounded-site p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
        <div className="flex items-center justify-between mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-background group-hover:scale-105 transition-transform duration-200">
            <LuShoppingBag size={28} className="text-white" />
          </div>
        </div>
        <h3 className="text-3xl font-bold text-foreground mb-1">
          {totalItems.toLocaleString()}
        </h3>
        <p className="text-secondary text-base">{t('stats.totalItems')}</p>
      </div>

      {/* Category breakdown */}
      {byCategory.map((cat) => {
        const isUncategorized = cat.categoryId === '__uncategorized__';
        const accentColor = isUncategorized ? '#9CA3AF' : cat.color;
        const label = isUncategorized
          ? t('stats.uncategorized')
          : cat.categoryName;

        return (
          <div
            key={cat.categoryId}
            className="bg-card-bg border border-stroke rounded-site p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-5">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
                style={{ backgroundColor: accentColor }}
              >
                <LuPackage size={28} className="text-white" />
              </div>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: hexToRgba(accentColor, 0.15),
                  color: accentColor,
                }}
              >
                {cat.percentage}%
              </span>
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-1">
              {cat.totalItems.toLocaleString()}
            </h3>
            <p
              className="text-secondary text-base truncate"
              title={label}
            >
              {label}
            </p>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(cat.percentage, 100)}%`,
                  backgroundColor: accentColor,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
