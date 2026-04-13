export interface Country {
  _id: string;
  code: string;
  name: {
    ar: string;
    en: string;
  };
  currencyCode: string;
  currencySymbol: string;
  roundingRule: 'nearest-ten' | 'nearest-five' | 'ceil';
  flagEmoji: string;
  isActive: boolean;
  sortOrder: number | null;
  createdAt?: string;
  updatedAt?: string;
}
