'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuChevronDown, LuSearch } from 'react-icons/lu';
import { useLocale } from 'next-intl';
import * as Flags from 'country-flag-icons/react/3x2';

import { cn } from '@/lib/utils';

interface CountryOption {
  code: string;
  name: { ar: string; en: string };
  currencyCode: string;
}

interface CountrySelectorProps {
  value: string;
  onChange: (countryCode: string) => void;
  countries: CountryOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsLabel?: string;
  disabled?: boolean;
  className?: string;
  allOptionLabel?: string;
}

export default function CountrySelector({
  value,
  onChange,
  countries,
  placeholder,
  searchPlaceholder,
  noResultsLabel,
  disabled = false,
  className,
  allOptionLabel,
}: CountrySelectorProps) {
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedValue = value.trim().toUpperCase();

  const options = useMemo(() => {
    const base = countries.slice();

    if (allOptionLabel) {
      base.unshift({
        code: 'ALL',
        name: { en: allOptionLabel, ar: allOptionLabel },
        currencyCode: 'ALL',
      });
    }

    return base;
  }, [countries, allOptionLabel]);

  const filteredOptions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return options;

    return options.filter((country) => {
      const displayName = locale === 'ar' ? country.name.ar : country.name.en;

      return (
        displayName.toLowerCase().includes(query) ||
        country.code.toLowerCase().includes(query) ||
        country.currencyCode.toLowerCase().includes(query)
      );
    });
  }, [options, searchTerm, locale]);

  const selectedCountry = options.find(
    (country) => country.code.toUpperCase() === normalizedValue,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (country: CountryOption) => {
    onChange(country.code);
    setIsOpen(false);
    setSearchTerm('');
  };

  const displayName = selectedCountry
    ? locale === 'ar'
      ? selectedCountry.name.ar
      : selectedCountry.name.en
    : placeholder;

  const renderFlag = (countryCode: string) => {
    if (countryCode === 'ALL') return null;

    const Flag = Flags[
      countryCode as keyof typeof Flags
    ] as React.ComponentType<React.SVGProps<SVGSVGElement>>;

    if (!Flag) return null;

    return <Flag className="w-5 h-4 rounded-sm overflow-hidden shrink-0" />;
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={cn(
          'w-full h-12 px-4 py-3 text-left bg-background border rounded-lg transition-colors flex items-center justify-between',
          'focus:outline-none focus:ring-2 focus:ring-primary/30',
          disabled ? 'opacity-50 cursor-not-allowed' : 'border-stroke',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          {selectedCountry && renderFlag(selectedCountry.code)}

          <span
            className={cn(
              'truncate',
              selectedCountry ? 'text-foreground' : 'text-secondary',
            )}
          >
            {displayName || ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedCountry?.currencyCode && selectedCountry.code !== 'ALL' && (
            <span className="text-xs text-secondary">
              {selectedCountry.currencyCode}
            </span>
          )}

          <LuChevronDown
            size={16}
            className={cn(
              'text-secondary transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </div>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-card-bg border border-stroke rounded-lg shadow-lg overflow-hidden">
          <div className="p-3 border-b border-stroke">
            <div className="relative">
              <LuSearch
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
              />

              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder || 'Search countries...'}
                className="w-full pl-10 pr-4 py-2 bg-background border border-stroke rounded-lg focus:outline-none focus:border-primary text-sm"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-secondary text-sm">
                {noResultsLabel || 'No results'}
              </div>
            ) : (
              filteredOptions.map((country) => {
                const label =
                  locale === 'ar' ? country.name.ar : country.name.en;

                const isSelected = country.code === selectedCountry?.code;

                return (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-background transition-colors flex items-center gap-3',
                      isSelected && 'bg-primary/10',
                    )}
                  >
                    {renderFlag(country.code)}

                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-medium">
                        {label}
                      </span>

                      {country.code !== 'ALL' && (
                        <span className="text-xs text-secondary">
                          {country.code} - {country.currencyCode}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <LuCheck size={16} className="text-primary" />
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
