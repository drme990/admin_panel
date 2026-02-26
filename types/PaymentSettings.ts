export type ProjectName = 'ghadaq' | 'manasik';

export interface PaymentSettings {
  _id?: string;
  project: ProjectName;
  paymentMethod: 'paymob' | 'easykash';
  createdAt?: Date;
  updatedAt?: Date;
}
