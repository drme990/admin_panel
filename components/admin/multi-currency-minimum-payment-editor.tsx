'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Percent, Lock, Unlock } from 'lucide-react';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import { CurrencyPrice } from '@/types/Product';

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
    if (!baseMinimumValue || baseMinimumValue <= 0) {
      toast.error(t('form.enterBaseMinimumAlert'));
      return;
    }

    try {
      setAutoCalculating(true);

      // Get all unique currency codes
      const targetCurrencies = [
        ...new Set(countries.map((c) => c.currencyCode)),
      ];

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
        const res = await fetch(
          `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${mainCurrency.toLowerCase()}.json`,
        );

        if (!res.ok) {
          throw new Error('Failed to fetch exchange rates');
        }

        const data = await res.json();
        const rates = data[mainCurrency.toLowerCase()] as Record<
          string,
          number
        >;

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
            if (code === mainCurrency) {
              return {
                currencyCode: code,
                value: baseMinimumValue,
                isManual: false,
              };
            }

            const rate = rates[code.toLowerCase()];
            const convertedValue = rate
              ? Math.ceil(baseMinimumValue * rate)
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
                        max={price}
                        value={value || ''}
                        onChange={(e) =>
                          handleValueChange(
                            code,
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className={`flex-1 px-2 py-1 text-sm bg-background border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-success/20 focus:border-success ${
                          isManual ? 'border-success' : 'border-stroke'
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
