export type OrderStatus =
  | 'pending'
  | 'processing'
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
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  billingData: BillingData;
  easykashRef?: string;
  easykashProductCode?: string;
  easykashVoucher?: string;
  // Coupon
  couponCode?: string;
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
  countryCode?: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
}
