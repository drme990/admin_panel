'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  LuChevronDown,
  LuChevronUp,
  LuCircleCheck,
  LuPackage,
  LuShoppingBag,
  LuUserRound,
} from 'react-icons/lu';

export interface AdminStatsProduct {
  id: string;
  name: { ar: string; en: string };
  count: number;
}

export interface AdminStatsCategory {
  /** null → uncategorized bucket */
  id: string | null;
  name: string | null;
  color: string;
  total: number;
  products: AdminStatsProduct[];
}

export interface AdminStatsRow {
  adminId: string;
  name: string;
  email: string;
  claimed: number;
  contacted: number;
  converted: number;
  conversionRate: number;
  categories?: AdminStatsCategory[];
}

interface AdminAchievementCardsProps {
  stats: AdminStatsRow[] | null;
  onOpenAdmin?: (admin: { _id: string; name: string }) => void;
  /** Category chip/block click → opens the category-orders modal. */
  onCategoryClick?: (
    admin: { _id: string; name: string },
    category: AdminStatsCategory,
  ) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '');
  const bigint = Number.parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Per-admin achievement cards shown under the booking-intent stats
 * table — same card chrome as the order-stats cards (icon square,
 * tinted % pill, big figure, progress bar). Each card's categories and
 * product counts come from the exact displayed rows that admin owns.
 */
export default function AdminAchievementCards({
  stats,
  onOpenAdmin,
  onCategoryClick,
}: AdminAchievementCardsProps) {
  const t = useTranslations('admin.bookingIntent');
  const locale = useLocale();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(
    new Set(),
  );

  if (!stats || stats.length === 0) return null;

  const toggleCard = (adminId: string) =>
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(adminId)) next.delete(adminId);
      else next.add(adminId);
      return next;
    });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {stats.map((row) => {
        const expanded = expandedCards.has(row.adminId);
        const categories = row.categories ?? [];
        const admin = { _id: row.adminId, name: row.name || row.email };
        const totalOrders = row.contacted + row.converted;
        const totalProducts = categories.reduce((s, c) => s + c.total, 0);
        return (
          <div
            key={row.adminId}
            className="bg-card-bg border border-stroke rounded-site p-4 sm:p-6 hover:border-primary/50 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
          >
            {/* Header — icon + name/claimed | green rate badge */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenAdmin?.(admin)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center bg-primary/10 shrink-0 group-hover:scale-105 transition-transform duration-200"
                  aria-label={admin.name}
                >
                  <LuUserRound size={24} className="text-primary sm:hidden" />
                  <LuUserRound
                    size={28}
                    className="text-primary hidden sm:block"
                  />
                </button>
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenAdmin?.(admin)}
                    className="block w-full text-start text-base sm:text-lg font-bold text-foreground truncate hover:text-primary transition-colors"
                  >
                    {admin.name}
                  </button>
                  <p className="text-xs text-secondary">
                    {t('stats.claimed')}: {row.claimed}
                  </p>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold shrink-0"
                style={{
                  backgroundColor: hexToRgba('#22C55E', 0.15),
                  color: '#22C55E',
                }}
              >
                <LuCircleCheck size={13} />
                {row.conversionRate}%
              </span>
            </div>

            {/* Two mini stat cards — total orders / products */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-stroke bg-background p-3 flex items-center gap-3">
                <div className="min-w-0">
                  <div className='flex items-center gap-2'>
                    <LuShoppingBag size={14} className="text-primary" />
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                      {totalOrders.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {t('stats.totalOrders')}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-stroke bg-background p-3 flex items-center gap-3">
                <div className="min-w-0">
                  <div className='flex items-center gap-2'>
                    <LuPackage size={14} className="text-warning" />
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                      {totalProducts.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-xs text-secondary truncate">
                    {t('stats.totalProducts')}
                  </p>
                </div>
              </div>
            </div>

            {/* Category chips from this admin's displayed orders */}
            {categories.length === 0 ? (
              <p className="mt-3 text-xs text-secondary">
                {t('stats.noItems')}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.id ?? 'uncategorized'}
                    type="button"
                    onClick={() => onCategoryClick?.(admin, c)}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs hover:ring-1 hover:ring-current transition-shadow"
                    style={{
                      backgroundColor: hexToRgba(c.color, 0.12),
                      color: c.color,
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name ?? t('stats.uncategorized')}
                    <span className="font-semibold">{c.total}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Details toggle — categories → products → counts */}
            {categories.length > 0 && (
              <>
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => toggleCard(row.adminId)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-muted px-4 py-1.5 text-xs font-medium text-primary hover:border-primary/50 transition-colors"
                  >
                    {expanded ? (
                      <LuChevronUp size={14} />
                    ) : (
                      <LuChevronDown size={14} />
                    )}
                    {expanded
                      ? t('stats.hideDetails')
                      : t('stats.showDetails')}
                  </button>
                </div>
                {expanded && (
                  <div className="mt-3 space-y-2.5">
                    {categories.map((c) => (
                      <div
                        key={c.id ?? 'uncategorized'}
                        className="rounded-lg border border-stroke bg-background p-3"
                      >
                        <div
                          className="flex items-center justify-between gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => onCategoryClick?.(admin, c)}
                        >
                          <span className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="truncate">
                              {c.name ?? t('stats.uncategorized')}
                            </span>
                          </span>
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold shrink-0"
                            style={{
                              backgroundColor: hexToRgba(c.color, 0.15),
                              color: c.color,
                            }}
                          >
                            {c.total}
                          </span>
                        </div>
                        <ul className="mt-1.5 space-y-0.5 border-t border-stroke pt-1.5">
                          {c.products.map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center justify-between gap-2 text-xs text-secondary"
                            >
                              <span className="truncate">
                                {locale === 'ar'
                                  ? p.name.ar || p.name.en
                                  : p.name.en || p.name.ar}
                              </span>
                              <span className="font-medium text-foreground shrink-0">
                                ×{p.count}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Conversion progress bar — same as the stats cards */}
            <div className="mt-3 sm:mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all bg-success"
                style={{
                  width: `${Math.min(row.conversionRate, 100)}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
