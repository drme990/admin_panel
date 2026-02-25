export interface ActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout';
  resource:
    | 'product'
    | 'user'
    | 'auth'
    | 'country'
    | 'order'
    | 'coupon'
    | 'referral'
    | 'paymentSettings';
  resourceId?: string;
  details: string;
  metadata?: { [key: string]: unknown };
  createdAt: Date;
}
