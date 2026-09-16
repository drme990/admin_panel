export interface Referral {
  _id: string;
  name: string;
  referralId: string;
  phone: string;
  appId: 'manasik' | 'ghadaq';
  filterOrder?: number;
  createdAt: string;
  updatedAt: string;
}
