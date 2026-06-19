'use client';

import { useLocale, useTranslations } from 'next-intl';
import { LuClipboardCheck, LuPackage } from 'react-icons/lu';

interface ProductStat {
  productName: string;
  productNameAr: string;
  quantity: number;
  percentage: number;
}

interface ExecutionStatsData {
  totalOrders: number;
  totalItems: number;
  byProduct: ProductStat[];
}

interface ExecutionStatsProps {
  stats: ExecutionStatsData | null;
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

export default function ExecutionStats({ stats, loading }: ExecutionStatsProps) {
  const t = useTranslations('execution');
  const locale = useLocale();

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

  if (!stats || stats.totalOrders === 0) {
    return null;
  }

  const { totalOrders, totalItems, byProduct } = stats;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Total orders card */}
      <div className="bg-card-bg border border-stroke rounded-site p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
        <div className="flex items-center justify-between mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-background group-hover:scale-105 transition-transform duration-200">
            <LuClipboardCheck size={28} className="text-white" />
          </div>
        </div>
        <h3 className="text-3xl font-bold text-foreground mb-1">
          {totalOrders.toLocaleString()}
        </h3>
        <p className="text-secondary text-base">{t('stats.totalOrders')}</p>
      </div>

      {/* Total items card */}
      <div className="bg-card-bg border border-stroke rounded-site p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
        <div className="flex items-center justify-between mb-5">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-background group-hover:scale-105 transition-transform duration-200">
            <LuPackage size={28} className="text-white" />
          </div>
        </div>
        <h3 className="text-3xl font-bold text-foreground mb-1">
          {totalItems.toLocaleString()}
        </h3>
        <p className="text-secondary text-base">{t('stats.totalItems')}</p>
      </div>

      {/* Product breakdown */}
      {byProduct.map((product) => {
        const accentColor = '#6366f1';
        const label = locale === 'ar' ? product.productNameAr : product.productName;

        return (
          <div
            key={product.productName}
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
                {product.percentage}%
              </span>
            </div>
            <h3 className="text-3xl font-bold text-foreground mb-1">
              {product.quantity.toLocaleString()}
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
                  width: `${Math.min(product.percentage, 100)}%`,
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
