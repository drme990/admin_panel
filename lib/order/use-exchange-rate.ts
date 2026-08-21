'use client';

import { useState, useEffect, useMemo } from 'react';

interface ExchangeRateResult {
  /** The exchange rate from `from` to `to`, or null if unavailable */
  rate: number | null;
  /** True while the rate is being fetched */
  loading: boolean;
  /** The converted amount (amount * rate), or null if not available */
  convertedAmount: number | null;
}

/**
 * Fetch the exchange rate between two currencies and compute the
 * converted amount. Only fetches when the currencies differ and
 * the amount is positive.
 *
 * Uses the admin panel's proxied /api/currency/rates endpoint, which
 * returns { success, data: { usd: 0.27, ... } } with lowercase keys.
 */
export function useExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  amount: number,
): ExchangeRateResult {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const currenciesDiffer = from !== to;
  const numericAmount = Number.isFinite(amount) ? amount : 0;
  const shouldFetch = currenciesDiffer && numericAmount > 0;

  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;

    // All setState calls are inside this async function, not directly
    // in the effect body, to avoid cascading renders.
    async function fetchRate() {
      setLoading(true);
      try {
        const res = await fetch(`/api/currency/rates?base=${from.toLowerCase()}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success && data.data) {
          const rates = data.data;
          // API may return keys in either case — check both
          const r = rates[to.toLowerCase()] ?? rates[to] ?? rates[to.toUpperCase()];
          setRate(typeof r === 'number' ? r : null);
        } else {
          setRate(null);
        }
      } catch {
        if (!cancelled) setRate(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchRate();
    return () => { cancelled = true; };
  }, [shouldFetch, from, to]);

  const convertedAmount = useMemo(() => {
    if (!shouldFetch || !rate || numericAmount <= 0) return null;
    return Math.round(numericAmount * rate * 100) / 100;
  }, [shouldFetch, rate, numericAmount]);

  return { rate, loading, convertedAmount };
}
