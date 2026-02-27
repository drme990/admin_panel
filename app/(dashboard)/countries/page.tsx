'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react';
import * as flags from 'country-flag-icons/react/3x2';
import { useTranslations, useLocale } from 'next-intl';
import Dropdown from '@/components/ui/dropdown';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import Switch from '@/components/ui/switch';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';

type FlagComponents = Record<
  string,
  React.ComponentType<{ className?: string }>
>;

interface Country {
  _id: string;
  code: string;
  name: { ar: string; en: string };
  currencyCode: string;
  currencySymbol: string;
  flagEmoji: string;
  isActive: boolean;
  sortOrder: number | null;
}

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Country[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
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
      if (data.success) setCountries(data.data);
    } catch (error) {
      console.error('Error fetching countries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Active countries in their sorted order — used for Order column display
  const activeCountries = useMemo(
    () =>
      countries
        .filter((c) => c.isActive)
        .sort((a, b) => {
          const ao = a.sortOrder ?? Infinity;
          const bo = b.sortOrder ?? Infinity;
          return ao !== bo
            ? ao - bo
            : (locale === 'ar' ? a.name.ar : a.name.en).localeCompare(
                locale === 'ar' ? b.name.ar : b.name.en,
              );
        }),
    [countries, locale],
  );

  // Map _id → 1-based position (for Order column)
  const orderMap = useMemo(() => {
    const map = new Map<string, number>();
    activeCountries.forEach((c, i) => map.set(c._id, i + 1));
    return map;
  }, [activeCountries]);

  const filteredCountries = useMemo(() => {
    let result = [...countries];
    // Sort: active countries first by sortOrder, inactive after alphabetically (null sortOrder last)
    result.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const ao = a.sortOrder ?? Infinity;
      const bo = b.sortOrder ?? Infinity;
      if (ao !== bo) return ao - bo;
      const nameA = locale === 'ar' ? a.name.ar : a.name.en;
      const nameB = locale === 'ar' ? b.name.ar : b.name.en;
      return nameA.localeCompare(nameB);
    });
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
  }, [countries, filter, search, locale]);

  const handleToggleActive = useCallback(
    async (country: Country) => {
      const newValue = !country.isActive;

      // Optimistic toggle
      setCountries((prev) =>
        prev.map((c) =>
          c._id === country._id ? { ...c, isActive: newValue } : c,
        ),
      );

      try {
        // 1. Toggle the country's active state
        const res = await fetch(`/api/countries/${country._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newValue }),
        });
        const data = await res.json();
        if (!data.success) {
          setCountries((prev) =>
            prev.map((c) =>
              c._id === country._id ? { ...c, isActive: !newValue } : c,
            ),
          );
          toast.error(data.error || t('messages.saveFailed'));
          return;
        }

        // 2. Re-fetch to get current active list, then normalize sort orders
        const freshRes = await fetch('/api/countries?active=false');
        const freshData = await freshRes.json();
        if (!freshData.success) {
          await fetchCountries();
          toast.success(t('messages.updateSuccess'));
          return;
        }

        // 3. Compute new contiguous order for active countries
        const active = (freshData.data as Country[])
          .filter((c) => c.isActive)
          .sort((a, b) => {
            const ao = a.sortOrder ?? Infinity;
            const bo = b.sortOrder ?? Infinity;
            return ao !== bo ? ao - bo : a.name.ar.localeCompare(b.name.ar);
          });

        // 4. Normalize via reorder endpoint (sets contiguous 0-based order + nullifies inactive)
        await fetch('/api/countries/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderedIds: active.map((c) => c._id) }),
        });

        // 5. Always refetch to get the authoritative state
        await fetchCountries();
        toast.success(t('messages.updateSuccess'));
      } catch {
        await fetchCountries();
        toast.error(t('messages.saveFailed'));
      }
    },
    [t],
  );

  const openReorderModal = () => {
    setReorderList([...activeCountries]);
    setReorderOpen(true);
  };

  const moveInModal = (index: number, direction: 'up' | 'down') => {
    const newList = [...reorderList];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    setReorderList(newList);
  };

  const saveReorder = async () => {
    setReorderSaving(true);
    try {
      const orderedIds = reorderList.map((c) => c._id);
      const res = await fetch('/api/countries/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      const data = await res.json();
      if (data.success) {
        // Always refetch from canonical GET to ensure consistent data format
        await fetchCountries();
        setReorderOpen(false);
        toast.success(t('messages.reorderSuccess'));
      } else {
        toast.error(data.error || t('messages.reorderFailed'));
      }
    } catch {
      toast.error(t('messages.reorderFailed'));
    } finally {
      setReorderSaving(false);
    }
  };

  const getFlagComponent = (countryCode: string) => {
    try {
      const flagComponents = flags as FlagComponents;
      const FlagComponent = flagComponents[countryCode.toUpperCase()];
      if (FlagComponent) return <FlagComponent className="w-8 h-6" />;
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
        header: t('table.order'),
        accessor: (c: Country) =>
          c.isActive ? (
            <span className="font-mono text-sm font-semibold text-foreground">
              #{orderMap.get(c._id)}
            </span>
          ) : (
            <span className="text-secondary text-sm select-none">—</span>
          ),
        className: 'text-start w-16',
      },
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
            <span className="text-foreground font-medium">{c.currencyCode}</span>
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
    [t, locale, handleToggleActive, orderMap],
  );

  const activeCount = countries.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">
            {t('description')} &middot; {activeCount} / {countries.length}{' '}
            {t('status.active').toLowerCase()}
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={openReorderModal}
          disabled={activeCount === 0}
        >
          <ListOrdered size={20} />
          {t('reorderButton')}
        </Button>
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

      {/* Reorder Modal */}
      <Modal
        isOpen={reorderOpen}
        onClose={() => { if (!reorderSaving) setReorderOpen(false); }}
        title={t('reorderModal.title')}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => setReorderOpen(false)}
              disabled={reorderSaving}
              className="px-4 py-2 rounded-lg border border-stroke text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {t('reorderModal.cancel')}
            </button>
            <button
              onClick={saveReorder}
              disabled={reorderSaving}
              className="px-4 py-2 rounded-lg bg-primary text-background hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {reorderSaving ? '...' : t('reorderModal.save')}
            </button>
          </div>
        }
      >
        <p className="text-secondary text-sm mb-4">
          {t('reorderModal.description')}
        </p>
        <div className="space-y-2 max-h-105 overflow-y-auto pe-1">
          {reorderList.map((country, index) => (
            <div
              key={country._id}
              className="flex items-center gap-3 p-3 bg-muted/30 border border-stroke rounded-lg"
            >
              <span className="text-sm font-semibold text-secondary w-6 text-center shrink-0">
                {index + 1}
              </span>
              <div className="w-8 h-6 rounded-sm overflow-hidden shrink-0">
                {getFlagComponent(country.code)}
              </div>
              <span className="flex-1 font-medium text-foreground text-sm">
                {locale === 'ar' ? country.name.ar : country.name.en}
              </span>
              <span className="text-xs text-secondary font-mono shrink-0">
                {country.currencyCode}
              </span>
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => moveInModal(index, 'up')}
                  disabled={index === 0}
                  className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveInModal(index, 'down')}
                  disabled={index === reorderList.length - 1}
                  className="p-1 hover:bg-muted rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
