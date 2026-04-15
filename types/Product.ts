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

export type ProductPlatform = 'ghadaq' | 'manasik';
export type ProductMediaPlatform = 'shared' | ProductPlatform;

export interface ProductMedia {
  url: string;
  platform: ProductMediaPlatform;
}

export interface ReservationFieldOption {
  ar: string;
  en: string;
}

export interface ReservationField {
  key:
    | 'intention'
    | 'sacrificeFor'
    | 'gender'
    | 'isAlive'
    | 'shortDuaa'
    | 'photo'
    | 'executionDate';
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'radio'
    | 'picture';
  label: { ar: string; en: string };
  required: boolean;
  maxLength?: number;
  options?: ReservationFieldOption[];
  supportsMulti?: boolean;
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
 *  - `media` can contain images and videos.
 */
export interface Product {
  _id: string;
  name: {
    ar: string;
    en: string;
  };
  /** SEO-friendly URL slug (e.g. "aqeeqa-sheep") */
  slug: string;
  content?: {
    ar: string;
    en: string;
  };
  /** Canonical currency for all base prices in all sizes. */
  baseCurrency: string;
  inStock: boolean;
  isBestSeller?: boolean;
  /** Whether the product is published (visible to customers). Default: true */
  isActive: boolean;
  /** Whether paying half is available for this product. Default: true */
  supportsHalfPayment?: boolean;
  /** All product media with per-platform visibility rules. */
  media: ProductMedia[];
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

const VALID_MEDIA_PLATFORMS: readonly ProductMediaPlatform[] = [
  'shared',
  'ghadaq',
  'manasik',
] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMediaPlatform(value: unknown): ProductMediaPlatform {
  if (
    typeof value === 'string' &&
    VALID_MEDIA_PLATFORMS.includes(value as ProductMediaPlatform)
  ) {
    return value as ProductMediaPlatform;
  }

  return 'shared';
}

function normalizeMediaEntry(entry: unknown): ProductMedia | null {
  if (typeof entry === 'string') {
    const url = toNonEmptyString(entry);
    return url ? { url, platform: 'shared' } : null;
  }

  if (!isObject(entry)) return null;

  const url = toNonEmptyString(entry.url);
  if (!url) return null;

  return {
    url,
    platform: normalizeMediaPlatform(entry.platform),
  };
}

export function normalizeProductMedia(media: unknown): ProductMedia[] {
  const source = Array.isArray(media) ? media : [];

  const seen = new Set<string>();
  const normalized: ProductMedia[] = [];

  for (const item of source) {
    const parsed = normalizeMediaEntry(item);
    if (!parsed) continue;

    const dedupeKey = `${parsed.platform}|${parsed.url}`;
    if (seen.has(dedupeKey)) continue;

    seen.add(dedupeKey);
    normalized.push(parsed);
  }

  return normalized;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|qt)(\?.*)?$/i.test(url) || url.includes('/videos/');
}

export function getProductMediaUrls(product: Pick<Product, 'media'>): string[] {
  return normalizeProductMedia(product.media).map((item) => item.url);
}

export function getPrimaryProductImageUrl(
  product: Pick<Product, 'media'>,
): string | undefined {
  const media = normalizeProductMedia(product.media);
  const firstImage = media.find((item) => !isVideoUrl(item.url));
  return firstImage?.url || media[0]?.url;
}
