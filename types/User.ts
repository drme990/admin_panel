export type AdminPage =
  | 'products'
  | 'products-discovery'
  | 'orders'
  | 'execution'
  | 'customers'
  | 'analytics'
  | 'booking'
  | 'coupons'
  | 'countries'
  | 'admins'
  | 'referrals'
  | 'activityLogs'
  | 'appearance'
  | 'storage-manager'
  | 'exchange'
  | 'payments'
  | 'crm'
  | 'accounts'
  | 'suppliers';

export const ALL_ADMIN_PAGES: AdminPage[] = [
  'products',
  'products-discovery',
  'orders',
  'execution',
  'customers',
  'analytics',
  'booking',
  'coupons',
  'countries',
  'admins',
  'referrals',
  'activityLogs',
  'appearance',
  'exchange',
  'payments',
  'storage-manager',
  'crm',
  'accounts'
];

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'super_admin';
  allowedPages?: AdminPage[];
  ref?: string;
  createdAt: Date;
  updatedAt: Date;
}
