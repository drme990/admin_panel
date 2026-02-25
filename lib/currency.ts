/**
 * Currency conversion service using fawazahmed0 Exchange Rate API.
 * Fetches live rates and converts prices between currencies.
 *
 * Uses: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{currency}.json
 * Free, CDN-cached, no API key required, reliable.
 */

interface ExchangeRateResponse {
  date: string;
  [currencyCode: string]: string | Record<string, number>;
}

// In-memory cache with TTL (6 hours - since API is CDN cached)
const cache: Map<string, { data: Record<string, number>; expiry: number }> =
  new Map();

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Get exchange rates for a given base currency.
 */
export async function getExchangeRates(
  baseCurrency: string,
): Promise<Record<string, number>> {
  const key = baseCurrency.toLowerCase();
  const cached = cache.get(key);

  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${key}.json`,
      { next: { revalidate: 21600 } }, // Cache for 6 hours in Next.js
    );

    if (!res.ok) {
      throw new Error(`Exchange rate API returned ${res.status}`);
    }

    const data: ExchangeRateResponse = await res.json();

    // Extract rates from the response (format: { date, [baseCurrency]: { targetCurrency: rate, ... } })
    const rates = data[key] as Record<string, number>;

    if (!rates || typeof rates !== 'object') {
      throw new Error(`Invalid exchange rate data format for ${key}`);
    }

    // Normalize currency codes to uppercase for consistency
    const normalizedRates: Record<string, number> = {};
    for (const [currency, rate] of Object.entries(rates)) {
      normalizedRates[currency.toUpperCase()] = rate;
    }

    cache.set(key, {
      data: normalizedRates,
      expiry: Date.now() + CACHE_TTL_MS,
    });

    return normalizedRates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    // Return cached data even if expired, as fallback
    if (cached) return cached.data;
    throw error;
  }
}

/**
 * Convert an amount from one currency to another.
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return amount;
  }

  const rates = await getExchangeRates(fromCurrency.toUpperCase());
  const rate = rates[toCurrency.toUpperCase()];

  if (!rate) {
    throw new Error(
      `No exchange rate found for ${fromCurrency} → ${toCurrency}`,
    );
  }

  // Round to 2 decimal places
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Convert a base price to multiple currencies at once.
 * Returns a map of currency code → converted amount.
 */
export async function convertToMultipleCurrencies(
  amount: number,
  baseCurrency: string,
  targetCurrencies: string[],
): Promise<Record<string, number>> {
  const rates = await getExchangeRates(baseCurrency.toUpperCase());
  const result: Record<string, number> = {};

  for (const target of targetCurrencies) {
    const code = target.toUpperCase();
    if (code === baseCurrency.toUpperCase()) {
      result[code] = amount;
    } else if (rates[code]) {
      result[code] = Math.round(amount * rates[code] * 100) / 100;
    }
  }

  return result;
}
