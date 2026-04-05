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
}

export interface BillingData {
  fullName: string;
  email: string;
  phone: string;
  country: string;
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
  easykashRef?: string;
  easykashProductCode?: string;
  easykashVoucher?: string;
  easykashResponse?: Record<string, string | number | undefined>;
  // Coupon
  couponCode?: string;
  couponId?: string;
  couponDiscount?: number;
  // Partial payment
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  isPartialPayment?: boolean;
  // Referral
  referralId?: string;
  // Terms
  termsAgreedAt?: string;
  reservationData?: ReservationOrderField[];
  source?: 'manasik' | 'ghadaq';
  countryCode?: string;
  locale?: string;
  sizeIndex?: number;
  createdAt: string;
  updatedAt: string;
}
