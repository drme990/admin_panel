'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import { Product, getPrimaryProductImageUrl } from '@/types/Product';

interface Props {
  product: Product;
  currency: string;
}

export default function ProductCard({ product, currency }: Props) {
  const locale = useLocale();
  const [activeSizeIndex, setActiveSizeIndex] = useState(0);

  const image = getPrimaryProductImageUrl(product);
  const activeSize = product.sizes?.[activeSizeIndex];

  if (!activeSize) return null;

  return (
    <div className="rounded-site border border-stroke bg-card-bg overflow-hidden transition hover:shadow-md">
      {/* Image */}
      <div className="relative h-40 w-full bg-muted">
        {image ? (
          <Image
            src={image}
            alt={product.name.en}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-secondary text-sm">
            No Image
          </div>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Name */}
        <h3 className="font-semibold text-sm text-foreground line-clamp-2">
          {locale === 'ar' ? product.name.ar : product.name.en}
        </h3>

        {/* Sizes */}
        {product.sizes.length > 1 && (
          <div className="flex gap-1 overflow-x-auto">
            {product.sizes.map((size, i) => (
              <button
                key={i}
                onClick={() => setActiveSizeIndex(i)}
                className={`px-2 py-1 text-xs rounded-md border transition whitespace-nowrap ${
                  i === activeSizeIndex
                    ? 'bg-primary text-primary-text border-primary'
                    : 'border-stroke text-secondary hover:bg-muted'
                }`}
              >
                {locale === 'ar' ? size.name.ar : size.name.en}
              </button>
            ))}
          </div>
        )}

        {/* Prices */}
        <div className="text-sm space-y-1">
          {(currency === 'ALL' || currency === product.baseCurrency) && (
            <div className="flex justify-between font-semibold text-primary">
              <span>{product.baseCurrency}</span>
              <span>{activeSize.price}</span>
            </div>
          )}

          {activeSize.prices?.map((p) => {
            if (currency !== 'ALL' && currency !== p.currencyCode) return null;

            return (
              <div
                key={p.currencyCode}
                className="flex justify-between text-secondary"
              >
                <span>{p.currencyCode}</span>
                <span>{p.amount}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
