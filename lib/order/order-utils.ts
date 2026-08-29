'use client';

import type {
  DesignVersionHistoryResponse,
  RestoreVersionResponse,
} from '@/types/OrderDesignVersion';

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

/**
 * Toggle the reviewed status of a single generated design on an order.
 * Calls PATCH /api/orders/{orderId}/designs (proxied to the backend's
 * `/api/admin/orders/[id]/designs` route).
 */
export async function updateDesignReviewStatus(
  orderId: string,
  productId: string,
  reviewed: boolean,
): Promise<boolean> {
  const res = await fetch(`/api/orders/${orderId}/designs`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, reviewed }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to update review status');
  }
  return true;
}

/**
 * Replace a single generated design's image URL (e.g. after the admin
 * uploads a custom image to use instead of the auto-generated one).
 * Resets the design back to "waiting for review" since its content changed.
 * Calls PATCH /api/orders/{orderId}/designs (proxied to the backend's
 * `/api/admin/orders/[id]/designs` route).
 */
export async function replaceDesignImage(
  orderId: string,
  productId: string,
  url: string,
): Promise<boolean> {
  const res = await fetch(`/api/orders/${orderId}/designs`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, url }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to replace design image');
  }
  return true;
}

/**
 * Delete a single generated design from an order (removes it from the
 * order's `designUrls` array and deletes its image from R2 storage).
 * Calls DELETE /api/orders/{orderId}/designs?productId=... (proxied to
 * the backend's `/api/admin/orders/[id]/designs` route).
 */
export async function deleteSingleDesign(
  orderId: string,
  productId: string,
): Promise<boolean> {
  const res = await fetch(
    `/api/orders/${orderId}/designs?productId=${encodeURIComponent(productId)}`,
    { method: 'DELETE', credentials: 'include' },
  );
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to delete design');
  }
  return true;
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

type SizeValue = string | { ar?: string; en?: string } | undefined;

type OrderItemSizeInput = {
  productName?: { ar?: string; en?: string };
  sizeName?: SizeValue;
  sizeLabel?: SizeValue;
  size?: SizeValue;
  sizeIndex?: number;
  sizes?: Array<{
    name?: SizeValue;
    label?: SizeValue;
    value?: SizeValue;
  }>;
};

function resolveSizeName(
  sizeValue: SizeValue,
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
  item: OrderItemSizeInput,
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

// ─── Design version history ──────────────────────────────────────────────

/**
 * Fetch the full saved-version history for a single order design.
 * Calls GET /api/admin/design-versions (proxied to the backend's
 * `/api/admin/design-versions` route).
 *
 * Returns `{ currentVersion, versions }` where `currentVersion` is the
 * explicit active-version pointer (null when the design has been
 * deleted) and `versions` is the append-only history, newest first.
 */
export async function fetchDesignVersionHistory(
  orderId: string,
  productId: string,
): Promise<DesignVersionHistoryResponse> {
  const params = new URLSearchParams({ orderId, productId });
  const res = await fetch(`/api/design-versions?${params.toString()}`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch design history');
  }
  return data.data as DesignVersionHistoryResponse;
}

/**
 * Restore a previous saved version. The backend creates a new
 * `admin_restore` version (the original is never touched) and updates
 * the order's current-design pointer.
 *
 * Calls POST /api/admin/design-versions/restore (proxied to the
 * backend's `/api/admin/design-versions/restore` route).
 */
export async function restoreDesignVersion(
  orderId: string,
  productId: string,
  version: number,
): Promise<RestoreVersionResponse> {
  const res = await fetch(`/api/design-versions/restore`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, productId, version }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to restore version');
  }
  return data.data as RestoreVersionResponse;
}

/**
 * Sync the order's `designUrls[].url` and `currentVersion` with the
 * latest version in the design version history.
 *
 * This is called by the admin panel on window focus — when the admin
 * returns from editing a design in the design app's editor, the admin
 * panel syncs the order's URL with the latest version before refetching.
 *
 * The backend checks the `design_order_versions` collection for the
 * latest version of each (orderNumber, productId) pair and updates the
 * order's `designUrls[].url` if it's out of sync.
 *
 * @param orderNumbers The order numbers to sync (typically the orders
 *   on the current page).
 * @param wait When true, the backend long-polls (up to 10 seconds) for
 *   new versions to appear. This is used after the admin returns from
 *   the editor — the re-render might still be in progress, so we wait
 *   for it to complete instead of polling multiple times.
 * @returns `{ synced, updated, timedOut }` — `synced` is the number of
 *   orders checked, `updated` is the number of design URLs that were
 *   changed, `timedOut` is true if the long-poll timed out without
 *   finding a new version.
 */
export async function syncOrderDesigns(
  orderNumbers: string[],
  wait: boolean = false,
): Promise<{ synced: number; updated: number; timedOut: boolean }> {
  if (orderNumbers.length === 0) return { synced: 0, updated: 0, timedOut: false };
  const res = await fetch(`/api/orders/sync-designs`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumbers, wait }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to sync designs');
  }
  return data.data as { synced: number; updated: number; timedOut: boolean };
}
