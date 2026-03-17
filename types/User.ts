export type AdminPage =
  | 'products'
  | 'orders'
  | 'booking'
  | 'coupons'
  | 'countries'
  | 'users'
  | 'referrals'
  | 'activityLogs'
  | 'appearance'
  | 'exchange'
  | 'payments';

export const ALL_ADMIN_PAGES: AdminPage[] = [
  'products',
  'orders',
  'booking',
  'coupons',
  'countries',
  'users',
  'referrals',
  'activityLogs',
  'appearance',
  'exchange',
  'payments',
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
