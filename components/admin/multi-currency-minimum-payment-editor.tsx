'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  LuRefreshCw as RefreshCw,
  LuPercent as Percent,
  LuLock as Lock,
  LuLockOpen as Unlock,
} from 'react-icons/lu';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import { CurrencyPrice } from '@/types/Product';
import { buildCurrencyRoundingMap, roundPrice } from '@/lib/currency-rounding';

export interface CurrencyMinimumPayment {
  currencyCode: string;
  value: number;
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
  currencyOrder?: number | null;
}

interface MultiCurrencyMinimumPaymentEditorProps {
  mainCurrency: string;
  minimumPaymentType: 'percentage' | 'fixed';
  baseMinimumValue: number;
  minimumPayments: CurrencyMinimumPayment[];
  prices: CurrencyPrice[];
  onChange: (minimumPayments: CurrencyMinimumPayment[]) => void;
  onTypeChange: (type: 'percentage' | 'fixed') => void;
  onBaseValueChange: (value: number) => void;
}

export default function MultiCurrencyMinimumPaymentEditor({
  mainCurrency,
  minimumPaymentType,
  baseMinimumValue,
  minimumPayments,
  prices,
  onChange,
  onTypeChange,
  onBaseValueChange,
}: MultiCurrencyMinimumPaymentEditorProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoCalculating, setAutoCalculating] = useState(false);
  const [mainRates, setMainRates] = useState<Record<string, number> | null>(
    null,
  );
  const t = useTranslations('admin.products');

  const roundToNearestTen = (value: number) => {
    return Math.ceil(value / 10) * 10;
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  // Fetch exchange rates for the main currency — used for the EGP hint
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
    if (!baseMinimumValue || baseMinimumValue <= 0) {
      toast.error(t('form.enterBaseMinimumAlert'));
      return;
    }

    try {
      setAutoCalculating(true);

      const now = new Date();
      const today = formatDate(now);
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(now.getDate() - 1);
      const yesterday = formatDate(yesterdayDate);

      // Get all unique currency codes — sorted by currencyOrder (same as display)
      const targetCurrencies = [
        ...new Set(countries.map((c) => c.currencyCode)),
      ].sort((a, b) => {
        const aOrder = countries.find((c) => c.currencyCode === a)?.currencyOrder ?? null;
        const bOrder = countries.find((c) => c.currencyCode === b)?.currencyOrder ?? null;
        const aSort = aOrder ?? Infinity;
        const bSort = bOrder ?? Infinity;
        if (aSort !== bSort) return aSort - bSort;
        return a.localeCompare(b);
      });
      const roundingMap = buildCurrencyRoundingMap(countries);

      if (minimumPaymentType === 'percentage') {
        // For percentage, just apply the same percentage to all currencies
        const newMinimumPayments: CurrencyMinimumPayment[] =
          targetCurrencies.map((code) => {
            // Check if there's an existing manual value
            const existing = minimumPayments.find(
              (p) => p.currencyCode === code,
            );
            if (existing && existing.isManual) {
              return existing; // Keep manual values
            }

            return {
              currencyCode: code,
              value: baseMinimumValue,
              isManual: false,
            };
          });

        onChange(newMinimumPayments);
      } else {
        // For fixed amounts, convert based on exchange rates
        let rates: Record<string, number>;
        try {
          // Try @latest first (always available)
          rates = await fetchRatesForDate(mainCurrency, 'latest');
        } catch (latestError) {
          console.warn(
            `@latest rates unavailable for ${mainCurrency}; trying ${today}`,
            latestError,
          );
          try {
            rates = await fetchRatesForDate(mainCurrency, today);
          } catch (todayError) {
            console.warn(
              `Exchange rate release ${today} unavailable for ${mainCurrency}; retrying ${yesterday}`,
              todayError,
            );
            rates = await fetchRatesForDate(mainCurrency, yesterday);
          }
        }

        // Calculate minimum payments for all currencies
        const newMinimumPayments: CurrencyMinimumPayment[] =
          targetCurrencies.map((code) => {
            // Check if there's an existing manual value
            const existing = minimumPayments.find(
              (p) => p.currencyCode === code,
            );
            if (existing && existing.isManual) {
              return existing; // Keep manual values
            }

            // Calculate auto value
            if (code.toUpperCase() === mainCurrency.toUpperCase()) {
              return {
                currencyCode: code,
                value: baseMinimumValue,
                isManual: false,
              };
            }

            const rate = rates[code.toLowerCase()];
            const convertedValue = rate
              ? roundPrice(baseMinimumValue * rate, code, roundingMap)
              : 0;

            return {
              currencyCode: code,
              value: convertedValue,
              isManual: false,
            };
          });

        onChange(newMinimumPayments);
      }

      toast.success(t('form.minimumPaymentsCalculated'));
    } catch (error) {
      console.error('Error calculating minimum payments:', error);
      toast.error(t('form.calculateFailedAlert'));
    } finally {
      setAutoCalculating(false);
    }
  };

  const handleValueChange = (currencyCode: string, value: number) => {
    const newMinimumPayments = minimumPayments.map((p) =>
      p.currencyCode === currencyCode ? { ...p, value, isManual: true } : p,
    );

    // If currency doesn't exist, add it
    if (!minimumPayments.find((p) => p.currencyCode === currencyCode)) {
      newMinimumPayments.push({ currencyCode, value, isManual: true });
    }

    onChange(newMinimumPayments);
  };

  const toggleManual = (currencyCode: string) => {
    const newMinimumPayments = minimumPayments.map((p) =>
      p.currencyCode === currencyCode ? { ...p, isManual: !p.isManual } : p,
    );
    onChange(newMinimumPayments);
  };

  const getCurrencySymbol = (code: string) => {
    const country = countries.find((c) => c.currencyCode === code);
    return country?.currencySymbol || code;
  };

  const getValueForCurrency = (code: string): number => {
    const minPayment = minimumPayments.find((p) => p.currencyCode === code);
    return minPayment?.value || 0;
  };

  const isManualValue = (code: string): boolean => {
    const minPayment = minimumPayments.find((p) => p.currencyCode === code);
    return minPayment?.isManual || false;
  };

  const getPriceForCurrency = (code: string): number => {
    const price = prices.find((p) => p.currencyCode === code);
    return price?.amount || 0;
  };

  // Convert any currency's amount back to EGP for the exchange hint.
  // Same logic as MultiCurrencyPriceEditor.getEgpValue.
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

  // Get unique currencies sorted by currencyOrder (if set), then alphabetically as fallback
  // — same ordering as MultiCurrencyPriceEditor
  const availableCurrencies = [
    ...new Set(countries.map((c) => c.currencyCode)),
  ].sort((a, b) => {
    const aOrder = countries.find((c) => c.currencyCode === a)?.currencyOrder ?? null;
    const bOrder = countries.find((c) => c.currencyCode === b)?.currencyOrder ?? null;
    const aSort = aOrder ?? Infinity;
    const bSort = bOrder ?? Infinity;
    if (aSort !== bSort) return aSort - bSort;
    return a.localeCompare(b);
  });

  // Bulk set all currencies to manual or auto — same as MultiCurrencyPriceEditor
  const applyManualState = (manual: boolean) => {
    const updated: CurrencyMinimumPayment[] = availableCurrencies.map((code) => {
      const existing = minimumPayments.find((p) => p.currencyCode === code);
      return {
        currencyCode: code,
        value: existing?.value ?? 0,
        isManual: manual,
      };
    });
    onChange(updated);
  };

  const toggleManualState = () => {
    const updated: CurrencyMinimumPayment[] = availableCurrencies.map((code) => {
      const existing = minimumPayments.find((p) => p.currencyCode === code);
      const currentManual = existing?.isManual ?? false;
      return {
        currencyCode: code,
        value: existing?.value ?? 0,
        isManual: !currentManual,
      };
    });
    onChange(updated);
  };

  if (loading) {
    return (
      <div className="text-sm text-secondary">
        {t('form.loadingCurrencies')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Type and Base Value */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-card-bg rounded-lg border border-stroke">
        <Dropdown
          label={t('form.minimumPaymentType')}
          value={minimumPaymentType}
          options={[
            {
              label: t('form.minimumPaymentPercentage'),
              value: 'percentage',
            },
            {
              label: t('form.minimumPaymentFixed'),
              value: 'fixed',
            },
          ]}
          onChange={(value) => onTypeChange(value as 'percentage' | 'fixed')}
        />

        <Input
          label={
            minimumPaymentType === 'percentage'
              ? t('form.baseMinimumPercentage')
              : `${t('form.baseMinimumFixed')} (${mainCurrency})`
          }
          type="number"
          step={minimumPaymentType === 'percentage' ? '1' : '0.01'}
          min="0"
          max={minimumPaymentType === 'percentage' ? '100' : undefined}
          value={baseMinimumValue || ''}
          onChange={(e) => onBaseValueChange(parseFloat(e.target.value) || 0)}
          placeholder={minimumPaymentType === 'percentage' ? '50' : '0.00'}
          required
        />
      </div>

      {/* Auto Calculate Button */}
      {minimumPaymentType === 'fixed' && (
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleAutoCalculate}
          disabled={
            autoCalculating || !baseMinimumValue || baseMinimumValue <= 0
          }
          className="w-full"
        >
          <RefreshCw
            className={`w-4 h-4 ${autoCalculating ? 'animate-spin' : ''}`}
          />
          {autoCalculating
            ? t('form.calculating')
            : t('form.autoCalculateMinimums')}
        </Button>
      )}

      {/* Bulk manual/auto toggles — same as MultiCurrencyPriceEditor */}
      {minimumPaymentType === 'fixed' && (
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
      )}

      {/* Currency-specific Minimum Payments (only for fixed type) */}
      {minimumPaymentType === 'fixed' && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Percent className="w-4 h-4" />
            {t('form.currencyMinimums')}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableCurrencies.map((code) => {
              const isManual = isManualValue(code);
              const value = getValueForCurrency(code);
              const price = getPriceForCurrency(code);
              const egpValue = getEgpValue(code, value);

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
                        max={price}
                        value={value || ''}
                        onChange={(e) =>
                          handleValueChange(
                            code,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className={`flex-1 px-2 py-1 text-sm bg-background border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-success/20 focus:border-success ${isManual ? 'border-success' : 'border-stroke'
                          }`}
                        placeholder="0.00"
                      />
                    </div>
                    {price > 0 && (
                      <div className="text-xs text-secondary mt-1">
                        {t('form.priceLabel')}: {getCurrencySymbol(code)}{' '}
                        {price}
                      </div>
                    )}
                    {egpValue !== null && (
                      <p className="text-xs mt-0.5">
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

          <div className="text-xs text-secondary mt-2">
            <p>
              <Lock className="inline mx-2" size={16} />{' '}
              {t('form.manualMinimumHelp')}
            </p>
            <p>
              <Unlock className="inline mx-2" size={16} />{' '}
              {t('form.autoMinimumHelp')}
            </p>
          </div>
        </div>
      )}

      {minimumPaymentType === 'percentage' && (
        <div className="text-xs text-secondary p-3 bg-card-bg rounded-md border border-stroke">
          {t('form.percentageMinimumHelp')}
        </div>
      )}
    </div>
  );
}
