import { Order, OrderPayment, OrderStatus } from '@/types/Order';

export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'partial-paid': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const PAYMENT_STATUS_COLORS: Record<OrderPayment['status'], string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export const WHATSAPP_STATE_CLASSES: Record<
  Exclude<'all' | 'clicked' | 'not-clicked' | 'no-need-to-click', 'all'>,
  string
> = {
  clicked: 'bg-green-500',
  'not-clicked': 'bg-red-500',
  'no-need-to-click': 'bg-transparent',
};

export function getDefaultReferralCode(source?: Order['source']): string {
  return source === 'ghadaq' ? 'GHD-D' : 'MNK-D';
}

export const STATUS_TAB_VALUES: OrderStatus[] = [
  'pending',
  'processing',
  'partial-paid',
  'paid',
  'completed',
  'failed',
  'refunded',
  'cancelled',
];
