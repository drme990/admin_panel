export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'partial-paid'
  | 'paid'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type PaymentMethod =
  | 'card'
  | 'wallet'
  | 'bank_transfer'
  | 'fawry'
  | 'meeza'
  | 'valu'
  | 'other';

type LocalizedOrderText = {
  ar?: string;
  en?: string;
};

type OrderItemSizeValue = string | LocalizedOrderText;

interface OrderItemSizeOption {
  name?: OrderItemSizeValue;
  label?: OrderItemSizeValue;
  value?: OrderItemSizeValue;
}

export interface OrderItem {
  productId: string;
  productSlug?: string;
  productName: {
    ar: string;
    en: string;
  };
  price: number;
  currency: string;
  quantity: number;
  sizeIndex?: number;
  sizeName?: OrderItemSizeValue;
  sizeLabel?: OrderItemSizeValue;
  size?: OrderItemSizeValue;
  sizes?: OrderItemSizeOption[];
}

export interface BillingData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
}

export type PaymentRecordStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface OrderPayment {
  paymentId: string;
  easykashOrderId?: string;
  orderAmount?: number;
  gatewayAmount?: number;
  gatewayCurrency?: string;
  amount: number;
  currency: string;
  status: PaymentRecordStatus;
  paymentMethod?: PaymentMethod;
  easykashRef?: string;
  easykashProductCode?: string;
  easykashVoucher?: string;
  easykashResponse?: Record<string, unknown>;
  redirectUrl?: string;
  expiresAt?: string;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentAttempt {
  createdAt: string;
  ip?: string;
  userId?: string;
}

export interface ReservationOrderField {
  key:
    | 'intention'
    | 'sacrificeFor'
    | 'gender'
    | 'isAlive'
    | 'shortDuaa'
    | 'photo'
    | 'executionDate';
  label: {
    ar: string;
    en: string;
  };
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'date'
    | 'select'
    | 'radio'
    | 'picture';
  value: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId?: string;
  isGuest?: boolean;
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  billingData: BillingData;
  // Coupon
  couponCode?: string;
  couponId?: string;
  couponDiscount?: number;
  // Partial payment
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  isPartialPayment?: boolean;
  paymentType?: 'full' | 'half' | 'partial';
  // Referral
  referralId?: string;
  // Terms
  termsAgreedAt?: string;
  reservationData?: ReservationOrderField[];
  payments?: OrderPayment[];
  paymentAttempts?: PaymentAttempt[];
  source?: 'manasik' | 'ghadaq';
  countryCode?: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
}
