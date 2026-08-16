export interface ActivityLog {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action:
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'generate_design'
  | 'delete_designs'
  | 'review_design'
  | 'unreview_design';
  resource:
  | 'product'
  | 'user'
  | 'auth'
  | 'country'
  | 'order'
  | 'coupon'
  | 'referral'
  | 'appearance'
  | 'upload'
  | 'exchange'
  | 'userTier'
  | 'account'
  | 'booking'
  | 'category'
  | 'supplier';
  resourceId?: string;
  details: string;
  metadata?: { [key: string]: unknown };
  createdAt: Date;
}
