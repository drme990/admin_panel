'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LuSearch as Search,
  LuArrowUp as ArrowUp,
  LuArrowDown as ArrowDown,
  LuListOrdered as ListOrdered,
  LuSettings2 as Settings2,
} from 'react-icons/lu';
import * as flags from 'country-flag-icons/react/3x2';
import { useTranslations, useLocale } from 'next-intl';
import Dropdown from '@/components/ui/dropdown';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import Switch from '@/components/ui/switch';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import VisibilitySettingsModal from './components/visibility-settings-modal';

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
  roundingRule?:
    | 'nearest-ten'
    | 'nearest-five'
    | 'nearest-fifty'
    | 'nearest-hundred'
    | 'ceil';
  flagEmoji: string;
  isActive: boolean;
  sortOrder: number | null;
  region?: string;
  visibilityMode?: 'all' | 'custom';
  countriesToSee ?: Record<
    string,
    {
      realPrice?: boolean;
      exchangePrice?: boolean;
    }
  >;
}

type VisibilityTab = 'realPrice' | 'exchangePrice';

type VisibilityCountryOptions = {
  realPrice?: boolean;
  exchangePrice?: boolean;
};

type VisibilityCountryMap = Record<string, VisibilityCountryOptions>;

type RoundingRule =
  | 'nearest-ten'
  | 'nearest-five'
  | 'nearest-fifty'
  | 'nearest-hundred'
  | 'ceil';

export default function CountriesPage() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [savingRoundingByCountry, setSavingRoundingByCountry] = useState<
    Record<string, boolean>
  >({});
  const [roundingDraftByCountry, setRoundingDraftByCountry] = useState<
    Record<string, RoundingRule | undefined>
  >({});
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Country[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);

  // Visibility settings modal state
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [visibilityCountry, setVisibilityCountry] = useState<Country | null>(
    null,
  );
  const [visibilityMode, setVisibilityMode] = useState<'all' | 'custom'>('all');
  const [visibilityTab, setVisibilityTab] =
    useState<VisibilityTab>('realPrice');
  const [countriesToSee, setCountriesToSee] =
    useState<VisibilityCountryMap>({});
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [regionFilter, setRegionFilter] = useState('all');
  const [copyFromCountryModalOpen, setCopyFromCountryModalOpen] = useState(false);
  const [copyFromCountryId, setCopyFromCountryId] = useState<string | null>(null);

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
  const [regionTableFilter, setRegionTableFilter] = useState('all');

  const roundingOptions: { label: string; value: RoundingRule }[] = useMemo(
    () => [
      {
        label: t('roundingRules.ceil'),
        value: 'ceil',
      },
      {
        label: t('roundingRules.nearestFive'),
        value: 'nearest-five',
      },
      {
        label: t('roundingRules.nearestTen'),
        value: 'nearest-ten',
      },
      {
        label: t('roundingRules.nearestFifty'),
        value: 'nearest-fifty',
      },
      {
        label: t('roundingRules.nearestHundred'),
        value: 'nearest-hundred',
      },
    ],
    [t],
  );

  const normalizeVisibilityMap = useCallback(
    (raw?: Country['countriesToSee']) => {
      if (!raw) return {};

      return Object.entries(raw).reduce<VisibilityCountryMap>(
        (acc, [code, options]) => {
          const realPrice = Boolean(options?.realPrice);
          const exchangePrice = Boolean(options?.exchangePrice);

          if (!realPrice && !exchangePrice) {
            return acc;
          }

          acc[code.toUpperCase()] = { realPrice, exchangePrice };
          return acc;
        },
        {},
      );
    },
    [],
  );

  const isCountryEnabledForTab = useCallback(
    (countryCode: string, tab: VisibilityTab) =>
      Boolean(countriesToSee[countryCode.toUpperCase()]?.[tab]),
    [countriesToSee],
  );

  const setCountryTabValue = useCallback(
    (countryCode: string, tab: VisibilityTab, enabled: boolean) => {
      setCountriesToSee((prev) => {
        const key = countryCode.toUpperCase();
        const current = prev[key] ?? {};
        const next = {
          ...prev,
          [key]: {
            ...current,
            [tab]: enabled,
          },
        };

        if (!next[key].realPrice && !next[key].exchangePrice) {
          delete next[key];
        }

        return next;
      });
    },
    [],
  );

  const regionOptions = useMemo(() => {
    const activeRegions = countries
      .filter((country) => country.isActive)
      .map((country) => country.region)
      .filter((region): region is string => Boolean(region));
    const uniqueRegions = Array.from(new Set(activeRegions)).sort((a, b) =>
      a.localeCompare(b),
    );
    const hasUnassigned = countries.some(
      (country) => country.isActive && !country.region,
    );
    const options = [
      { label: t('visibilitySettings.regionAll'), value: 'all' },
      ...uniqueRegions.map((region) => ({ label: region, value: region })),
    ];
    if (hasUnassigned) {
      options.push({
        label: t('visibilitySettings.regionUnknown'),
        value: '__unknown__',
      });
    }
    return options;
  }, [countries, t]);

  const fetchCountries = useCallback(async () => {
    try {
      const response = await fetch('/api/countries?active=false');
      const data = await response.json();
      if (data.success) setCountries(data.data);
    } catch (error) {
      console.error('Error fetching countries:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);

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

    // Sort
    result.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const ao = a.sortOrder ?? Infinity;
      const bo = b.sortOrder ?? Infinity;
      if (ao !== bo) return ao - bo;

      const nameA = locale === 'ar' ? a.name.ar : a.name.en;
      const nameB = locale === 'ar' ? b.name.ar : b.name.en;
      return nameA.localeCompare(nameB);
    });

    // Active filter
    if (filter === 'active') result = result.filter((c) => c.isActive);
    else if (filter === 'inactive') result = result.filter((c) => !c.isActive);

    // Region filter
    if (regionTableFilter !== 'all') {
      result = result.filter((c) =>
        regionTableFilter === '__unknown__'
          ? !c.region
          : c.region === regionTableFilter,
      );
    }

    // Search
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
  }, [countries, filter, regionTableFilter, search, locale]);

  const handleToggleActive = useCallback(
    async (country: Country) => {
      if (country.code === 'OT') return;
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
    [fetchCountries, t],
  );

  const setRoundingDraftForCurrency = useCallback(
    (currencyCode: string, nextRule: RoundingRule) => {
      const sameCurrencyCountries = countries.filter(
        (country) => country.currencyCode === currencyCode,
      );

      setRoundingDraftByCountry((prev) => {
        const next = { ...prev };
        sameCurrencyCountries.forEach((country) => {
          next[country._id] = nextRule;
        });
        return next;
      });
    },
    [countries],
  );

  const pendingRoundingCurrencies = useMemo(() => {
    const pending = new Map<
      string,
      { country: Country; nextRule: RoundingRule }
    >();

    countries.forEach((country) => {
      const nextRule = roundingDraftByCountry[country._id];
      if (!nextRule) return;

      const currentRule = country.roundingRule ?? 'ceil';
      if (currentRule === nextRule) return;

      if (!pending.has(country.currencyCode)) {
        pending.set(country.currencyCode, { country, nextRule });
      }
    });

    return Array.from(pending.values());
  }, [countries, roundingDraftByCountry]);

  const hasPendingRoundingChanges = pendingRoundingCurrencies.length > 0;
  const isSavingRoundingChanges = useMemo(
    () => Object.values(savingRoundingByCountry).some(Boolean),
    [savingRoundingByCountry],
  );

  const savePendingRoundingChanges = useCallback(async () => {
    if (!pendingRoundingCurrencies.length) return;

    const savingIds = pendingRoundingCurrencies.flatMap(({ country }) =>
      countries
        .filter((item) => item.currencyCode === country.currencyCode)
        .map((item) => item._id),
    );
    setSavingRoundingByCountry((prev) => {
      const next = { ...prev };
      savingIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });

    const succeededCurrencyCodes: string[] = [];

    try {
      for (const { country, nextRule } of pendingRoundingCurrencies) {
        const response = await fetch(`/api/countries/${country._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundingRule: nextRule,
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to update rounding rule');
        }

        succeededCurrencyCodes.push(country.currencyCode);
      }

      await fetchCountries();
      setRoundingDraftByCountry((prev) => {
        const next = { ...prev };
        countries.forEach((country) => {
          if (succeededCurrencyCodes.includes(country.currencyCode)) {
            delete next[country._id];
          }
        });
        return next;
      });

      toast.success(t('messages.roundingUpdateSuccess'));
    } catch {
      toast.error(t('messages.roundingUpdateFailed'));
    } finally {
      setSavingRoundingByCountry((prev) => {
        const next = { ...prev };
        savingIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
    }
  }, [countries, fetchCountries, pendingRoundingCurrencies, t]);

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

  // Visibility settings handlers
  const openVisibilityModal = (country: Country) => {
    const mode = country.visibilityMode ?? 'all';
    const normalizedVisible = normalizeVisibilityMap(
      country.countriesToSee,
    );

    setVisibilityCountry(country);
    setVisibilityMode(mode);
    setCountriesToSee(normalizedVisible);
    setVisibilityTab('realPrice');
    setRegionFilter('all');
    setCopyFromCountryId(null);
    setVisibilityOpen(true);
  };

  const toggleVisibleToCountry = (countryCode: string) => {
    const isEnabled = isCountryEnabledForTab(countryCode, visibilityTab);

    if (!isEnabled) {
      const oppositeTab: VisibilityTab =
        visibilityTab === 'realPrice' ? 'exchangePrice' : 'realPrice';

      if (isCountryEnabledForTab(countryCode, oppositeTab)) {
        toast.error(t('messages.visibilityConflictingPriceMode'));
        return;
      }
    }

    setCountryTabValue(countryCode, visibilityTab, !isEnabled);
  };

  const selectAllCountries = () => {
    setCountriesToSee((prev) => {
      const next = { ...prev };
      let skippedConflicts = 0;

      activeVisibilityCountries.forEach((country) => {
        const key = country.code.toUpperCase();
        const current = next[key] ?? {};

        const oppositeTab: VisibilityTab =
          visibilityTab === 'realPrice' ? 'exchangePrice' : 'realPrice';
        if (current[oppositeTab]) {
          skippedConflicts += 1;
          return;
        }

        next[key] = { ...current, [visibilityTab]: true };
      });

      if (skippedConflicts > 0) {
        toast.error(t('messages.visibilitySelectAllSkippedConflicts'));
      }

      return next;
    });
  };

  const clearAllCountries = () => {
    setCountriesToSee((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((countryCode) => {
        const current = next[countryCode];
        const cleared = {
          ...current,
          [visibilityTab]: false,
        };

        if (!cleared.realPrice && !cleared.exchangePrice) {
          delete next[countryCode];
          return;
        }

        next[countryCode] = cleared;
      });
      return next;
    });
  };

  const saveVisibilitySettings = async () => {
    if (!visibilityCountry) return;

    setVisibilitySaving(true);
    const previousSettings = {
      visibilityMode: visibilityCountry.visibilityMode ?? 'all',
      countriesToSee : normalizeVisibilityMap(
        visibilityCountry.countriesToSee ,
      ),
    };

    const countriesToSeeToSend =
      visibilityMode === 'custom' ? countriesToSee : {};

    // Optimistic update
    setCountries((prev) =>
      prev.map((country) =>
        country._id === visibilityCountry._id
          ? {
              ...country,
              visibilityMode,
              countriesToSee : normalizeVisibilityMap(countriesToSeeToSend),
            }
          : country,
      ),
    );

    try {
      const response = await fetch(`/api/countries/${visibilityCountry._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibilityMode,
          countriesToSee : countriesToSeeToSend,
        }),
      });


      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update visibility settings');
      }

      toast.success(t('messages.visibilityUpdateSuccess'));
      setVisibilityOpen(false);
    } catch {
      // Revert optimistic update
      setCountries((prev) =>
        prev.map((country) =>
          country._id === visibilityCountry._id
            ? { ...country, ...previousSettings }
            : country,
        ),
      );
      toast.error(t('messages.visibilityUpdateFailed'));
    } finally {
      setVisibilitySaving(false);
    }
  };

  const handleCopyFromCountry = (countryId: string) => {
    const sourceCountry = countries.find(c => c._id === countryId);
    if (!sourceCountry || !visibilityCountry) return;

    const copiedSettings = normalizeVisibilityMap(sourceCountry.countriesToSee);
    
    // Add the current country to the visibility settings as well
    const currentCountryCode = visibilityCountry.code.toUpperCase();
    copiedSettings[currentCountryCode] = {
      realPrice: true,
      exchangePrice: true,
    };

    setCountriesToSee(copiedSettings);
    setVisibilityMode('custom');
  };

  const regionTableOptions = useMemo(() => {
    const regions = countries
      .map((c) => c.region)
      .filter((r): r is string => Boolean(r));

    const unique = Array.from(new Set(regions)).sort((a, b) =>
      a.localeCompare(b),
    );

    const hasUnknown = countries.some((c) => !c.region);

    const options = [
      { label: t('visibilitySettings.regionAll'), value: 'all' },
      ...unique.map((r) => ({ label: r, value: r })),
    ];

    if (hasUnknown) {
      options.push({
        label: t('visibilitySettings.regionUnknown'),
        value: '__unknown__',
      });
    }

    return options;
  }, [countries, t]);

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
            <span className="text-foreground font-medium">
              {c.currencyCode}
            </span>
            <span className="text-secondary">({c.currencySymbol})</span>
          </div>
        ),
      },
      {
        header: t('table.rounding'),
        accessor: (c: Country) => (
          <div className="min-w-64 space-y-2">
            <Dropdown<RoundingRule>
              value={roundingDraftByCountry[c._id] ?? c.roundingRule ?? 'ceil'}
              options={roundingOptions}
              onChange={(value) => {
                setRoundingDraftForCurrency(c.currencyCode, value);
              }}
              disabled={Boolean(savingRoundingByCountry[c._id])}
            />
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
            disabled={c.code === 'OT'}
          />
        ),
      },
      {
        header: t('table.actions'),
        accessor: (c: Country) => (
          <Button
            variant="ghost"
            size="custom"
            onClick={() => openVisibilityModal(c)}
            className="p-2 hover:text-primary"
            title={t('visibilitySettings.title')}
          >
            <Settings2 size={18} />
          </Button>
        ),
        className: 'text-center w-20',
      },
    ],
    [
      t,
      locale,
      handleToggleActive,
      orderMap,
      roundingOptions,
      savingRoundingByCountry,
      roundingDraftByCountry,
      setRoundingDraftForCurrency,
    ],
  );

  const activeCount = countries.filter((c) => c.isActive).length;

  const activeVisibilityCountries = useMemo(() => {
    let filtered = countries.filter((c) => c.isActive);

    // Never allow selecting the country itself; self visibility is resolved by backend.
    if (visibilityCountry) {
      filtered = filtered.filter(
        (country) => country.code !== visibilityCountry.code,
      );
    }

    // Region filter
    if (regionFilter !== 'all') {
      filtered = filtered.filter((country) =>
        regionFilter === '__unknown__'
          ? !country.region
          : country.region === regionFilter,
      );
    }

    return filtered.sort((a, b) => {
      const nameA = locale === 'ar' ? a.name.ar : a.name.en;
      const nameB = locale === 'ar' ? b.name.ar : b.name.en;
      return nameA.localeCompare(nameB);
    });
  }, [countries, regionFilter, visibilityCountry, locale]);

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
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            onClick={openReorderModal}
            disabled={activeCount === 0}
          >
            <ListOrdered size={20} />
            {t('reorderButton')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void savePendingRoundingChanges()}
            disabled={!hasPendingRoundingChanges || isSavingRoundingChanges}
          >
            {isSavingRoundingChanges
              ? '...'
              : t('messages.saveRoundingChanges')}
          </Button>
        </div>
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

        {/* Active filter */}
        <div className="w-44">
          <Dropdown<'all' | 'active' | 'inactive'>
            value={filter}
            options={filterOptions}
            onChange={(v) => setFilter(v)}
          />
        </div>

        {/* ✅ NEW Region filter */}
        <div className="w-52">
          <Dropdown<string>
            value={regionTableFilter}
            options={regionTableOptions}
            onChange={setRegionTableFilter}
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
        onClose={() => {
          if (!reorderSaving) setReorderOpen(false);
        }}
        title={t('reorderModal.title')}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setReorderOpen(false)}
              disabled={reorderSaving}
            >
              {t('reorderModal.cancel')}
            </Button>
            <Button onClick={saveReorder} disabled={reorderSaving}>
              {reorderSaving ? '...' : t('reorderModal.save')}
            </Button>
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
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={() => moveInModal(index, 'up')}
                  disabled={index === 0}
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={() => moveInModal(index, 'down')}
                  disabled={index === reorderList.length - 1}
                >
                  <ArrowDown size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Visibility Settings Modal */}
      <VisibilitySettingsModal
        visibilityOpen={visibilityOpen}
        setVisibilityOpen={setVisibilityOpen}
        visibilityCountry={visibilityCountry}
        visibilityMode={visibilityMode}
        setVisibilityMode={setVisibilityMode}
        visibilityTab={visibilityTab}
        setVisibilityTab={setVisibilityTab}
        countriesToSee ={countriesToSee }
        toggleVisibleToCountry={toggleVisibleToCountry}
        selectAllCountries={selectAllCountries}
        clearAllCountries={clearAllCountries}
        saveVisibilitySettings={saveVisibilitySettings}
        visibilitySaving={visibilitySaving}
        regionFilter={regionFilter}
        setRegionFilter={setRegionFilter}
        regionOptions={regionOptions}
        activeVisibilityCountries={activeVisibilityCountries}
        copyFromCountryModalOpen={copyFromCountryModalOpen}
        setCopyFromCountryModalOpen={setCopyFromCountryModalOpen}
        copyFromCountryId={copyFromCountryId}
        setCopyFromCountryId={setCopyFromCountryId}
        allCountries={countries}
        onCopyFromCountry={handleCopyFromCountry}
      />
    </div>
  );
}
