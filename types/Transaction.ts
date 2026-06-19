export interface Transaction {
  _id: string;
  source: 'supplier' | 'customer' | 'expense' | 'income' | 'transfer' | 'other';
  sourceId: string;
  amount: number;
  type: 'debit' | 'credit';
  accountId: string;
  account?: { name: string; currency: string; type: string };
  date: string;
  paymentMethod?: string;
  referenceNumber?: string;
  linkedOrderId?: string;
  notes?: string;
  attachment?: string;
  createdAt: string;
  updatedAt: string;
}
