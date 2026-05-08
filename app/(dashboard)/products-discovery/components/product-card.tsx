'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';

import { Product, getPrimaryProductImageUrl } from '@/types/Product';

import { cn } from '@/lib/utils';

interface Props {
  product: Product;
  currencyCode: string;
}

export default function ProductCard({ product, currencyCode }: Props) {
  const locale = useLocale();
  const t = useTranslations('admin.productsPricing');

  const [activeSizeIndex, setActiveSizeIndex] = useState(0);

  const image = getPrimaryProductImageUrl(product);

  const activeSize = product.sizes?.[activeSizeIndex];

  const partialPayment = product.partialPayment;

  const hasPartialPayment = Boolean(partialPayment?.isAllowed);

  const productName = locale === 'ar' ? product.name.ar : product.name.en;

  const availablePrices = useMemo(() => {
    if (!activeSize) return [];

    const rawPrices = [
      {
        currencyCode: product.baseCurrency,
        amount: activeSize.price,
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
  }, [activeSize, currencyCode, product.baseCurrency]);

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
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1 backdrop-blur-md">
            {product.sizes.map((size, i) => (
              <button
                key={i}
                onClick={() => setActiveSizeIndex(i)}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px] font-medium transition',
                  i === activeSizeIndex
                    ? 'bg-primary text-primary-text'
                    : 'text-white/80 hover:bg-white/10',
                )}
              >
                {locale === 'ar' ? size.name.ar : size.name.en}
              </button>
            ))}
          </div>
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
          {availablePrices.map((price) => {
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
