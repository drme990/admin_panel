import type { OrderItem, PaymentMethod, ReservationOrderField } from '@/types/Order';

export interface InvoiceEntry {
  url: string;
  invoiceStatus?: string;
  rejectionReason?: string;
  value: number;
  currency?: string;
}

export interface InvoiceRow {
  _id: string;
  orderId: string;
  orderNumber: string;
  invoiceIndex: number;
  url: string;
  invoiceStatus: string;
  rejectionReason: string;
  value: number;
  currency: string;
  invoiceCurrency: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  source: string;
  paymentMethod?: PaymentMethod;
  reservationData?: ReservationOrderField[];
  referralId?: string;
  items: OrderItem[];
  userId?: string;
  isGuest?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReviewFilter = 'all' | 'confirmed' | 'waiting' | 'pending' | 'rejected' | 'deleted';

export function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
}

export const CURRENCY_OPTIONS = ['EGP', 'SAR', 'USD', 'EUR', 'AED', 'KWD'].map((c) => ({
  label: c,
  value: c,
}));

// Re-export the shared download helper for backward compatibility.
export { downloadFile as downloadInvoiceFile } from '@/lib/download-utils';

// ---------- Date utilities (matching order-utils.ts patterns) ----------

export function toIsoDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getRelativeIsoDate(daysOffset: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + daysOffset);
  return toIsoDateInput(date);
}

export function normalizeDateRange(fromDate: string, toDate: string) {
  if (fromDate && toDate && fromDate > toDate) {
    return { fromDate: toDate, toDate: fromDate };
  }
  return { fromDate, toDate };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const date = new Date(isoDate + 'T00:00:00');
  date.setDate(date.getDate() + days);
  return toIsoDateInput(date);
}

export async function copyToClipboard(value: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available');
  }
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);
  if (!copied) {
    throw new Error('Copy command failed');
  }
}

export function getReservationValue(
  reservationData: ReservationOrderField[] | undefined,
  key: string,
): string | undefined {
  return reservationData?.find((f) => f.key === key)?.value;
}

export function getNameLines(value?: string): string[] {
  if (!value) return [];
  const normalized = value
    .replace(/\n/g, ',')
    .replace(/;/g, ',')
    .replace(/\r/g, ',');
  return normalized
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
