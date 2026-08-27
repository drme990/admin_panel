export type AdminPage =
  | 'products'
  | 'products-discovery'
  | 'orders'
  | 'invoices'
  | 'customers'
  | 'analytics'
  | 'booking'
  | 'coupons'
  | 'countries'
  | 'categories'
  | 'admins'
  | 'referrals'
  | 'refTracker'
  | 'activityLogs'
  | 'appearance'
  | 'storage-manager'
  | 'exchange'
  | 'payments'
  | 'crm'
  | 'accounts'
  | 'suppliers'
  | 'orderDesigns'
  | 'orderDesignLogs'
  | 'errorLogs'
  | 'orderStatsComponent';

export const ALL_ADMIN_PAGES: AdminPage[] = [
  'products',
  'products-discovery',
  'orders',
  'invoices',
  'customers',
  'analytics',
  'booking',
  'coupons',
  'countries',
  'categories',
  'admins',
  'referrals',
  'activityLogs',
  'appearance',
  'exchange',
  'payments',
  'storage-manager',
  'crm',
  'accounts',
  'suppliers',
  'orderDesigns',
  'orderStatsComponent',
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
