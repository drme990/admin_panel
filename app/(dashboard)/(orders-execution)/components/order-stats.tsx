'use client';

import { useTranslations } from 'next-intl';
import { LuPackage, LuShoppingBag } from 'react-icons/lu';

interface ProductStat {
  productId: string;
  productName: { ar: string; en: string };
  quantity: number;
}

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  categoryNumber: number;
  color: string;
  totalItems: number;
  percentage: number;
  products: ProductStat[];
}

export interface OrderStatsData {
  totalItems: number;
  byCategory: CategoryStat[];
}

interface OrderStatsProps {
  stats: OrderStatsData | null;
  loading: boolean;
  locale: string;
  namespace?: 'orders' | 'execution';
  onCategoryClick?: (categoryId: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const bigint = Number.parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function OrderStats({
  stats,
  loading,
  locale,
  namespace = 'orders',
  onCategoryClick,
}: OrderStatsProps) {
  const t = useTranslations(namespace);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 animate-pulse">
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

  const sortedCategories = [...byCategory].sort(
    (a, b) => (a.categoryNumber ?? 9999) - (b.categoryNumber ?? 9999),
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* Total items card */}
      <div className="bg-card-bg border border-stroke rounded-site p-4 sm:p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-background group-hover:scale-105 transition-transform duration-200">
            <LuShoppingBag size={24} className="text-white sm:hidden" />
            <LuShoppingBag size={28} className="text-white hidden sm:block" />
          </div>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          {totalItems.toLocaleString()}
        </h3>
        <p className="text-secondary text-sm sm:text-base">{t('stats.totalItems')}</p>
      </div>

      {/* Category breakdown */}
      {sortedCategories.map((cat) => {
        const isUncategorized = cat.categoryId === '__uncategorized__';
        const accentColor = isUncategorized ? '#9CA3AF' : cat.color;
        const label = isUncategorized
          ? t('stats.uncategorized')
          : cat.categoryName;

        return (
          <div
            key={cat.categoryId}
            className={`bg-card-bg border border-stroke rounded-site p-4 sm:p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group ${onCategoryClick ? 'cursor-pointer' : ''}`}
            onClick={() => onCategoryClick?.(cat.categoryId)}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200"
                style={{ backgroundColor: accentColor }}
              >
                <LuPackage size={24} className="text-white sm:hidden" />
                <LuPackage size={28} className="text-white hidden sm:block" />
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: hexToRgba(accentColor, 0.15),
                    color: accentColor,
                  }}
                >
                  #{cat.categoryNumber}
                </span>
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: hexToRgba(accentColor, 0.15),
                    color: accentColor,
                  }}
                >
                  {cat.percentage}%
                </span>
              </div>
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
              {cat.totalItems.toLocaleString()}
            </h3>
            <p
              className="text-secondary text-sm sm:text-base truncate"
              title={label}
            >
              {label}
            </p>

            {/* Product breakdown */}
            {cat.products.length > 0 && (
              <div className="mt-3 space-y-1">
                {cat.products.map((product) => {
                  const productName =
                    locale === 'ar'
                      ? product.productName.ar
                      : product.productName.en;
                  return (
                    <div
                      key={product.productId}
                      className="flex items-center justify-between text-xs sm:text-sm"
                    >
                      <span
                        className="text-secondary truncate max-w-[70%]"
                        title={productName}
                      >
                        {productName}
                      </span>
                      <span className="font-medium text-foreground ml-2 shrink-0">
                        {product.quantity.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 sm:mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
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
