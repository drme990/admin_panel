import mongoose from 'mongoose';

export interface ICurrencyPrice {
  currencyCode: string;
  amount: number;
  isManual: boolean;
}

export interface ICurrencyMinimumPayment {
  currencyCode: string;
  value: number;
  isManual: boolean;
}

export interface IEasykashLinks {
  fullPayment: string;
  halfPayment: string;
  customPayment: string;
}

export interface IProductSize {
  _id?: string;
  name: {
    ar: string;
    en: string;
  };
  price: number;
  prices: ICurrencyPrice[];
  easykashLinks?: IEasykashLinks;
  feedsUp?: number;
}

export interface IPartialPayment {
  isAllowed: boolean;
  minimumType: 'percentage' | 'fixed';
  minimumPayments: ICurrencyMinimumPayment[];
}

/**
 * Enhanced Product model interface.
 *
 * - `sizes` always has ≥ 1 item. All pricing lives inside sizes.
 * - `baseCurrency` is the single canonical currency string.
 * - `partialPayment` holds all partial-payment configuration.
 */
export interface IProduct {
  _id?: string;
  name: {
    ar: string;
    en: string;
  };
  slug?: string;
  content?: {
    ar: string;
    en: string;
  };
  baseCurrency: string;
  inStock: boolean;
  isActive: boolean;
  images: string[];
  sizes: IProductSize[];
  partialPayment: IPartialPayment;
  workAsSacrifice?: boolean;
  sacrificeCount?: number;
  displayOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const CurrencyPriceSchema = new mongoose.Schema(
  {
    currencyCode: { type: String, required: true, uppercase: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    isManual: { type: Boolean, default: false },
  },
  { _id: false },
);

const EasykashLinksSchema = new mongoose.Schema(
  {
    fullPayment: { type: String, trim: true, default: '' },
    halfPayment: { type: String, trim: true, default: '' },
    customPayment: { type: String, trim: true, default: '' },
  },
  { _id: false },
);

const ProductSizeSchema = new mongoose.Schema({
  name: {
    ar: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  price: { type: Number, required: true, min: 0, default: 0 },
  prices: [CurrencyPriceSchema],
  easykashLinks: { type: EasykashLinksSchema, default: () => ({}) },
  feedsUp: { type: Number, min: 0, default: 0 },
});

const PartialPaymentSchema = new mongoose.Schema(
  {
    isAllowed: { type: Boolean, default: false },
    minimumType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    minimumPayments: [
      {
        currencyCode: {
          type: String,
          required: true,
          uppercase: true,
          trim: true,
        },
        value: {
          type: Number,
          required: true,
          min: 0,
        },
        isManual: {
          type: Boolean,
          default: false,
        },
        _id: false,
      },
    ],
  },
  { _id: false },
);

const ProductSchema = new mongoose.Schema<IProduct>(
  {
    name: {
      ar: {
        type: String,
        required: [true, 'Arabic product name is required'],
        trim: true,
        maxlength: [100, 'Arabic product name cannot exceed 100 characters'],
      },
      en: {
        type: String,
        required: [true, 'English product name is required'],
        trim: true,
        maxlength: [100, 'English product name cannot exceed 100 characters'],
      },
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    content: {
      ar: { type: String, trim: true, default: '' },
      en: { type: String, trim: true, default: '' },
    },
    baseCurrency: {
      type: String,
      required: [true, 'Base currency is required'],
      default: 'SAR',
      uppercase: true,
      trim: true,
    },
    inStock: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    images: [{ type: String, trim: true }],
    sizes: {
      type: [ProductSizeSchema],
      validate: {
        validator: (v: unknown[]) => v.length >= 1,
        message: 'Product must have at least one size',
      },
    },
    partialPayment: { type: PartialPaymentSchema, default: () => ({}) },
    workAsSacrifice: { type: Boolean, default: false },
    sacrificeCount: { type: Number, default: 1, min: 1 },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Use existing model if already registered (prevents OverwriteModelError in
// production builds where multiple workers may import this module simultaneously).
const Product =
  (mongoose.models.Product as mongoose.Model<IProduct>) ||
  mongoose.model<IProduct>('Product', ProductSchema);

export default Product;
