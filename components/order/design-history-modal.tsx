'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { LuDownload, LuRotateCcw, LuTrash2, LuLoader, LuImage } from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import {
  fetchDesignVersionHistory,
  restoreDesignVersion,
} from '@/lib/order/order-utils';
import { downloadFile } from '@/lib/download-utils';
import type {
  OrderDesignVersion,
  OrderDesignVersionTrigger,
} from '@/types/OrderDesignVersion';

interface DesignHistoryModalProps {
  /** Order ID (MongoDB _id). */
  orderId: string;
  /** Order number — used for download filenames. */
  orderNumber: string;
  /** Backend product ID. */
  productId: string;
  /** Whether the modal is open. */
  isOpen: boolean;
  /** Called when the modal is closed. */
  onClose: () => void;
  /**
   * Called after a successful restore with the new current version's URL.
   * The parent refetches the order list so the card shows the restored image.
   */
  onRestored?: (result: { url: string; version: number }) => void;
}

/**
 * Append a cache-busting query parameter to a URL.
 *
 * Archived version JPGs are immutable (never overwritten), so in principle
 * they could be cached forever. But the very first time a version is
 * created, the URL might have been requested before the upload completed
 * (race during generation) and cached a 404. Cache-busting on each open
 * avoids that edge case.
 */
function withCacheBust(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

/**
 * Design history modal — shows the append-only saved-version history for
 * a single order design, with preview, download, and restore actions.
 *
 * The history is fetched from `GET /api/admin/design-versions` and
 * restored via `POST /api/admin/design-versions/restore`. The modal
 * marks the current version (matching `currentVersion` from the order's
 * `designUrls[].currentVersion` pointer) with a "Current" badge.
 *
 * See `order-history-enhanced.md` §14 for the UI spec.
 */
export default function DesignHistoryModal({
  orderId,
  orderNumber,
  productId,
  isOpen,
  onClose,
  onRestored,
}: DesignHistoryModalProps) {
  const t = useTranslations('orderDesignHistory');
  const tExec = useTranslations('execution.table');
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<OrderDesignVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<OrderDesignVersion | null>(null);

  // ── Fetch history when the modal opens ────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!orderId || !productId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDesignVersionHistory(orderId, productId);
      setVersions(data.versions);
      setCurrentVersion(data.currentVersion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setVersions([]);
      setCurrentVersion(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, productId]);

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
    } else {
      // Reset state when closing so a reopen starts fresh.
      setVersions([]);
      setCurrentVersion(null);
      setError(null);
      setConfirmRestore(null);
      setRestoringVersion(null);
    }
  }, [isOpen, loadHistory]);

  // ── Restore handler ───────────────────────────────────────────────────
  const handleRestore = useCallback(
    async (version: OrderDesignVersion) => {
      setRestoringVersion(version.version);
      try {
        const result = await restoreDesignVersion(orderId, productId, version.version);
        // Optimistically update the local current-version pointer so the
        // "Current" badge moves immediately. The parent will refetch the
        // order list separately.
        setCurrentVersion(result.currentVersion);
        setConfirmRestore(null);
        onRestored?.({ url: result.url, version: result.currentVersion });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to restore version');
      } finally {
        setRestoringVersion(null);
      }
    },
    [orderId, productId, onRestored],
  );

  // ── Download handler ──────────────────────────────────────────────────
  const handleDownload = useCallback(
    (version: OrderDesignVersion) => {
      if (!version.archivedUrl) return;
      const filename = `${orderNumber}-v${version.version}.jpg`;
      void downloadFile(withCacheBust(version.archivedUrl), filename);
    },
    [orderNumber],
  );

  // ── Trigger label (localized) ─────────────────────────────────────────
  const triggerLabel = useCallback(
    (trigger: OrderDesignVersionTrigger): string => {
      try {
        return t(`trigger.${trigger}`);
      } catch {
        return trigger;
      }
    },
    [t],
  );

  // ── Format date ───────────────────────────────────────────────────────
  const formatDate = useCallback(
    (ms: number): string => {
      try {
        const d = new Date(ms);
        return d.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return new Date(ms).toISOString();
      }
    },
    [locale],
  );

  // ── Sorted versions (newest first — the API already returns this, but
  //    sort defensively in case the order changed after a restore) ───────
  const sortedVersions = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );

  return (
    <>
      <Modal
        isOpen={isOpen && !confirmRestore}
        onClose={onClose}
        title={t('title')}
        size="xl"
        contentClassName="p-4 sm:p-6"
      >
        {loading ? (
          <div className="flex min-h-40 items-center justify-center text-secondary">
            <LuLoader className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
            {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => void loadHistory()}
            >
              {t('retry')}
            </button>
          </div>
        ) : sortedVersions.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-secondary">
            <LuImage className="h-8 w-8 opacity-40" />
            <p className="text-sm">{t('empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedVersions.map((version) => {
              const isCurrent = version.version === currentVersion;
              const isDeleted = !!version.isDeletedEvent;
              const isRestoring = restoringVersion === version.version;
              const canRestore = !isCurrent && !isDeleted && !isRestoring;
              return (
                <div
                  key={version._id || version.version}
                  className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:gap-4 ${isCurrent
                    ? 'border-primary bg-primary/5'
                    : isDeleted
                      ? 'border-error/30 bg-error/5'
                      : 'border-stroke bg-card-bg'
                    }`}
                >
                  {/* Thumbnail */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                    {version.archivedUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={withCacheBust(version.archivedUrl)}
                        alt={`v${version.version}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <LuImage className="h-6 w-6 text-secondary/40" />
                      </div>
                    )}
                    {isDeleted && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                        <LuTrash2 className="h-6 w-6 text-error" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
                        {t('versionLabel', { version: version.version })}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs font-medium ${isDeleted
                          ? 'bg-error/15 text-error'
                          : 'bg-primary/15 text-primary'
                          }`}
                      >
                        {triggerLabel(version.trigger)}
                      </span>
                      {isCurrent && (
                        <span className="rounded-md bg-primary px-2 py-0.5 text-xs font-bold text-primary-text">
                          {t('current')}
                        </span>
                      )}
                      {version.restoredFromVersion != null && (
                        <span className="text-xs text-secondary">
                          {t('restoredFrom', { version: version.restoredFromVersion })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary">
                      <span>{formatDate(version.createdAt)}</span>
                      <span>·</span>
                      <span>{version.userName}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(version)}
                      disabled={!version.archivedUrl}
                      className="px-2!"
                      aria-label={tExec('downloadDesign')}
                      title={tExec('downloadDesign')}
                    >
                      <LuDownload className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={isCurrent ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => setConfirmRestore(version)}
                      disabled={!canRestore}
                      className="px-2!"
                      aria-label={t('restore')}
                      title={t('restore')}
                    >
                      {isRestoring ? (
                        <LuLoader className="h-4 w-4 animate-spin" />
                      ) : (
                        <LuRotateCcw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Restore confirmation */}
      <Modal
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        title={t('restoreConfirmTitle')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmRestore(null)}>
              {t('restoreCancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => confirmRestore && void handleRestore(confirmRestore)}
              disabled={restoringVersion !== null}
            >
              {restoringVersion !== null ? (
                <LuLoader className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <LuRotateCcw className="mr-1 h-4 w-4" />
              )}
              {t('restoreConfirmBtn')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-foreground">
          {t('restoreConfirmMessage', {
            version: confirmRestore?.version ?? 0,
          })}
        </p>
        <p className="mt-2 text-xs text-secondary">{t('restoreNote')}</p>
      </Modal>
    </>
  );
}
