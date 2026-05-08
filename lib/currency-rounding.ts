/**
 * Currency-specific rounding rules for auto-calculated prices.
 *
 * Rules are configured from countries data in the admin backend.
 */

export type RoundingRule =
  | 'nearest-ten'
  | 'nearest-five'
  | 'nearest-fifty'
  | 'nearest-hundred'
  | 'ceil';

type CountryWithRounding = {
  currencyCode: string;
  roundingRule?: RoundingRule | null;
};

export function roundPriceByRule(
  amount: number,
  rule: RoundingRule = 'ceil',
): number {
  switch (rule) {
    case 'nearest-ten':
      return Math.ceil(amount / 10) * 10;
    case 'nearest-five':
      return Math.ceil(amount / 5) * 5;
    case 'nearest-fifty':
      return Math.ceil(amount / 50) * 50;
    case 'nearest-hundred':
      return Math.ceil(amount / 100) * 100;
    case 'ceil':
    default:
      return Math.ceil(amount);
  }
}

export function buildCurrencyRoundingMap(
  countries: CountryWithRounding[],
): Record<string, RoundingRule> {
  const map: Record<string, RoundingRule> = {};

  for (const country of countries) {
    const code = country.currencyCode?.toUpperCase();
    if (!code || map[code]) continue;
    map[code] = country.roundingRule ?? 'ceil';
  }

  return map;
}

/** Apply the rounding rule for the given currency code. */
export function roundPrice(
  amount: number,
  currencyCode: string,
  roundingMap?: Record<string, RoundingRule>,
): number {
  const rule = roundingMap?.[currencyCode.toUpperCase()] ?? 'ceil';
  return roundPriceByRule(amount, rule);
}
