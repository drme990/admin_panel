'use client';

import type { Order } from '@/types/Order';

/**
 * Shared cache for the execution API response, used by both the
 * /execution and /order-designs pages. When the admin navigates
 * between these two pages, the data is restored from cache
 * instantly instead of showing a loading spinner and refetching.
 *
 * The cache is keyed by the query string so different filter
 * combinations don't collide. A timestamp lets us skip the
 * mount-time refetch if the data was fetched very recently.
 */

const CACHE_KEY = 'executionData.cache';
const STALE_MS = 5_000; // skip refetch if data is < 5s old

interface CachedExecutionData {
  queryString: string;
  orders: Order[];
  totalOrders: number;
  totalPages: number;
  fetchedAt: number;
}

function readCache(): CachedExecutionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedExecutionData;
    if (!parsed || !Array.isArray(parsed.orders)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(data: CachedExecutionData): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

/**
 * Save fetched execution data to the cache.
 */
export function cacheExecutionData(
  queryString: string,
  orders: Order[],
  totalOrders: number,
  totalPages: number,
): void {
  writeCache({
    queryString,
    orders,
    totalOrders,
    totalPages,
    fetchedAt: Date.now(),
  });
}

/**
 * Read cached execution data for the given query string.
 * Returns null if there's no cache or the query string doesn't match.
 */
export function getCachedExecutionData(queryString: string): {
  orders: Order[];
  totalOrders: number;
  totalPages: number;
} | null {
  const cached = readCache();
  if (!cached || cached.queryString !== queryString) return null;
  return {
    orders: cached.orders,
    totalOrders: cached.totalOrders,
    totalPages: cached.totalPages,
  };
}

/**
 * Check if the cached data for the given query string is fresh
 * enough to skip the mount-time refetch entirely.
 */
export function isCacheFresh(queryString: string): boolean {
  const cached = readCache();
  if (!cached || cached.queryString !== queryString) return false;
  return Date.now() - cached.fetchedAt < STALE_MS;
}
