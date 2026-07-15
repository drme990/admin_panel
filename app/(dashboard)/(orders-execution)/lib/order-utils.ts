'use client';

import type { OrderItem } from '@/types/Order';

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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatHeaderDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)}-${Number(month)}-${year}`;
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

export function normalizeWhatsappPhone(
  rawPhone?: string,
  withPlus = false,
): string | null {
  if (!rawPhone) return null;

  let normalized = rawPhone.trim();
  if (!normalized) return null;

  normalized = normalized.replace(/[\s().-]/g, '');
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (normalized.startsWith('+')) {
    const digits = normalized.slice(1).replace(/\D/g, '');
    if (!digits) return null;
    return withPlus ? `+${digits}` : digits;
  }

  const digitsOnly = normalized.replace(/\D/g, '');
  if (!digitsOnly) return null;
  return withPlus ? `+${digitsOnly}` : digitsOnly;
}

export function isImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(pathname);
  } catch {
    return false;
  }
}

const DEFAULT_SIZE_VALUES = new Set(['default', 'الافتراضي']);

function resolveSizeName(
  sizeValue: string | { ar?: string; en?: string } | undefined,
): string | null {
  if (!sizeValue) return null;
  const text =
    typeof sizeValue === 'string'
      ? sizeValue
      : sizeValue.ar || sizeValue.en || '';
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (DEFAULT_SIZE_VALUES.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

export function getOrderItemDisplayName(
  item: OrderItem,
  locale: string,
): string {
  const directSize =
    resolveSizeName(item.sizeName) ??
    resolveSizeName(item.sizeLabel) ??
    resolveSizeName(item.size);

  if (directSize) return directSize;

  if (
    typeof item.sizeIndex === 'number' &&
    Array.isArray(item.sizes) &&
    item.sizeIndex >= 0 &&
    item.sizeIndex < item.sizes.length
  ) {
    const option = item.sizes[item.sizeIndex];
    const fromOption =
      resolveSizeName(option?.name) ??
      resolveSizeName(option?.label) ??
      resolveSizeName(option?.value);
    if (fromOption) return fromOption;
  }

  return locale === 'ar'
    ? item.productName?.ar || item.productName?.en || ''
    : item.productName?.en || item.productName?.ar || '';
}
