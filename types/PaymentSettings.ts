export interface PaymentSettings {
  _id?: string;
  paymentMethod: 'paymob' | 'easykash';
  createdAt?: Date;
  updatedAt?: Date;
}
