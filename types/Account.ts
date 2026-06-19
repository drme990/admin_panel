export type AccountType =
  | 'bank_account'
  | 'digital_wallet'
  | 'online_bank'
  | 'cash'
  | 'credit_card'
  | 'other';

export interface Account {
  _id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: number;
  balance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_TYPES: AccountType[] = [
  'bank_account',
  'digital_wallet',
  'online_bank',
  'cash',
  'credit_card',
  'other',
];
