export interface CurrencyPrice {
  currencyCode: string;
  amount: number;
  isManual: boolean;
}

export interface CurrencyMinimumPayment {
  currencyCode: string;
  value: number;
  isManual: boolean;
}

export interface ProductSize {
  _id?: string;
  name: {
    ar: string;
    en: string;
  };
  /** Price in baseCurrency */
  price: number;
  /** Multi-currency converted / manually-set prices */
  prices: CurrencyPrice[];
  /** How many people / slots this size feeds / covers */
  feedsUp?: number;
}

/**
 * Partial-payment configuration.
 * Replaces the three separate fields:
 *   allowPartialPayment  →  isAllowed
 *   minimumPaymentType   →  minimumType
 *   minimumPayments      →  minimumPayments
 */
export interface PartialPayment {
  isAllowed: boolean;
  minimumType: 'percentage' | 'fixed';
  /** Per-currency minimum payment values */
  minimumPayments: CurrencyMinimumPayment[];
}

export interface ReservationFieldOption {
  ar: string;
  en: string;
}

export interface ReservationField {
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'picture';
  label: { ar: string; en: string };
  required: boolean;
  maxLength?: number;
  options?: ReservationFieldOption[];
}

export interface ProductUpgradeFeatures {
  ar: string[];
  en: string[];
}

/**
 * Enhanced Product shape.
 *
 * Key rules:
 *  - `sizes` is always present and always has at least 1 item.
 *  - `sizes.length === 1`  → single-option product;  hide size selector; use sizes[0].
 *  - `sizes.length > 1`    → multi-option product;   show size selector.
 *  - All pricing (price, prices, feedsUp) lives inside each ProductSize.
 *  - `baseCurrency` is the single canonical currency for all base prices.
 *  - `images[0]` is the primary / thumbnail image.
 */
export interface Product {
  _id: string;
  name: {
    ar: string;
    en: string;
  };
  /** SEO-friendly URL slug (e.g. "aqeeqa-sheep") */
  slug?: string;
  content?: {
    ar: string;
    en: string;
  };
  /** Canonical currency for all base prices in all sizes. */
  baseCurrency: string;
  inStock: boolean;
  /** Whether the product is published (visible to customers). Default: true */
  isActive: boolean;
  /** All product images. Use `images[0]` as the primary / thumbnail image. */
  images: string[];
  /**
   * All products use sizes as the single source of pricing truth.
   * Always at least 1 item.
   */
  sizes: ProductSize[];
  /** Partial-payment configuration */
  partialPayment: PartialPayment;
  /** Product ID to suggest as an upgrade on checkout */
  upgradeTo?: string;
  /** Discount percentage when upgrading (0 = same price, 100 = free) */
  upgradeDiscount?: number;
  /** Optional feature bullets shown to customers in upgrade modal */
  upgradeFeatures?: ProductUpgradeFeatures | null;
  workAsSacrifice?: boolean;
  sacrificeCount?: number;
  reservationFields?: ReservationField[];
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}
