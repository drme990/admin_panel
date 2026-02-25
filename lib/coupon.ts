import dbConnect from '@/lib/db';
import Coupon, { type ICoupon } from '@/models/Coupon';

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon?: ICoupon;
  discountAmount?: number;
}

/**
 * Validate a coupon code against an order.
 */
export async function validateCoupon(
  code: string,
  orderAmount: number,
  currency: string,
  productId?: string,
): Promise<CouponValidationResult> {
  await dbConnect();

  const coupon = await Coupon.findOne({
    code: code.toUpperCase().trim(),
  });

  if (!coupon) {
    return { valid: false, error: 'COUPON_NOT_FOUND' };
  }

  if (coupon.status !== 'active') {
    return { valid: false, error: 'COUPON_INACTIVE' };
  }

  // Check expiry
  const now = new Date();
  if (coupon.validFrom && now < new Date(coupon.validFrom)) {
    return { valid: false, error: 'COUPON_NOT_STARTED' };
  }

  if (coupon.validUntil && now > new Date(coupon.validUntil)) {
    return { valid: false, error: 'COUPON_EXPIRED' };
  }

  // Check max uses
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, error: 'COUPON_MAX_USES' };
  }

  // Check minimum order amount
  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    return { valid: false, error: 'COUPON_MIN_AMOUNT' };
  }

  // Check applicable products
  if (
    coupon.applicableProducts &&
    coupon.applicableProducts.length > 0 &&
    productId
  ) {
    if (!coupon.applicableProducts.includes(productId)) {
      return { valid: false, error: 'COUPON_NOT_APPLICABLE' };
    }
  }

  // Calculate discount
  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (orderAmount * coupon.value) / 100;
  } else {
    // Fixed amount discount
    discountAmount = coupon.value;
  }

  // Apply max discount cap
  if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
    discountAmount = coupon.maxDiscountAmount;
  }

  // Discount can't exceed order amount
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  discountAmount = Math.round(discountAmount * 100) / 100;

  return {
    valid: true,
    coupon: coupon.toObject(),
    discountAmount,
  };
}

/**
 * Apply a coupon (increment usage count).
 */
export async function applyCoupon(code: string): Promise<boolean> {
  await dbConnect();
  const result = await Coupon.findOneAndUpdate(
    { code: code.toUpperCase().trim() },
    { $inc: { usedCount: 1 } },
  );
  return !!result;
}
