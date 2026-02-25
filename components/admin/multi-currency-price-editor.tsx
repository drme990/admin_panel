'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, DollarSign, Lock, Unlock } from 'lucide-react';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';

export interface CurrencyPrice {
  currencyCode: string;
  amount: number;
  isManual: boolean;
}

interface Country {
  _id: string;
  code: string;
  currencyCode: string;
  currencySymbol: string;
  name: { ar: string; en: string };
  isActive: boolean;
}

interface MultiCurrencyPriceEditorProps {
  mainCurrency: string;
  basePrice: number;
  prices: CurrencyPrice[];
  onChange: (prices: CurrencyPrice[]) => void;
  onMainCurrencyChange: (currency: string) => void;
  onBasePriceChange: (price: number) => void;
  compact?: boolean;
  /** When true, only the main-currency selector is shown (prices live on sizes). */
  hidePrice?: boolean;
}

export default function MultiCurrencyPriceEditor({
  mainCurrency,
  basePrice,
  prices,
  onChange,
  onMainCurrencyChange,
  onBasePriceChange,
  compact = false,
  hidePrice = false,
}: MultiCurrencyPriceEditorProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoCalculating, setAutoCalculating] = useState(false);
  const t = useTranslations('admin.products');

  useEffect(() => {
    fetchCountries();
  }, []);

  const fetchCountries = async () => {
    try {
      const res = await fetch('/api/countries?active=true');
      const data = await res.json();
      if (data.success) {
        setCountries(data.data);
      }
    } catch (error) {
      console.error('Error fetching countries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoCalculate = async () => {
    if (!basePrice || basePrice <= 0) {
      toast.error(t('form.enterBasePriceAlert'));
      return;
    }

    try {
      setAutoCalculating(true);

      // Get all unique currency codes
      const targetCurrencies = [
        ...new Set(countries.map((c) => c.currencyCode)),
      ];

      // Fetch exchange rates
      const res = await fetch(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${mainCurrency.toLowerCase()}.json`,
      );

      if (!res.ok) {
        throw new Error('Failed to fetch exchange rates');
      }

      const data = await res.json();
      const rates = data[mainCurrency.toLowerCase()] as Record<string, number>;

      // Calculate prices for all currencies
      const newPrices: CurrencyPrice[] = targetCurrencies.map((code) => {
        // Check if there's an existing manual price
        const existing = prices.find((p) => p.currencyCode === code);
        if (existing && existing.isManual) {
          return existing; // Keep manual prices
        }

        // Calculate auto price
        if (code === mainCurrency) {
          return {
            currencyCode: code,
            amount: basePrice,
            isManual: false,
          };
        }

        const rate = rates[code.toLowerCase()];
        const convertedAmount = rate ? Math.ceil(basePrice * rate) : 0;

        return {
          currencyCode: code,
          amount: convertedAmount,
          isManual: false,
        };
      });

      onChange(newPrices);
    } catch (error) {
      console.error('Error calculating prices:', error);
      toast.error(t('form.calculateFailedAlert'));
    } finally {
      setAutoCalculating(false);
    }
  };

  const handlePriceChange = (currencyCode: string, amount: number) => {
    const newPrices = prices.map((p) =>
      p.currencyCode === currencyCode ? { ...p, amount, isManual: true } : p,
    );

    // If currency doesn't exist, add it
    if (!prices.find((p) => p.currencyCode === currencyCode)) {
      newPrices.push({ currencyCode, amount, isManual: true });
    }

    onChange(newPrices);
  };

  const toggleManual = (currencyCode: string) => {
    const newPrices = prices.map((p) =>
      p.currencyCode === currencyCode ? { ...p, isManual: !p.isManual } : p,
    );
    onChange(newPrices);
  };

  const getCurrencySymbol = (code: string) => {
    const country = countries.find((c) => c.currencyCode === code);
    return country?.currencySymbol || code;
  };

  const getPriceForCurrency = (code: string): number => {
    const price = prices.find((p) => p.currencyCode === code);
    return price?.amount || 0;
  };

  const isManualPrice = (code: string): boolean => {
    const price = prices.find((p) => p.currencyCode === code);
    return price?.isManual || false;
  };

  // Get unique currencies
  const availableCurrencies = [
    ...new Set(countries.map((c) => c.currencyCode)),
  ];

  if (loading) {
    return (
      <div className="text-sm text-secondary">
        {t('form.loadingCurrencies')}
      </div>
    );
  }

  // When hidePrice is set, only show the main currency selector
  if (hidePrice) {
    return (
      <div className="p-4 bg-card-bg rounded-lg border border-stroke">
        <Dropdown
          label={`${t('form.mainCurrency')} *`}
          value={mainCurrency}
          options={availableCurrencies.map((code) => ({
            label: `${code} (${getCurrencySymbol(code)})`,
            value: code,
          }))}
          onChange={(value) => onMainCurrencyChange(value)}
        />
        <p className="text-xs text-secondary mt-2">
          {t('form.pricesOnSizesNote')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Currency and Base Price — hidden in compact mode */}
      {!compact && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-card-bg rounded-lg border border-stroke">
          <Dropdown
            label={`${t('form.mainCurrency')} *`}
            value={mainCurrency}
            options={availableCurrencies.map((code) => ({
              label: `${code} (${getCurrencySymbol(code)})`,
              value: code,
            }))}
            onChange={(value) => onMainCurrencyChange(value)}
          />

          <Input
            label={`${t('form.basePrice')} *`}
            type="number"
            step="0.01"
            min="0"
            value={basePrice || ''}
            onChange={(e) => onBasePriceChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            required
          />
        </div>
      )}

      {/* Auto Calculate Button */}
      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={handleAutoCalculate}
        disabled={autoCalculating || !basePrice || basePrice <= 0}
        className="w-full"
      >
        <RefreshCw
          className={`w-4 h-4 ${autoCalculating ? 'animate-spin' : ''}`}
        />
        {autoCalculating
          ? t('form.calculating')
          : t('form.autoCalculatePrices')}
      </Button>

      {/* Currency Prices */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          {t('form.currencyPrices')}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableCurrencies.map((code) => {
            const isManual = isManualPrice(code);
            const amount = getPriceForCurrency(code);

            return (
              <div
                key={code}
                className="flex items-center gap-2 p-3 bg-card-bg rounded-md border border-stroke"
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-foreground">
                      {code}
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleManual(code)}
                      className="text-xs text-secondary hover:text-foreground transition-colors flex items-center gap-1"
                      title={
                        isManual
                          ? t('form.manualLocked')
                          : t('form.autoCalculated')
                      }
                    >
                      {isManual ? (
                        <>
                          <Lock className="w-3 h-3" />
                          {t('form.manual')}
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3 h-3" />
                          {t('form.auto')}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-secondary">
                      {getCurrencySymbol(code)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount || ''}
                      onChange={(e) =>
                        handlePriceChange(code, parseFloat(e.target.value) || 0)
                      }
                      className={`flex-1 px-2 py-1 text-sm bg-background border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-success/20 focus:border-success ${
                        isManual ? 'border-success' : 'border-stroke'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-secondary mt-2">
          <p>
            <Lock className="inline mx-2" size={16} />{' '}
            {t('form.manualPriceHelp')}
          </p>
          <p>
            <Unlock className="inline mx-2" size={16} />{' '}
            {t('form.autoPriceHelp')}
          </p>
        </div>
      </div>
    </div>
  );
}
