import { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LuChevronDown, LuSearch, LuCheck } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { COUNTRIES, type Country } from '@/lib/countries';

interface CountrySelectorProps {
  value: string;
  onChange: (countryName: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
}

export default function CountrySelector({
  value,
  onChange,
  placeholder,
  error,
  className,
  disabled = false,
  allowClear = false,
  clearLabel,
}: CountrySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const locale = useLocale();
  const t = useTranslations('countrySelector');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Use static countries array
  const countries = COUNTRIES;

  // Filter countries based on search term
  const filteredCountries = countries.filter((country) => {
    const displayName = locale === 'ar' ? country.ar : country.en;
    return displayName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Handle click outside to close dropdown
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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (country: Country) => {
    onChange(country.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
    setSearchTerm('');
  };

  const normalizedValue = value.trim().toLowerCase();
  const selectedCountry = countries.find(
    (country) =>
      country.value.toLowerCase() === normalizedValue ||
      country.en.toLowerCase() === normalizedValue ||
      country.ar.toLowerCase() === normalizedValue ||
      country.code.toLowerCase() === normalizedValue,
  );

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
          'w-full h-12 px-4 py-3 text-left bg-background border rounded-lg transition-colors flex items-center justify-between',
          error ? 'border-error' : 'border-stroke focus:border-success',
          'focus:outline-none focus:ring-2 focus:ring-success/20',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span
            className={cn(
              'truncate',
              selectedCountry ? 'text-foreground' : 'text-secondary',
            )}
          >
            {selectedCountry
              ? locale === 'ar'
                ? selectedCountry.ar
                : selectedCountry.en
              : placeholder || t('countryPlaceholder')}
          </span>
        </div>
        <LuChevronDown
          size={16}
          className={cn(
            'text-secondary transition-transform shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Error Message */}
      {error && <p className="mt-1 text-sm text-error">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-stroke rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-stroke">
            <div className="relative">
              <LuSearch
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('searchCountry', {
                  defaultValue: 'Search countries...',
                })}
                className="w-full pl-10 pr-4 py-2 bg-card-bg border border-stroke rounded-lg focus:outline-none focus:border-success text-sm"
                dir={locale === 'ar' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>

          {allowClear && value.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full border-b border-stroke px-4 py-3 text-left text-sm font-medium text-secondary transition-colors hover:bg-card-bg hover:text-foreground"
            >
              {clearLabel ||
                t('clearCountry', { defaultValue: 'Clear country' })}
            </button>
          )}

          {/* Countries List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCountries.length === 0 ? (
              <div className="p-4 text-center text-secondary text-sm">
                {t('noCountriesFound', { defaultValue: 'No countries found' })}
              </div>
            ) : (
              filteredCountries.map((country) => {
                const displayName = locale === 'ar' ? country.ar : country.en;
                const isSelected = country.value === value;

                return (
                  <button
                    key={country.value}
                    type="button"
                    onClick={() => handleSelect(country)}
                    className={cn(
                      'w-full px-4 py-3 text-left hover:bg-card-bg transition-colors flex items-center gap-3',
                      isSelected && 'bg-success/10',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-medium">
                        {displayName}
                      </span>
                    </div>
                    {isSelected && (
                      <LuCheck size={16} className="text-success shrink-0" />
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
