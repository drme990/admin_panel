export type AdminPage =
  | 'products'
  | 'orders'
  | 'coupons'
  | 'countries'
  | 'users'
  | 'referrals'
  | 'activityLogs'
  | 'paymentSettings'
  | 'appearance';

export const ALL_ADMIN_PAGES: AdminPage[] = [
  'products',
  'orders',
  'coupons',
  'countries',
  'users',
  'referrals',
  'activityLogs',
  'paymentSettings',
  'appearance',
];

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'super_admin';
  allowedPages?: AdminPage[];
  createdAt: Date;
  updatedAt: Date;
}
