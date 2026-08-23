'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { LuChevronDown, LuSearch, LuCheck } from 'react-icons/lu';
import { cn } from '@/lib/utils';

interface CountryCurrency {
  currencyCode: string;
  currencySymbol: string;
  countryNameAr: string;
  countryNameEn: string;
  flagEmoji?: string;
}

interface CurrencySelectorProps {
  value: string;
  onChange: (currencyCode: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
}

// Cache currencies across all instances (loaded once from API)
let cachedCurrencies: CountryCurrency[] | null = null;
let currenciesPromise: Promise<CountryCurrency[]> | null = null;

async function fetchCurrencies(): Promise<CountryCurrency[]> {
  if (cachedCurrencies) return cachedCurrencies;
  if (currenciesPromise) return currenciesPromise;

  currenciesPromise = (async () => {
    try {
      const res = await fetch('/api/countries?active=false');
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data)) return [];

      // Deduplicate by currencyCode — multiple countries can share a currency (e.g. EUR)
      const seen = new Set<string>();
      const currencies: CountryCurrency[] = [];

      for (const country of data.data) {
        const code = (country.currencyCode || '').toUpperCase().trim();
        if (!code || seen.has(code)) continue;
        seen.add(code);
        currencies.push({
          currencyCode: code,
          currencySymbol: country.currencySymbol || '',
          countryNameAr: country.name?.ar || '',
          countryNameEn: country.name?.en || '',
          flagEmoji: country.flagEmoji || '',
        });
      }

      // Sort: EGP, SAR, USD first (common), then alphabetical by code
      const priority = ['EGP', 'SAR', 'USD', 'EUR', 'AED', 'KWD'];
      currencies.sort((a, b) => {
        const ai = priority.indexOf(a.currencyCode);
        const bi = priority.indexOf(b.currencyCode);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.currencyCode.localeCompare(b.currencyCode);
      });

      cachedCurrencies = currencies;
      return currencies;
    } catch {
      return [];
    } finally {
      currenciesPromise = null;
    }
  })();

  return currenciesPromise;
}

export default function CurrencySelector({
  value,
  onChange,
  placeholder,
  error,
  className,
  disabled = false,
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currencies, setCurrencies] = useState<CountryCurrency[]>(cachedCurrencies ?? []);
  const [loading, setLoading] = useState(!cachedCurrencies);
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load currencies on mount if not cached.
  useEffect(() => {
    if (cachedCurrencies) return;
    let cancelled = false;
    void fetchCurrencies().then((result) => {
      if (cancelled) return;
      setCurrencies(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Filter currencies by search term (code, symbol, or country name in ar/en)
  const filteredCurrencies = useMemo(() => {
    if (!searchTerm.trim()) return currencies;
    const term = searchTerm.toLowerCase().trim();
    return currencies.filter((c) =>
      c.currencyCode.toLowerCase().includes(term) ||
      c.currencySymbol.toLowerCase().includes(term) ||
      c.countryNameEn.toLowerCase().includes(term) ||
      c.countryNameAr.includes(searchTerm.trim()),
    );
  }, [currencies, searchTerm]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  const handleSelect = (currency: CountryCurrency) => {
    onChange(currency.currencyCode);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selected = currencies.find((c) => c.currencyCode === value.toUpperCase());

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        disabled={disabled}
        className={cn(
          'w-full h-10 px-3 text-sm bg-background border rounded-lg transition-colors flex items-center justify-between gap-1',
          error ? 'border-error' : 'border-stroke focus:border-primary',
          'focus:outline-none focus:ring-2 focus:ring-primary/20',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {selected ? (
            <>
              <span className="font-bold text-foreground shrink-0">{selected.currencyCode}</span>
              {selected.currencySymbol && (
                <span className="text-xs text-secondary shrink-0">{selected.currencySymbol}</span>
              )}
            </>
          ) : (
            <span className="text-secondary truncate">
              {loading ? '...' : (placeholder || 'Currency')}
            </span>
          )}
        </div>
        <LuChevronDown
          size={14}
          className={cn('text-secondary transition-transform shrink-0', isOpen && 'rotate-180')}
        />
      </button>

      {/* Error Message */}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-card-bg border border-stroke rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-stroke shrink-0">
            <div className="relative">
              <LuSearch
                size={14}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={locale === 'ar' ? 'بحث...' : 'Search...'}
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-stroke rounded-md focus:outline-none focus:border-primary text-sm"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>

          {/* Currencies List */}
          <div className="overflow-y-auto overflow-x-hidden flex-1">
            {filteredCurrencies.length === 0 ? (
              <div className="p-4 text-center text-secondary text-sm">
                {locale === 'ar' ? 'لا توجد نتائج' : 'No currencies found'}
              </div>
            ) : (
              filteredCurrencies.map((currency) => {
                const isSelected = currency.currencyCode === value.toUpperCase();

                return (
                  <button
                    key={currency.currencyCode}
                    type="button"
                    onClick={() => handleSelect(currency)}
                    className={cn(
                      'w-full px-3 py-1.5 text-sm text-left hover:bg-background transition-colors flex items-center gap-2',
                      isSelected && 'bg-primary/10 text-primary',
                    )}
                  >
                    <span className="font-bold shrink-0">{currency.currencyCode}</span>
                    {currency.currencySymbol && (
                      <span className="text-xs text-secondary shrink-0">
                        {currency.currencySymbol}
                      </span>
                    )}
                    {isSelected && (
                      <LuCheck size={14} className="text-primary shrink-0 ms-auto" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
