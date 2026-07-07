export type Customer = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  detectedCountry?: string | null;
  registrationIp?: string;
  lastLoginIp?: string;
  lastLoginAt?: string;
  appId: 'ghadaq' | 'manasik';
  isBanned: boolean;
  isAdminCreated?: boolean;
  ref: string | null;
  tier?: string | null;
  createdAt: string;
};

export type UserTier = {
  _id: string;
  name: string;
  color: string;
};
