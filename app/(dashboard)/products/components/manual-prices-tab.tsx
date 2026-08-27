'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Product, getPrimaryProductImageUrl } from '@/types/Product';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import {
  LuCheck as Check,
  LuLoaderCircle as LoaderCircle,
} from 'react-icons/lu';

interface ManualPricesTabProps {
  products: Product[];
  onProductsChange: (products: Product[]) => void;
}

export default function ManualPricesTab({
  products,
  onProductsChange,
}: ManualPricesTabProps) {
  const t = useTranslations('admin.products');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  // Track local edits per product+size before saving
  // Key: `${productId}__${sizeId}`, value: manualPrice (EGP)
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const getKey = (productId: string, sizeId: string) => `${productId}__${sizeId}`;

  const getEditValue = (productId: string, sizeId: string, size: Product['sizes'][number]): number => {
    const key = getKey(productId, sizeId);
    if (key in edits) return edits[key];
    return size.manualPrice ?? 0;
  };

  const updateEditValue = (productId: string, sizeId: string, value: number) => {
    const key = getKey(productId, sizeId);
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const hasEdits = Object.keys(edits).length > 0;

  const saveAll = useCallback(async () => {
    if (Object.keys(edits).length === 0) {
      toast.info(t('manualPrices.noChanges', { defaultValue: 'No changes to save' }));
      return;
    }

    setSaving(true);
    const updatedProducts = [...products];
    const productUpdates = new Map<string, Product['sizes']>();

    // Group edits by product
    for (const [key, manualPrice] of Object.entries(edits)) {
      const [productId, sizeId] = key.split('__');
      const product = updatedProducts.find((p) => p._id === productId);
      if (!product) continue;

      const updatedSizes = productUpdates.get(productId) ?? product.sizes.map((s) => ({ ...s }));
      const sizeIndex = updatedSizes.findIndex(
        (s) => (s._id ?? s.name.en) === sizeId,
      );
      if (sizeIndex === -1) continue;

      updatedSizes[sizeIndex] = {
        ...updatedSizes[sizeIndex],
        manualPrice: manualPrice > 0 ? manualPrice : null,
      };
      productUpdates.set(productId, updatedSizes);
    }

    // Save each product via PATCH
    const savePromises = Array.from(productUpdates.entries()).map(
      async ([productId, sizes]) => {
        const res = await fetch(`/api/products/${productId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sizes }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data?.error || `Failed to save product ${productId}`);
        }
        return { productId, sizes };
      },
    );

    try {
      const results = await Promise.all(savePromises);

      // Apply to local state
      const newProducts = updatedProducts.map((p) => {
        const update = results.find((r) => r.productId === p._id);
        return update ? { ...p, sizes: update.sizes } : p;
      });
      onProductsChange(newProducts);

      setEdits({});
      toast.success(
        t('manualPrices.allSaved', { defaultValue: 'All manual prices saved' }),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('messages.saveFailed');
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [edits, products, onProductsChange, t]);

  return (
    <div className="space-y-4">
      {/* Header with save button */}
      <div className="flex items-center justify-end gap-3 flex-wrap">
        <Button
          variant="primary"
          onClick={saveAll}
          disabled={saving || !hasEdits}
        >
          {saving ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <Check size={18} />
          )}
          {t('manualPrices.save', { defaultValue: 'Save Changes' })}
        </Button>
      </div>

      {hasEdits && (
        <p className="text-xs text-warning">
          {t('manualPrices.unsavedChanges', {
            defaultValue: 'You have unsaved changes. Click Save to persist them.',
          })}
        </p>
      )}

      {/* Product list — always expanded */}
      <div className="space-y-2">
        {products.map((product) => {
          const img = getPrimaryProductImageUrl(product);

          return (
            <div
              key={product._id}
              className="rounded-lg border border-stroke bg-card-bg overflow-hidden"
            >
              {/* Product header row */}
              <div className="w-full flex items-center gap-3 p-3 bg-muted/20">
                {img ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <Image
                      src={img}
                      alt={product.name.ar}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-stroke/10 shrink-0" />
                )}
                <div className="flex-1 text-start">
                  <span className="font-medium text-foreground">
                    {isRTL ? product.name.ar : product.name.en}
                  </span>
                  <span className="text-xs text-secondary ms-2">
                    {product.sizes.length} {t('manualPrices.sizes', { defaultValue: 'sizes' })}
                  </span>
                </div>
              </div>

              {/* Per-size EGP manual price inputs */}
              <div className="border-t border-stroke p-4 space-y-4 bg-background/50">
                {product.sizes.map((size) => {
                  const sizeId = size._id ?? size.name.en;
                  const editValue = getEditValue(product._id, sizeId, size);

                  return (
                    <div
                      key={sizeId}
                      className="flex items-center gap-3 p-3 bg-card-bg rounded-lg border border-stroke"
                    >
                      {/* Size name + regular price */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground text-sm">
                          {isRTL ? size.name.ar : size.name.en}
                        </div>
                        <div className="text-xs text-secondary">
                          {t('manualPrices.regularPrice', { defaultValue: 'Regular' })}: {size.price ?? (() => {
                            const baseCur = (product.baseCurrency || '').toUpperCase();
                            const entry = size.prices?.find((p) => p.currencyCode.toUpperCase() === baseCur);
                            return entry?.amount ?? 0;
                          })()} {product.baseCurrency}
                        </div>
                      </div>

                      {/* Manual price input (EGP only) */}
                      <div className="shrink-0 w-40">
                        <label className="text-xs font-medium text-secondary block mb-1">
                          {t('manualPrices.baseManualPrice', { defaultValue: 'Manual Price' })} (EGP)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue || ''}
                          onChange={(e) =>
                            updateEditValue(product._id, sizeId, parseFloat(e.target.value) || 0)
                          }
                          placeholder="0.00"
                          className="w-full px-3 py-2 text-sm bg-background border border-stroke rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
