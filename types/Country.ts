export interface Country {
  _id: string;
  code: string;
  name: {
    ar: string;
    en: string;
  };
  currencyCode: string;
  currencySymbol: string;
  flagEmoji: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}
