export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'partial-paid'
  | 'paid'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type InvoiceStatus = 'confirmed' | 'waiting' | 'pending' | 'rejected';

/**
 * A generated design image for an order, one per product that had a
 * matching template. Populated by the design-app callback flow.
 */
export interface OrderDesignUrl {
  /** Backend product ID (string ObjectId) this design was generated for */
  productId: string;
  /** Product name snapshot (for display without a DB lookup) */
  productName?: string;
  /** Public R2 URL of the generated JPG */
  url: string;
  /** Which template variant was used — 'text' (no-image) or 'image' */
  templateType: 'text' | 'image';
  /**
   * ID of the design-app project (design instance) generated for this
   * order. The admin panel opens `{DESIGN_APP_URL}/editor/d/{projectId}`
   * so the admin can edit THIS specific design — not the template.
   * The template stays unchanged; only this design instance is edited.
   */
  projectId?: string;
  /** When the design was generated (ISO string) */
  createdAt: string;
}

export type PaymentMethod =
  | 'card'
  | 'wallet'
  | 'bank_transfer'
  | 'fawry'
  | 'meeza'
  | 'valu'
  | 'other'
  | 'easykash'
  | 'insta_pay'
  | 'vodafone_cash'
  | 'paypal'
  | 'binance';

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
  productId?: string;
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
  /** Design-only name snapshot from the product size (for the design app) */
  sizeDesignName?: string;
  sizeLabel?: OrderItemSizeValue;
  size?: OrderItemSizeValue;
  sizes?: OrderItemSizeOption[];
  isCustom?: boolean;
  customSize?: string;
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
  billingData: BillingData;
  // Coupon
  couponCode?: string;
  couponId?: string;
  couponDiscount?: number;
  // Upgrade discount
  isUpgrade?: boolean;
  fromProductId?: string;
  upgradeDiscount?: number;
  // Partial payment
  fullAmount?: number;
  paidAmount?: number;
  remainingAmount?: number;
  isPartialPayment?: boolean;
  paymentType?: 'full' | 'half' | 'partial';
  isWhatsappButtonClicked?: 'clicked' | 'not-clicked' | 'no-need-to-click';
  // Referral
  referralId?: string;
  cancellationReason?: string;
  invoiceUrls?: Array<{
    url: string;
    invoiceStatus?: InvoiceStatus;
    rejectionReason?: string;
    value: number;
    currency?: string;
  }>;
  /** Generated design images — one entry per product with a template */
  designUrls?: OrderDesignUrl[];
  statusUpdateTime: string;
  // Terms
  termsAgreedAt?: string;
  reservationData?: ReservationOrderField[];
  paymentMethod?: PaymentMethod;
  payments?: OrderPayment[];
  paymentAttempts?: PaymentAttempt[];
  source?: 'manasik' | 'ghadaq';
  location?: string;
  locale?: string;
  createdAt: string;
  updatedAt: string;
}

// Extended order with populated product info (from API)
export interface OrderWithProductDetails extends Order {
  fromProduct?: {
    _id: string;
    name: {
      ar: string;
      en: string;
    };
    slug: string;
  } | null;
}
