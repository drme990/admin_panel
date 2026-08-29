'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Product } from '@/types/Product';
import { useLocale, useTranslations } from 'next-intl';
import ProductCard from './components/product-card';
import CountrySelector from '@/app/(dashboard)/products-discovery/components/country-selector';
import Tabs from '@/components/ui/tabs';
import { LuEye } from 'react-icons/lu';

interface CountryOption {
  code: string;
  name: { ar: string; en: string };
  currencyCode: string;
  flagEmoji?: string;
}

type CountryFilter = 'ALL' | string;
type LabelFilter = 'ALL' | string;
type ViewAsMode = 'admin' | string; // 'admin' or a country code

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
  viewAs: ViewAsMode;
} {
  if (typeof window === 'undefined') {
    return { countryCode: 'ALL', labelFilter: 'ALL', viewAs: 'admin' };
  }

  try {
    const raw = window.sessionStorage.getItem(FILTER_STORAGE_KEY);

    if (!raw) {
      return {
        countryCode: 'ALL',
        labelFilter: 'ALL',
        viewAs: 'admin',
      };
    }

    const parsed = JSON.parse(raw) as {
      countryCode?: unknown;
      labelFilter?: unknown;
      viewAs?: unknown;
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

      viewAs:
        typeof parsed.viewAs === 'string' && parsed.viewAs.trim()
          ? parsed.viewAs
          : 'admin',
    };
  } catch {
    return {
      countryCode: 'ALL',
      labelFilter: 'ALL',
      viewAs: 'admin',
    };
  }
}

function saveFilters(filters: {
  countryCode: CountryFilter;
  labelFilter: LabelFilter;
  viewAs: ViewAsMode;
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

  const [viewAs, setViewAs] = useState<ViewAsMode>(
    () => readStoredFilters().viewAs,
  );

  const locale = useLocale();
  const t = useTranslations('admin.productsPricing');

  const isViewAsAdmin = viewAs === 'admin';

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (viewAs !== 'admin') {
        params.set('viewerCountryCode', viewAs);
      }
      const res = await fetch(`/api/products-discovery?${params.toString()}`);

      const data = await res.json();

      if (data.success) {
        setProducts(data.data.products);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [viewAs]);

  const fetchCountries = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void fetchCountries();
  }, [fetchCountries]);

  // Fetch products — re-fetch when viewAs changes so prices are resolved
  // for the selected viewer country (or raw when in admin mode).
  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    saveFilters({
      countryCode,
      labelFilter,
      viewAs,
    });
  }, [countryCode, labelFilter, viewAs]);

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

  // When in "view as" mode, determine the viewer's currency from the
  // selected country so the ProductCard can highlight the relevant price.
  const viewAsCountry = useMemo(
    () => countries.find((c) => c.code === viewAs) || null,
    [countries, viewAs],
  );
  const viewAsCurrency = viewAsCountry?.currencyCode ?? '';

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
      !countriesLoading &&
      !isViewAsAdmin &&
      !countries.some((c) => c.code === viewAs)
    ) {
      setViewAs('admin');
    }
  }, [countries, viewAs, countriesLoading, isViewAsAdmin]);

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
    <div className="space-y-6">
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

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* View As Selector */}
            <div className="w-full shrink-0 sm:w-56 xl:w-64">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-secondary">
                <LuEye size={14} />
                {t('viewAs')}
              </label>
              <CountrySelector
                value={viewAs}
                onChange={setViewAs}
                countries={countries}
                placeholder={t('viewAsPlaceholder')}
                searchPlaceholder={t('searchCountry')}
                noResultsLabel={t('noCountriesFound')}
                disabled={countriesLoading}
                adminOptionLabel={t('viewAsAdmin')}
              />
            </div>

            {/* Country Selector (currency filter) — only relevant in admin mode */}
            {isViewAsAdmin && (
              <div className="w-full shrink-0 xl:w-64">
                <label className="mb-1 block text-xs font-medium text-secondary">
                  {t('countryPlaceholder')}
                </label>
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
            )}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product._id}
              product={product}
              currencyCode={currencyFilter}
              viewAsCurrency={isViewAsAdmin ? '' : viewAsCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
