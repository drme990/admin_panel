'use client';

import { useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/Product';
import { useTranslations } from 'next-intl';
import ProductCard from './components/product-card';
import CountrySelector from '@/app/(dashboard)/products-discovery/components/country-selector';

interface CountryOption {
  code: string;
  name: { ar: string; en: string };
  currencyCode: string;
  flagEmoji?: string;
}

type CountryFilter = 'ALL' | string;

export default function ProductsPricing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countryCode, setCountryCode] = useState<CountryFilter>('ALL');
  const t = useTranslations('admin.productsPricing');

  useEffect(() => {
    void fetchProducts();
    void fetchCountries();
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

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/countries?active=true');
      const data = await res.json();

      if (data.success) {
        setCountries(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCountriesLoading(false);
    }
  };

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === countryCode) || null,
    [countries, countryCode],
  );

  const currencyFilter = selectedCountry?.currencyCode ?? 'ALL';

  return (
    <div className="container-site py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-secondary">{t('description')}</p>
        </div>

        <div className="w-56">
          <CountrySelector
            value={countryCode}
            onChange={setCountryCode}
            countries={countries}
            placeholder={t('countryPlaceholder')}
            allOptionLabel={t('allCountries')}
            searchPlaceholder={t('searchCountry')}
            noResultsLabel={t('noCountriesFound')}
            disabled={countriesLoading}
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
              currencyCode={currencyFilter}
            />
          ))}
        </div>
      )}
    </div>
  );
}
