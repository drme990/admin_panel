import mongoose from 'mongoose';

export interface IPaymentSettings {
  _id?: string;
  project: 'ghadaq' | 'manasik';
  paymentMethod: 'paymob' | 'easykash';
  createdAt?: Date;
  updatedAt?: Date;
}

const PaymentSettingsSchema = new mongoose.Schema<IPaymentSettings>(
  {
    project: {
      type: String,
      required: true,
      unique: true,
      index: true,
      enum: ['ghadaq', 'manasik'],
    },
    paymentMethod: {
      type: String,
      enum: ['paymob', 'easykash'],
      required: true,
      default: 'paymob',
    },
  },
  { timestamps: true },
);

// Prevent re-compilation of model in development
const PaymentSettings =
  mongoose.models.PaymentSettings ||
  mongoose.model<IPaymentSettings>('PaymentSettings', PaymentSettingsSchema);

export default PaymentSettings;
