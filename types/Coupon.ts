export type CouponType = 'percentage' | 'fixed';
export type CouponStatus = 'active' | 'expired' | 'disabled';

export interface CouponFixedPrice {
  currencyCode: string;
  amount: number;
  isManual?: boolean;
}

export interface Coupon {
  _id: string;
  code: string;
  type: CouponType;
  value: number;
  fixedPrices?: CouponFixedPrice[];
  maxDiscountPrices?: CouponFixedPrice[];
  currency?: string;
  maxUses?: number;
  usedCount: number;
  maxUsesPerUser?: number;
  validFrom: string;
  validUntil?: string;
  status: CouponStatus;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  applicableProducts?: string[];
  allowedCountries?: string[];
  description?: {
    ar: string;
    en: string;
  };
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
