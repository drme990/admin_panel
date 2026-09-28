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
  | 'shares';

/**
 * Action-level permissions — specific things an admin can do inside a
 * page they can already access. Distinct from `AdminPage`: a page grants
 * entry, an action grants a capability within it.
 */
export type AdminAction =
  | 'achievements'
  | 'orderStatsComponent'
  | 'export'
  | 'freeOrders';

export const ALL_ADMIN_ACTIONS: AdminAction[] = [
  'achievements',
  'orderStatsComponent',
  'export',
  'freeOrders',
];

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
  'shares',
];

export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'super_admin';
  allowedPages?: AdminPage[];
  allowedActions?: AdminAction[];
  ref?: string[];
  createdAt: Date;
  updatedAt: Date;
}
