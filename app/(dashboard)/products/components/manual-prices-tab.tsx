'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { Product, getPrimaryProductImageUrl, CurrencyPrice } from '@/types/Product';
import MultiCurrencyPriceEditor from '@/components/admin/multi-currency-price-editor';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import {
  LuCheck as Check,
  LuLoaderCircle as LoaderCircle,
  LuChevronDown as ChevronDown,
  LuChevronUp as ChevronUp,
} from 'react-icons/lu';

interface ManualPricesTabProps {
  products: Product[];
  onProductsChange: (products: Product[]) => void;
}

/** Local editable state for a single size's manual prices */
interface SizeEditState {
  manualPrice: number;
  manualPrices: CurrencyPrice[];
}

export default function ManualPricesTab({
  products,
  onProductsChange,
}: ManualPricesTabProps) {
  const t = useTranslations('admin.products');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  // Track local edits per product+size before saving
  // Key: `${productId}__${sizeId}`
  const [edits, setEdits] = useState<Record<string, SizeEditState>>({});
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const getKey = (productId: string, sizeId: string) => `${productId}__${sizeId}`;

  const getEditState = (productId: string, sizeId: string, product: Product, size: Product['sizes'][number]): SizeEditState => {
    const key = getKey(productId, sizeId);
    if (edits[key]) return edits[key];
    return {
      manualPrice: size.manualPrice ?? 0,
      manualPrices: size.manualPrices ?? [],
    };
  };

  const updateEditState = (productId: string, sizeId: string, partial: Partial<SizeEditState>) => {
    const key = getKey(productId, sizeId);
    setEdits((prev) => ({
      ...prev,
      [key]: { ...getEditState(productId, sizeId, products.find(p => p._id === productId)!, products.find(p => p._id === productId)!.sizes.find(s => (s._id ?? s.name.en) === sizeId)!), ...partial },
    }));
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const expandAll = () => setExpandedProducts(new Set(products.map((p) => p._id)));
  const collapseAll = () => setExpandedProducts(new Set());

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
    for (const [key, state] of Object.entries(edits)) {
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
        manualPrice: state.manualPrice,
        manualPrices: state.manualPrices,
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            {t('manualPrices.expandAll', { defaultValue: 'Expand All' })}
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            {t('manualPrices.collapseAll', { defaultValue: 'Collapse All' })}
          </Button>
        </div>
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

      {/* Product list */}
      <div className="space-y-2">
        {products.map((product) => {
          const img = getPrimaryProductImageUrl(product);
          const isExpanded = expandedProducts.has(product._id);

          return (
            <div
              key={product._id}
              className="rounded-lg border border-stroke bg-card-bg overflow-hidden"
            >
              {/* Product header row */}
              <button
                type="button"
                onClick={() => toggleProduct(product._id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
              >
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
                {isExpanded ? (
                  <ChevronUp size={18} className="text-secondary shrink-0" />
                ) : (
                  <ChevronDown size={18} className="text-secondary shrink-0" />
                )}
              </button>

              {/* Expanded: per-size editors */}
              {isExpanded && (
                <div className="border-t border-stroke p-4 space-y-6 bg-background/50">
                  {product.sizes.map((size) => {
                    const sizeId = size._id ?? size.name.en;
                    const editState = getEditState(product._id, sizeId, product, size);

                    return (
                      <div
                        key={sizeId}
                        className="space-y-3"
                      >
                        <div className="flex items-center gap-2 pb-2 border-b border-stroke">
                          <h4 className="text-sm font-semibold text-foreground">
                            {isRTL ? size.name.ar : size.name.en}
                          </h4>
                          <span className="text-xs text-secondary">
                            ({t('manualPrices.regularPrice', { defaultValue: 'Regular' })}: {size.price} {product.baseCurrency})
                          </span>
                        </div>

                        {/* Base manual price input */}
                        <div className="p-3 bg-card-bg rounded-lg border border-stroke">
                          <label className="text-xs font-medium text-secondary block mb-1.5">
                            {t('manualPrices.baseManualPrice', { defaultValue: 'Manual Base Price' })} ({product.baseCurrency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editState.manualPrice || ''}
                            onChange={(e) =>
                              updateEditState(product._id, sizeId, {
                                manualPrice: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-3 py-2 text-sm bg-background border border-stroke rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>

                        {/* Multi-currency manual prices editor */}
                        <MultiCurrencyPriceEditor
                          mainCurrency={product.baseCurrency}
                          basePrice={editState.manualPrice}
                          prices={editState.manualPrices}
                          compact
                          onChange={(newPrices) =>
                            updateEditState(product._id, sizeId, {
                              manualPrices: newPrices,
                            })
                          }
                          onMainCurrencyChange={() => { }}
                          onBasePriceChange={(price) =>
                            updateEditState(product._id, sizeId, {
                              manualPrice: price,
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
