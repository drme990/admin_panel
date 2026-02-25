'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import * as flags from 'country-flag-icons/react/3x2';
import { useTranslations, useLocale } from 'next-intl';
import Dropdown from '@/components/ui/dropdown';
import Table from '@/components/ui/table';
import Switch from '@/components/ui/switch';
import { toast } from 'react-toastify';

type FlagComponents = Record<
  string,
  React.ComponentType<{ className?: string }>
>;

interface Country {
  _id: string;
  code: string;
  name: {
    ar: string;
    en: string;
  };
  currencyCode: string;
  currencySymbol: string;
  flagEmoji: string;
  isActive: boolean;
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const t = useTranslations('admin.countries');
  const locale = useLocale();

  const filterOptions: {
    label: string;
    value: 'all' | 'active' | 'inactive';
  }[] = useMemo(
    () => [
      { label: t('filter.all'), value: 'all' },
      { label: t('filter.active'), value: 'active' },
      { label: t('filter.inactive'), value: 'inactive' },
    ],
    [t],
  );

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const response = await fetch('/api/countries?active=false');
      const data = await response.json();
      if (data.success) {
        setCountries(data.data);
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = useMemo(() => {
    let result = countries;

    if (filter === 'active') result = result.filter((c) => c.isActive);
    else if (filter === 'inactive') result = result.filter((c) => !c.isActive);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.en.toLowerCase().includes(q) ||
          c.name.ar.includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.currencyCode.toLowerCase().includes(q),
      );
    }

    return result;
  }, [countries, search, filter]);

  const handleToggleActive = useCallback(
    async (country: Country) => {
      const newValue = !country.isActive;

      setCountries((prev) =>
        prev.map((c) =>
          c._id === country._id ? { ...c, isActive: newValue } : c,
        ),
      );

      try {
        const response = await fetch(`/api/countries/${country._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newValue }),
        });

        const data = await response.json();

        if (data.success) {
          toast.success(t('messages.updateSuccess'));
        } else {
          setCountries((prev) =>
            prev.map((c) =>
              c._id === country._id ? { ...c, isActive: !newValue } : c,
            ),
          );
          toast.error(data.error || t('messages.saveFailed'));
        }
      } catch (error) {
        console.error('Error toggling country:', error);
        setCountries((prev) =>
          prev.map((c) =>
            c._id === country._id ? { ...c, isActive: !newValue } : c,
          ),
        );
        toast.error(t('messages.saveFailed'));
      }
    },
    [t],
  );

  const getFlagComponent = (countryCode: string) => {
    try {
      const flagComponents = flags as FlagComponents;
      const FlagComponent = flagComponents[countryCode.toUpperCase()];
      if (FlagComponent) {
        return <FlagComponent className="w-8 h-6" />;
      }
      return (
        <div className="w-8 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">
          {countryCode}
        </div>
      );
    } catch {
      return (
        <div className="w-8 h-6 bg-gray-200 rounded flex items-center justify-center text-xs">
          {countryCode}
        </div>
      );
    }
  };

  const columns = useMemo(
    () => [
      {
        header: t('table.flag'),
        accessor: (c: Country) => (
          <div className="flex items-center">{getFlagComponent(c.code)}</div>
        ),
        className: 'text-start',
      },
      {
        header: t('table.code'),
        accessor: (c: Country) => (
          <span className="font-mono text-sm font-semibold text-foreground">
            {c.code}
          </span>
        ),
      },
      {
        header: locale === 'ar' ? t('table.nameAr') : t('table.nameEn'),
        accessor: (c: Country) => (
          <span className="text-foreground">
            {locale === 'ar' ? c.name.ar : c.name.en}
          </span>
        ),
      },
      {
        header: t('table.currency'),
        accessor: (c: Country) => (
          <div className="flex items-center gap-1">
            <span className="text-foreground font-medium">
              {c.currencyCode}
            </span>
            <span className="text-secondary">({c.currencySymbol})</span>
          </div>
        ),
      },
      {
        header: t('table.status'),
        accessor: (c: Country) => (
          <Switch
            id={`country-${c._id}`}
            checked={c.isActive}
            onChange={() => handleToggleActive(c)}
          />
        ),
      },
    ],
    [t, locale, handleToggleActive],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <div className="text-secondary">{t('loadingCountries')}</div>
      </div>
    );
  }

  const activeCount = countries.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">
          {t('description')} &middot; {activeCount} / {countries.length}{' '}
          {t('status.active').toLowerCase()}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute inset-s-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full ps-10 pe-4 py-2.5 bg-card-bg border border-stroke rounded-site text-foreground placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
        </div>

        <div className="w-44">
          <Dropdown<'all' | 'active' | 'inactive'>
            value={filter}
            options={filterOptions}
            onChange={(v) => setFilter(v)}
            placeholder={t('filter.all')}
          />
        </div>
      </div>

      <Table
        columns={columns}
        data={filteredCountries}
        loading={loading}
        emptyMessage={search.trim() ? t('noResults') : t('emptyMessage')}
      />
    </div>
  );
}
