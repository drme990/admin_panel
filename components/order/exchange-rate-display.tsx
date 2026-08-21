'use client';

import { useTranslations } from 'next-intl';
import { useExchangeRate } from '@/lib/order/use-exchange-rate';

interface ExchangeRateDisplayProps {
  /** The currency the amount is in (invoice currency) */
  fromCurrency: string;
  /** The currency to convert to (order currency) */
  toCurrency: string;
  /** The amount to convert */
  amount: number;
  /** Translation namespace */
  namespace?: 'orders' | 'execution';
}

/**
 * Displays the converted amount and exchange rate below an input.
 * Only renders when the currencies differ and the amount is positive.
 */
export default function ExchangeRateDisplay({
  fromCurrency,
  toCurrency,
  amount,
  namespace = 'orders',
}: ExchangeRateDisplayProps) {
  const t = useTranslations(`${namespace}.createManualOrder`);
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  const { loading, convertedAmount } = useExchangeRate(from, to, amount);

  if (from === to || amount <= 0) return null;

  return (
    <div className="text-xs text-secondary bg-muted/30 rounded-lg px-3 py-2">
      {loading ? (
        <span>{t('fetchingRate') || 'Fetching exchange rate…'}</span>
      ) : convertedAmount !== null ? (
        <span>
          {t('convertedAmount', {
            amount: convertedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            currency: to,
          })}
        </span>
      ) : (
        <span className="text-warning">
          {t('exchangeRateUnavailable') || 'Exchange rate unavailable'}
        </span>
      )}
    </div>
  );
}
