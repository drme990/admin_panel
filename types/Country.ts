export interface Country {
  _id: string;
  code: string;
  name: {
    ar: string;
    en: string;
  };
  currencyCode: string;
  currencySymbol: string;
  roundingRule:
    | 'nearest-ten'
    | 'nearest-five'
    | 'nearest-fifty'
    | 'nearest-hundred'
    | 'ceil';
  flagEmoji: string;
  isActive: boolean;
  sortOrder: number | null;
  region?: string;
  visibilityMode?: 'all' | 'custom';
  countriesToSee ?: Record<
    string,
    {
      realPrice?: boolean;
      exchangePrice?: boolean;
    }
  >;
  createdAt?: string;
  updatedAt?: string;
}
