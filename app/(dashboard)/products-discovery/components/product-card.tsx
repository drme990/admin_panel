'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';

import Tabs from '@/components/ui/tabs';

import { Product, getPrimaryProductImageUrl } from '@/types/Product';

import { cn } from '@/lib/utils';

interface Props {
  product: Product;
  currencyCode: string;
  /**
   * When non-empty, the card is in "view as" mode — prices come from
   * `resolvedPrices[]` (pre-resolved by the backend for a specific
   * viewer country). Only the price matching this currency is shown,
   * with a real/exchange badge.
   */
  viewAsCurrency?: string;
}

export default function ProductCard({ product, currencyCode, viewAsCurrency = '' }: Props) {
  const locale = useLocale();
  const t = useTranslations('admin.productsPricing');

  const [activeSizeIndex, setActiveSizeIndex] = useState(0);

  const image = getPrimaryProductImageUrl(product);

  const activeSize = product.sizes?.[activeSizeIndex];

  const sizeOptions = product.sizes.map((size, index) => ({
    value: String(index),
    label: locale === 'ar' ? size.name.ar : size.name.en,
  }));

  const partialPayment = product.partialPayment;

  const hasPartialPayment = Boolean(partialPayment?.isAllowed);

  const productName = locale === 'ar' ? product.name.ar : product.name.en;

  const isViewAsMode = viewAsCurrency.length > 0;

  // ── "View As" mode: use resolvedPrices[] from the backend ──
  // The backend already filters by visibility (hide/exchange/real),
  // so resolvedPrices[] contains every currency this viewer is allowed
  // to see — we display all of them with real/exchange badges.
  const viewAsPrices = useMemo(() => {
    if (!isViewAsMode || !activeSize) return [];
    const resolved = (activeSize as unknown as { resolvedPrices?: Array<{ currencyCode: string; amount: number; type?: 'real' | 'exchange' }> }).resolvedPrices;
    return resolved ?? [];
  }, [activeSize, isViewAsMode]);

  // ── Admin mode: show raw prices[] ──
  const availablePrices = useMemo(() => {
    if (isViewAsMode) return [];
    if (!activeSize) return [];

    // Read base price from prices[] (source of truth), fall back to deprecated price field
    const baseCur = product.baseCurrency.toUpperCase();
    const baseEntry = activeSize.prices?.find(
      (p) => p.currencyCode.toUpperCase() === baseCur,
    );
    const baseAmount = baseEntry?.amount ?? activeSize.price ?? 0;

    const rawPrices = [
      {
        currencyCode: product.baseCurrency,
        amount: baseAmount,
      },

      ...(activeSize.prices ?? []).map((price) => ({
        currencyCode: price.currencyCode,
        amount: price.amount,
      })),
    ];

    // Remove duplicated currencies
    const uniquePrices = rawPrices.filter(
      (price, index, self) =>
        index === self.findIndex((p) => p.currencyCode === price.currencyCode),
    );

    if (currencyCode === 'ALL') {
      return uniquePrices;
    }

    return uniquePrices.filter((price) => price.currencyCode === currencyCode);
  }, [activeSize, currencyCode, product.baseCurrency, isViewAsMode]);

  if (!activeSize) return null;

  const formatAmount = (amount: number) =>
    Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

  const getMinimumPayment = (currency: string, amount: number) => {
    if (!hasPartialPayment) return null;

    const minimumEntry = (partialPayment?.minimumPayments ?? []).find(
      (entry) => entry.currencyCode === currency,
    );

    if (!minimumEntry) return null;

    if (partialPayment?.minimumType === 'percentage') {
      return (amount * minimumEntry.value) / 100;
    }

    return minimumEntry.value;
  };

  return (
    <div
      className={cn(
        'group overflow-hidden rounded-2xl',
        'border border-primary/10 bg-card-bg',
        'transition-all duration-200',
        'hover:border-primary/30 hover:shadow-lg',
      )}
    >
      {/* Image */}
      <div className="relative h-32 overflow-hidden bg-primary/5">
        {image ? (
          <Image
            src={image}
            alt={product.name.en}
            fill
            unoptimized
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-primary/50">
            No Image
          </div>
        )}

        {/* Size Selector */}
        {product.sizes.length > 1 && (
          <Tabs
            value={String(activeSizeIndex)}
            options={sizeOptions}
            onChange={(value) => setActiveSizeIndex(Number(value))}
            size="sm"
            className="absolute top-2 right-2"
          />
        )}
      </div>

      {/* Content */}
      <div className="space-y-3 p-3">
        {/* Header */}
        <div className="flex items-center justify-between space-y-1">
          <h3 className="line-clamp-1 text-sm font-semibold text-primary">
            {productName}
          </h3>

          {product.sizes.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-primary/60">
              <span className="h-1 w-1 rounded-full bg-primary/30" />

              <span>
                {locale === 'ar' ? activeSize.name.ar : activeSize.name.en}
              </span>
            </div>
          )}
        </div>

        {/* Prices */}
        <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
          {/* View As mode — show resolved price with real/exchange badge */}
          {isViewAsMode &&
            viewAsPrices.map((price) => {
              const minimum = getMinimumPayment(price.currencyCode, price.amount);
              const isReal = price.type === 'real';

              return (
                <div
                  key={`${price.currencyCode}-${price.amount}`}
                  className={cn(
                    'rounded-2xl border',
                    'px-3 py-2.5',
                    'transition hover:border-primary/30',
                    isReal
                      ? 'border-success/20 bg-success/5'
                      : 'border-primary/15 bg-primary/5',
                  )}
                >
                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                        {price.currencyCode}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          isReal
                            ? 'bg-success/15 text-success'
                            : 'bg-primary/15 text-primary',
                        )}
                      >
                        {isReal ? (locale === 'ar' ? 'حقيقي' : 'Real') : (locale === 'ar' ? 'صرف' : 'Exchange')}
                      </span>
                    </div>

                    <span className="text-lg font-bold leading-none text-primary">
                      {formatAmount(price.amount)}
                    </span>
                  </div>

                  {/* Partial Payment */}
                  {hasPartialPayment && (
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-primary/60">
                        {t('minPartialPayment')}
                      </span>

                      <span className="font-semibold text-primary">
                        {minimum === null
                          ? t('minPartialUnavailable')
                          : `${formatAmount(minimum)} ${price.currencyCode}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

          {/* View As mode but no resolved price for this currency */}
          {isViewAsMode && viewAsPrices.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stroke px-3 py-3 text-center">
              <span className="text-xs text-secondary">
                {locale === 'ar' ? 'السعر غير متاح لهذه العملة' : 'Price unavailable for this currency'}
              </span>
            </div>
          )}

          {/* Admin mode — show all raw prices */}
          {!isViewAsMode &&
            availablePrices.map((price) => {
              const minimum = getMinimumPayment(price.currencyCode, price.amount);

              return (
                <div
                  key={`${price.currencyCode}-${price.amount}`}
                  className={cn(
                    'rounded-2xl border border-primary/15',
                    'bg-primary/5 px-3 py-2.5',
                    'transition hover:border-primary/30 hover:bg-primary/10',
                  )}
                >
                  {/* Price */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary/60">
                      {price.currencyCode}
                    </span>

                    <span className="text-lg font-bold leading-none text-primary">
                      {formatAmount(price.amount)}
                    </span>
                  </div>

                  {/* Partial Payment */}
                  {hasPartialPayment && (
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-primary/60">
                        {t('minPartialPayment')}
                      </span>

                      <span className="font-semibold text-primary">
                        {minimum === null
                          ? t('minPartialUnavailable')
                          : `${formatAmount(minimum)} ${price.currencyCode}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
