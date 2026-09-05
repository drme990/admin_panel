export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'partial-paid'
  | 'paid'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'cancelled';

export type InvoiceStatus = 'confirmed' | 'waiting' | 'pending' | 'rejected' | 'deleted';

export type InvoiceDeletionReason =
  | 'returned'
  | 'duplicate'
  | 'fake'
  | 'test'
  | 'uploaded_by_mistake'
  | 'other';

export interface DeletedInvoice {
  url: string;
  reason: InvoiceDeletionReason;
  customReason?: string;
  value: number;
  currency?: string;
  invoiceStatus?: InvoiceStatus;
  deletedAt: string;
  deletedBy?: string;
}

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
  /**
   * Whether an admin (with `orderDesigns` access) has marked this design
   * as reviewed. Newly generated designs default to `false` ("waiting
   * for review").
   */
  reviewed?: boolean;
  /** When the design was marked as reviewed (ISO string) */
  reviewedAt?: string;
  /** Name/email of the admin who marked it reviewed */
  reviewedBy?: string;
  /**
   * The currently-active version number for this design (explicit
   * pointer). The history UI marks `version === currentVersion` as
   * "current" — never infer current state from array position.
   *
   * `null` when the design has been deleted (the `admin_delete` event
   * preserves the last snapshot but clears the active pointer).
   * Undefined for legacy entries created before this field was added.
   *
   * See `order-history-enhanced.md` §11.
   */
  currentVersion?: number | null;
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

export interface AllowRateApplied {
  type: 'percentage' | 'fixnumber';
  value: number;
  invoiceValue: number;
  remainingBefore: number;
  difference: number;
  paymentMethod?: string;
}

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
  allowRateApplied?: AllowRateApplied | null;
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
    whileCreating?: boolean;
  }>;
  deletedInvoices?: DeletedInvoice[];
  /** Generated design images — one entry per product with a template */
  designUrls?: OrderDesignUrl[];
  /** Daily execution sequence number, reset to 1 for each execution date */
  executionNumber?: number;
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
  internalNotes?: InternalNote[];
  // Free order tracking
  isFreeOrder?: boolean;
  freeOrderReason?: string;
  // Admin who created this manual order
  createdByAdminId?: string;
  createdByAdminEmail?: string;
  createdByAdminName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InternalNote {
  _id?: string;
  text: string;
  author: string;
  createdAt: string;
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
