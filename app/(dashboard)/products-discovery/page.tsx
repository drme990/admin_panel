'use client';

import { useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/Product';
import { useLocale, useTranslations } from 'next-intl';
import ProductCard from './components/product-card';
import CountrySelector from '@/app/(dashboard)/products-discovery/components/country-selector';
import Tabs from '@/components/ui/tabs';

interface CountryOption {
  code: string;
  name: { ar: string; en: string };
  currencyCode: string;
  flagEmoji?: string;
}

type CountryFilter = 'ALL' | string;
type LabelFilter = 'ALL' | string;

interface LabelOption {
  value: string;
  label: { ar: string; en: string };
}

const FILTER_STORAGE_KEY = 'admin-products-discovery-filters';
const DAILY_LABEL = 'DAILY';

function createLabelKey(label: { ar: string; en: string }): string {
  return `${label.en.trim().toLowerCase()}__${label.ar.trim().toLowerCase()}`;
}

function readStoredFilters(): {
  countryCode: CountryFilter;
  labelFilter: LabelFilter;
} {
  if (typeof window === 'undefined') {
    return { countryCode: 'ALL', labelFilter: 'ALL' };
  }

  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);

    if (!raw) {
      return {
        countryCode: 'ALL',
        labelFilter: 'ALL',
      };
    }

    const parsed = JSON.parse(raw) as {
      countryCode?: unknown;
      labelFilter?: unknown;
    };

    return {
      countryCode:
        typeof parsed.countryCode === 'string' && parsed.countryCode.trim()
          ? parsed.countryCode
          : 'ALL',

      labelFilter:
        typeof parsed.labelFilter === 'string' && parsed.labelFilter.trim()
          ? parsed.labelFilter
          : 'ALL',
    };
  } catch {
    return {
      countryCode: 'ALL',
      labelFilter: 'ALL',
    };
  }
}

function saveFilters(filters: {
  countryCode: CountryFilter;
  labelFilter: LabelFilter;
}): void {
  if (typeof window === 'undefined') return;

  window.sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
}

export default function ProductsPricing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [countriesLoading, setCountriesLoading] = useState(true);

  const [countryCode, setCountryCode] = useState<CountryFilter>(
    () => readStoredFilters().countryCode,
  );

  const [labelFilter, setLabelFilter] = useState<LabelFilter>(
    () => readStoredFilters().labelFilter,
  );

  const locale = useLocale();
  const t = useTranslations('admin.productsPricing');

  useEffect(() => {
    void fetchProducts();
    void fetchCountries();
  }, []);

  useEffect(() => {
    saveFilters({
      countryCode,
      labelFilter,
    });
  }, [countryCode, labelFilter]);

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

  const labelOptions = useMemo<LabelOption[]>(() => {
    const labelMap = new Map<string, { ar: string; en: string }>();

    for (const product of products) {
      if (!product.label) continue;

      const normalizedLabel = {
        ar: product.label.ar.trim(),
        en: product.label.en.trim(),
      };

      if (!normalizedLabel.ar && !normalizedLabel.en) {
        continue;
      }

      const key = createLabelKey(normalizedLabel);

      if (!labelMap.has(key)) {
        labelMap.set(key, normalizedLabel);
      }
    }

    return [
      {
        value: DAILY_LABEL,
        label: {
          ar: 'يومي',
          en: 'Daily',
        },
      },

      ...Array.from(labelMap.entries())
        .map(([value, label]) => ({
          value,
          label,
        }))
        .sort((a, b) => {
          const aLabel = locale === 'ar' ? a.label.ar : a.label.en;

          const bLabel = locale === 'ar' ? b.label.ar : b.label.en;

          return aLabel.localeCompare(bLabel, locale);
        }),
    ];
  }, [products, locale]);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === countryCode) || null,
    [countries, countryCode],
  );

  const currencyFilter = selectedCountry?.currencyCode ?? 'ALL';

  const filteredProducts = useMemo(() => {
    if (labelFilter === 'ALL') {
      return products;
    }

    // Daily products => products without labels
    if (labelFilter === DAILY_LABEL) {
      return products.filter(
        (product) =>
          product.showAlways ||
          !product.label ||
          (!product.label.ar.trim() && !product.label.en.trim()),
      );
    }

    return products.filter((product) => {
      if (product.showAlways) return true;

      if (!product.label) return false;

      return (
        createLabelKey({
          ar: product.label.ar,
          en: product.label.en,
        }) === labelFilter
      );
    });
  }, [products, labelFilter]);

  useEffect(() => {
    if (
      !countriesLoading &&
      countryCode !== 'ALL' &&
      !countries.some((country) => country.code === countryCode)
    ) {
      setCountryCode('ALL');
    }
  }, [countries, countryCode, countriesLoading]);

  useEffect(() => {
    if (
      !loading &&
      labelFilter !== 'ALL' &&
      !labelOptions.some((option) => option.value === labelFilter)
    ) {
      setLabelFilter('ALL');
    }
  }, [labelOptions, labelFilter, loading]);

  return (
    <div className="container-site space-y-6 py-8">
      {/* Header */}
      <div className="space-y-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>

          <p className="max-w-2xl text-sm text-secondary">{t('description')}</p>
        </div>

        {/* Filters Card */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          {/* Labels Tabs */}
          <div className="min-w-0 flex-1">
            <Tabs<string>
              value={labelFilter}
              onChange={setLabelFilter}
              size="md"
              className="w-fit"
              options={[
                {
                  value: 'ALL',
                  label: t('allLabels'),
                },

                ...labelOptions.map((option) => ({
                  value: option.value,
                  label: locale === 'ar' ? option.label.ar : option.label.en,
                })),
              ]}
            />
          </div>

          {/* Country Selector */}
          <div className="w-full shrink-0 xl:w-64">
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
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-secondary">{t('loading')}</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stroke py-20 text-center">
          <p className="text-base font-medium text-foreground">
            {locale === 'ar' ? 'لا توجد منتجات' : 'No products found'}
          </p>

          <p className="mt-1 text-sm text-secondary">
            {locale === 'ar'
              ? 'جرّب تغيير الفلاتر'
              : 'Try changing the filters'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
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
