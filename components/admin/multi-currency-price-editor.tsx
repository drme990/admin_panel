'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  LuRefreshCw as RefreshCw,
  LuDollarSign as DollarSign,
  LuLock as Lock,
  LuLockOpen as Unlock,
} from 'react-icons/lu';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import { buildCurrencyRoundingMap, roundPrice } from '@/lib/currency-rounding';

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
  roundingRule?: 'nearest-ten' | 'nearest-five' | 'ceil';
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
  const [mainRates, setMainRates] = useState<Record<string, number> | null>(
    null,
  );
  const t = useTranslations('admin.products');

  const roundToNearestTen = (value: number) => {
    return Math.round(value / 10) * 10;
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  useEffect(() => {
    if (!mainCurrency) return;

    let isActive = true;

    const fetchMainRates = async () => {
      try {
        const now = new Date();
        const today = formatDate(now);
        const yesterdayDate = new Date(now);
        yesterdayDate.setDate(now.getDate() - 1);
        const yesterday = formatDate(yesterdayDate);

        let rates: Record<string, number>;
        try {
          rates = await fetchRatesForDate(mainCurrency, today);
        } catch (todayError) {
          console.warn(
            `Exchange rate release ${today} unavailable for ${mainCurrency}; retrying ${yesterday}`,
            todayError,
          );
          rates = await fetchRatesForDate(mainCurrency, yesterday);
        }

        if (isActive) {
          setMainRates(rates);
        }
      } catch (error) {
        console.warn('Failed to load exchange rates', error);
        if (isActive) {
          setMainRates(null);
        }
      }
    };

    void fetchMainRates();

    return () => {
      isActive = false;
    };
  }, [mainCurrency]);

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

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchRatesForDate = async (
    currencyCode: string,
    releaseDate: string,
  ): Promise<Record<string, number>> => {
    const normalizedCode = currencyCode.toLowerCase();
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${releaseDate}/v1/currencies/${normalizedCode}.json`,
    );

    if (!res.ok) {
      throw new Error(
        `Exchange rate API returned ${res.status} for ${releaseDate}`,
      );
    }

    const data = await res.json();
    const rates = data[normalizedCode] as Record<string, number> | undefined;

    if (!rates || typeof rates !== 'object') {
      throw new Error(
        `Invalid exchange rate data format for ${currencyCode} on ${releaseDate}`,
      );
    }

    return rates;
  };

  const handleAutoCalculate = async () => {
    if (!basePrice || basePrice <= 0) {
      toast.error(t('form.enterBasePriceAlert'));
      return;
    }

    try {
      setAutoCalculating(true);

      const now = new Date();
      const today = formatDate(now);
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      const yesterday = formatDate(yesterdayDate);

      // Get all unique currency codes (sorted A→Z)
      const targetCurrencies = [
        ...new Set(countries.map((c) => c.currencyCode)),
      ].sort((a, b) => a.localeCompare(b));
      const roundingMap = buildCurrencyRoundingMap(countries);

      let rates: Record<string, number>;
      try {
        rates = await fetchRatesForDate(mainCurrency, today);
      } catch (todayError) {
        console.warn(
          `Exchange rate release ${today} unavailable for ${mainCurrency}; retrying ${yesterday}`,
          todayError,
        );
        rates = await fetchRatesForDate(mainCurrency, yesterday);
      }

      // Calculate prices for all currencies
      const newPrices: CurrencyPrice[] = targetCurrencies.map((code) => {
        // Check if there's an existing manual price
        const existing = prices.find((p) => p.currencyCode === code);
        if (existing && existing.isManual) {
          return existing; // Keep manual prices
        }

        // Calculate auto price
        if (code.toUpperCase() === mainCurrency.toUpperCase()) {
          return {
            currencyCode: code,
            amount: basePrice,
            isManual: false,
          };
        }

        const rate = rates[code.toLowerCase()];
        const convertedAmount = rate
          ? roundPrice(basePrice * rate, code, roundingMap)
          : 0;

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

  const getEgpValue = (code: string, amount: number): number | null => {
    if (!mainRates || amount <= 0) return null;

    const rateToEgp = mainRates.egp;
    if (!Number.isFinite(rateToEgp)) return null;

    const upperCode = code.toUpperCase();
    const upperMain = mainCurrency.toUpperCase();

    if (upperCode === 'EGP') {
      return amount;
    }

    if (upperCode === upperMain) {
      return amount * (rateToEgp as number);
    }

    const rateToCode = mainRates[code.toLowerCase()];
    if (!Number.isFinite(rateToCode) || !rateToCode) return null;

    return (amount / rateToCode) * (rateToEgp as number);
  };

  const isManualPrice = (code: string): boolean => {
    const price = prices.find((p) => p.currencyCode === code);
    return price?.isManual || false;
  };

  // Get unique currencies sorted A→Z
  const availableCurrencies = [
    ...new Set(countries.map((c) => c.currencyCode)),
  ].sort((a, b) => a.localeCompare(b));

  const applyManualState = (manual: boolean) => {
    const updatedPrices: CurrencyPrice[] = availableCurrencies.map((code) => {
      const existing = prices.find((p) => p.currencyCode === code);
      return {
        currencyCode: code,
        amount: existing?.amount ?? 0,
        isManual: manual,
      };
    });

    onChange(updatedPrices);
  };

  const toggleManualState = () => {
    const updatedPrices: CurrencyPrice[] = availableCurrencies.map((code) => {
      const existing = prices.find((p) => p.currencyCode === code);
      const currentManual = existing?.isManual ?? false;
      return {
        currencyCode: code,
        amount: existing?.amount ?? 0,
        isManual: !currentManual,
      };
    });

    onChange(updatedPrices);
  };

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
          label={`${t('form.mainCurrency')}`}
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
            label={`${t('form.mainCurrency')}`}
            value={mainCurrency}
            options={availableCurrencies.map((code) => ({
              label: `${code} (${getCurrencySymbol(code)})`,
              value: code,
            }))}
            onChange={(value) => onMainCurrencyChange(value)}
          />

          <Input
            label={`${t('form.basePrice')}`}
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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyManualState(true)}
          className="w-full"
        >
          {t('form.setAllManual')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => applyManualState(false)}
          className="w-full"
        >
          {t('form.setAllAuto')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleManualState}
          className="w-full"
        >
          {t('form.oppositeAll')}
        </Button>
      </div>

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
            const egpValue = getEgpValue(code, amount);

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
                    <Button
                      variant="custom"
                      size="custom"
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
                    </Button>
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
                  {egpValue !== null && (
                    <p className="text-xs">
                      {t('form.egpExchangeHint', {
                        amount: new Intl.NumberFormat(undefined, {
                          maximumFractionDigits: 2,
                        }).format(roundToNearestTen(egpValue)),
                      })}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
