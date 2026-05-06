'use client';

import { useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/Product';
import Dropdown from '@/components/ui/dropdown';
import { useTranslations } from 'next-intl';
import ProductCard from './components/product-card';

type CurrencyFilter = 'ALL' | string;

export default function ProductsDiscover() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<CurrencyFilter>('ALL');
  const t = useTranslations('admin.productsDiscover');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products-discovery?limit=100');
      const data = await res.json();

      if (data.success) {
        setProducts(data.data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Collect currencies dynamically
  const currencyOptions = useMemo(() => {
    const set = new Set<string>();

    products.forEach((p) => {
      const size = p.sizes?.[0];
      if (!size) return;

      set.add(p.baseCurrency);
      size.prices?.forEach((pr) => set.add(pr.currencyCode));
    });

    return [
      { label: t('allCurrencies'), value: 'ALL' },
      ...Array.from(set).map((c) => ({
        label: c,
        value: c,
      })),
    ];
  }, [products, t]);

  return (
    <div className="container-site py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary">{t('description')}</p>
        </div>

        <div className="w-56">
          <Dropdown
            value={currency}
            options={currencyOptions}
            onChange={(val) => setCurrency(val)}
          />
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary">{t('loading')}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
