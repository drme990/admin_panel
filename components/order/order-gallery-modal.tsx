'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { LuDownload, LuPencil, LuChevronLeft, LuChevronRight, LuRefreshCw, LuTrash2, LuReplace, LuCheck, LuClock, LuFileText, LuExternalLink } from 'react-icons/lu';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { downloadFile } from '@/lib/download-utils';
import { isImageUrl } from '@/lib/order/order-utils';
import { cn } from '@/lib/utils';
import { updateDesignReviewStatus } from '../../lib/order/order-utils';
import type { Order, OrderDesignUrl } from '@/types/Order';

/**
 * A single gallery item — either a customer-uploaded photo or a
 * generated design image.
 */
export interface GalleryItem {
  /** Stable unique key for React lists */
  id: string;
  /** 'photo' = customer-uploaded image, 'design' = generated design, 'invoice' = uploaded invoice/receipt */
  kind: 'photo' | 'design' | 'invoice';
  /** Public R2 URL of the image/file */
  url: string;
  /** Human-readable label shown in the thumbnail strip */
  label: string;
  /** For design items: which template variant was used */
  templateType?: 'text' | 'image';
  /** For design items: the design-app project ID (for editing) */
  projectId?: string;
  /** For design items: the product ID this design belongs to (for review toggling) */
  productId?: string;
  /** For design items: whether it has been reviewed */
  reviewed?: boolean;
  /** For invoice items: whether the invoice URL points to an image (vs a document) */
  isImage?: boolean;
}

/**
 * Parse the reservation `photo` field value into a list of URLs.
 *
 * The photo field stores either:
 *  - A JSON-stringified array of URLs (new multi-image format, up to 4)
 *  - A single URL string (legacy format)
 */
function parsePhotoValue(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
    }
  } catch {
    // Not JSON — treat as a single URL (legacy)
  }
  return value ? [value] : [];
}

/**
 * Build the gallery items from an order's reservation photos + design URLs.
 *
 * Photos come first (customer-uploaded), then designs (text variant, then
 * image variant if present).
 */
function buildGalleryItems(
  order: Order | null,
  mode: 'photo' | 'design' | 'invoice',
  t: (key: string) => string,
): GalleryItem[] {
  if (!order) return [];

  const items: GalleryItem[] = [];

  // ── Customer photos (up to 4) ──
  if (mode === 'photo') {
    const photoField = order.reservationData?.find((f) => f.key === 'photo');
    const photoUrls = parsePhotoValue(photoField?.value);

    photoUrls.forEach((url, index) => {
      items.push({
        id: `photo-${index}`,
        kind: 'photo',
        url,
        label:
          photoUrls.length > 1
            ? `${t('photo')} ${index + 1}`
            : t('photo'),
      });
    });
  }

  // ── Invoices / receipts ──
  if (mode === 'invoice') {
    const invoices = order.invoiceUrls || [];
    invoices.forEach((inv, index) => {
      const isImg = isImageUrl(inv.url);
      items.push({
        id: `invoice-${index}`,
        kind: 'invoice',
        url: inv.url,
        label:
          invoices.length > 1
            ? `${t('invoice')} ${index + 1}`
            : t('invoice'),
        isImage: isImg,
      });
    });
  }

  // ── Designs (text variant first, then image variant) ──
  if (mode === 'design') {
    const designs = order.designUrls || [];
    const sortedDesigns = [...designs].sort((a, b) => {
      // 'text' (no-image) template first, then 'image' template
      if (a.templateType === b.templateType) return 0;
      return a.templateType === 'text' ? -1 : 1;
    });

    sortedDesigns.forEach((design: OrderDesignUrl, index: number) => {
      const variantLabel =
        design.templateType === 'image'
          ? t('designImageVariant')
          : t('designTextVariant');

      items.push({
        id: `design-${design.productId}-${design.templateType}-${index}`,
        kind: 'design',
        url: design.url,
        label:
          designs.length > 1
            ? `${t('design')} ${index + 1} (${variantLabel})`
            : `${t('design')} (${variantLabel})`,
        templateType: design.templateType,
        projectId: design.projectId,
        productId: design.productId,
        reviewed: design.reviewed,
      });
    });
  }

  return items;
}

/**
 * Append a cache-busting query parameter to a URL.
 *
 * Order design images are overwritten at the same R2 key when the admin
 * edits + saves. Without cache-busting, the browser + Cloudflare CDN
 * serve the stale cached version.
 */
function withCacheBust(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}

interface OrderGalleryModalProps {
  /** The order to display. null = modal closed. */
  order: Order | null;
  /** Which kind of images to show: 'photo' = customer photos, 'design' = designs, 'invoice' = invoices/receipts */
  mode: 'photo' | 'design' | 'invoice';
  /** Called when the modal is closed (click outside, Escape, X button). */
  onClose: () => void;
  /** Called when the "edit design" button is clicked. Receives the design item. */
  onEditDesign?: (item: GalleryItem) => void;
  /** Called when the user confirms deletion of a photo. Receives the photo URL. */
  onDeletePhoto?: (url: string) => Promise<void>;
  /** Called when the user picks a replacement file for a photo. Receives the old URL + new File. */
  onReplacePhoto?: (oldUrl: string, file: File) => Promise<void>;
  /** Called after a design's reviewed status is successfully updated. */
  onDesignReviewChange?: (orderId: string, productId: string, reviewed: boolean) => void;
}

/**
 * Order gallery modal — shows customer photos OR generated designs
 * for an order in a single lightbox with thumbnail navigation.
 *
 * The `mode` prop controls which kind of images are shown:
 *  - 'photo'  → customer-uploaded photos only (up to 4)
 *  - 'design' → generated designs only (text + image variants)
 *
 * - Items are shown as thumbnails in a horizontal strip at the bottom.
 * - Clicking a thumbnail switches the main view.
 * - Arrow keys (←/→) navigate between items.
 * - Download works for the currently selected item.
 * - Edit is only available for design items with a projectId.
 */
export default function OrderGalleryModal({
  order,
  mode,
  onClose,
  onEditDesign,
  onDeletePhoto,
  onReplacePhoto,
  onDesignReviewChange,
}: OrderGalleryModalProps) {
  const t = useTranslations('execution.table');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, boolean>>({});
  const [isTogglingReview, setIsTogglingReview] = useState(false);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => buildGalleryItems(order, mode, t), [order, mode, t]);
  const isOpen = items.length > 0;

  // Reset local review overrides whenever a different order is shown
  useEffect(() => {
    setReviewOverrides({});
  }, [order?._id]);

  // Selection resets to 0 automatically when the parent passes a new `key`
  // (keyed by order ID in the execution page), which remounts this component.

  // Clamp selectedIndex when items shrink (e.g. after a photo is deleted
  // optimistically — the parent updates the order before this component
  // adjusts its own index).
  useEffect(() => {
    if (selectedIndex > items.length - 1) {
      setSelectedIndex(Math.max(0, items.length - 1));
    }
  }, [items.length, selectedIndex]);

  const currentItem = items[selectedIndex] || null;

  // Cache-bust design URLs so we always show the latest render
  const displayUrl = useMemo(() => {
    if (!currentItem || !isOpen) return null;
    if (currentItem.kind === 'design') {
      return withCacheBust(currentItem.url);
    }
    return currentItem.url;
  }, [currentItem, isOpen]);

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
  }, [items.length]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
  }, [items.length]);

  // Keyboard navigation — in RTL (Arabic), arrow keys are mirrored:
  // ArrowLeft → next, ArrowRight → previous (opposite of LTR/English)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isRtl) goToNext();
        else goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isRtl) goToPrevious();
        else goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrevious, goToNext, isRtl]);

  const handleDownload = async () => {
    if (!currentItem || isDownloading) return;
    const filename =
      currentItem.kind === 'design'
        ? `design-${order?.orderNumber || ''}`
        : currentItem.kind === 'invoice'
          ? `invoice-${order?.orderNumber || ''}-${selectedIndex + 1}`
          : `photo-${order?.orderNumber || ''}`;
    const url =
      currentItem.kind === 'design'
        ? withCacheBust(currentItem.url)
        : currentItem.url;
    setIsDownloading(true);
    try {
      await downloadFile(url, filename);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleEdit = () => {
    if (!currentItem || currentItem.kind !== 'design') return;
    onClose();
    onEditDesign?.(currentItem);
  };

  const canEdit =
    currentItem?.kind === 'design' && !!currentItem.projectId && !!onEditDesign;

  const canDeletePhoto = mode === 'photo' && !!onDeletePhoto;
  const canReplacePhoto = mode === 'photo' && !!onReplacePhoto;
  const isBusy = isDownloading || isDeleting || isReplacing;

  const isCurrentReviewed =
    currentItem?.kind === 'design' && currentItem.productId
      ? reviewOverrides[currentItem.productId] ?? !!currentItem.reviewed
      : false;

  const handleToggleReview = async () => {
    if (!order || !currentItem || currentItem.kind !== 'design' || !currentItem.productId || isTogglingReview) return;
    const productId = currentItem.productId;
    const nextReviewed = !isCurrentReviewed;
    setIsTogglingReview(true);
    try {
      await updateDesignReviewStatus(order._id, productId, nextReviewed);
      setReviewOverrides((prev) => ({ ...prev, [productId]: nextReviewed }));
      onDesignReviewChange?.(order._id, productId, nextReviewed);
      toast.success(nextReviewed ? t('reviewed') : t('waitingForReview'));
    } catch {
      toast.error(t('reviewUpdateFailed'));
    } finally {
      setIsTogglingReview(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!currentItem || currentItem.kind !== 'photo' || isDeleting) return;
    // Two-step: first click shows "confirm", second click deletes
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    setIsDeleting(true);
    try {
      await onDeletePhoto?.(currentItem.url);
      // selectedIndex is auto-clamped by the useEffect above when
      // the parent's optimistic update shrinks the items list.
    } catch {
      // parent shows toast
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReplaceClick = () => {
    if (!currentItem || currentItem.kind !== 'photo' || isReplacing) return;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentItem || currentItem.kind !== 'photo') return;
    setIsReplacing(true);
    try {
      await onReplacePhoto?.(currentItem.url, file);
    } catch {
      // parent shows toast
    } finally {
      setIsReplacing(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // Reset confirm-delete state when switching items
  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'photo' ? t('viewPhoto') : mode === 'design' ? t('viewDesign') : t('viewInvoice') || t('invoice')}
      size="xl"
      contentClassName="flex flex-col items-center justify-center p-0 overflow-hidden"
      footer={
        <div className="flex items-center justify-center gap-2">
          {isDownloading ? (
            <Button variant="outline" size="sm" disabled>
              <LuRefreshCw size={16} className="mr-1 animate-spin" />
              {currentItem?.kind === 'design'
                ? t('downloadDesign')
                : currentItem?.kind === 'invoice'
                  ? (t('downloadInvoice') || t('invoice'))
                  : t('downloadPhoto')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <LuDownload size={16} className="mr-1" />
              {currentItem?.kind === 'design'
                ? t('downloadDesign')
                : currentItem?.kind === 'invoice'
                  ? (t('downloadInvoice') || t('invoice'))
                  : t('downloadPhoto')}
            </Button>
          )}
          {canEdit && (
            <Button variant="primary" size="sm" onClick={handleEdit}>
              <LuPencil size={16} className="mr-1" />
              {t('editDesign')}
            </Button>
          )}
          {currentItem?.kind === 'design' && currentItem.productId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleReview}
              disabled={isTogglingReview}
              className={isCurrentReviewed ? 'text-success border-success/30 hover:bg-success/10' : 'text-warning border-warning/30 hover:bg-warning/10'}
            >
              {isTogglingReview ? (
                <LuRefreshCw size={16} className="mr-1 animate-spin" />
              ) : isCurrentReviewed ? (
                <LuCheck size={16} className="mr-1" />
              ) : (
                <LuClock size={16} className="mr-1" />
              )}
              {isCurrentReviewed ? t('reviewed') : t('waitingForReview')}
            </Button>
          )}
          {canReplacePhoto && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceClick}
              disabled={isBusy}
            >
              {isReplacing ? (
                <LuRefreshCw size={16} className="mr-1 animate-spin" />
              ) : (
                <LuReplace size={16} className="mr-1" />
              )}
              {t('replacePhoto') || 'Replace'}
            </Button>
          )}
          {canDeletePhoto && (
            <Button
              variant={confirmingDelete ? 'primary' : 'outline'}
              size="sm"
              onClick={handleDeletePhoto}
              disabled={isBusy}
              className={confirmingDelete ? 'bg-red-600 hover:bg-red-700 text-white border-red-600' : 'text-red-600 hover:text-red-700 border-red-300 hover:border-red-400'}
            >
              {isDeleting ? (
                <LuRefreshCw size={16} className="mr-1 animate-spin" />
              ) : (
                <LuTrash2 size={16} className="mr-1" />
              )}
              {confirmingDelete
                ? (t('confirmDelete') || 'Confirm?')
                : (t('deletePhoto') || 'Delete')}
            </Button>
          )}
        </div>
      }
    >
      {/* Main image — fixed height, fits viewport, no scroll */}
      <div className="relative flex items-center justify-center w-full h-[60vh] shrink-0">
        {displayUrl && currentItem?.kind === 'invoice' && !currentItem.isImage && (
          <div className="flex flex-col items-center gap-4 p-8">
            <LuFileText size={64} className="text-secondary" />
            <span className="text-sm text-secondary text-center">{currentItem.label}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <LuRefreshCw size={16} className="mr-1 animate-spin" /> : <LuDownload size={16} className="mr-1" />}
                {t('downloadInvoice') || t('invoice')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(currentItem.url, '_blank')}>
                <LuExternalLink size={16} className="mr-1" />
                {t('openUrl') || 'Open'}
              </Button>
            </div>
          </div>
        )}
        {displayUrl && !(currentItem?.kind === 'invoice' && !currentItem.isImage) && (
          <Image
            src={displayUrl}
            alt={currentItem?.label || t('design')}
            className="max-h-full max-w-full object-contain rounded-lg"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            unoptimized
          />
        )}

        {/* Navigation arrows (only when multiple items) ──
            In RTL (Arabic), the layout is mirrored:
            - Previous button → right side, right-chevron icon
            - Next button → left side, left-chevron icon
            In LTR (English):
            - Previous button → left side, left-chevron icon
            - Next button → right side, right-chevron icon */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors',
                isRtl ? 'right-2' : 'left-2',
              )}
              aria-label="Previous"
            >
              {isRtl ? <LuChevronRight size={24} /> : <LuChevronLeft size={24} />}
            </button>
            <button
              type="button"
              onClick={goToNext}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors',
                isRtl ? 'left-2' : 'right-2',
              )}
              aria-label="Next"
            >
              {isRtl ? <LuChevronLeft size={24} /> : <LuChevronRight size={24} />}
            </button>
          </>
        )}
      </div>

      {/* Counter + thumbnail strip (shrink-0, no scroll on main area) */}
      {items.length > 1 && (
        <div className="shrink-0 flex flex-col items-center gap-2 pt-3 pb-1">
          <span className="text-sm text-secondary">
            {selectedIndex + 1} / {items.length}
          </span>
          <div className="flex items-center gap-2">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all',
                  index === selectedIndex
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-stroke opacity-60 hover:opacity-100',
                )}
                aria-label={item.label}
              >
                {item.kind === 'invoice' && !item.isImage ? (
                  <div className="flex h-full w-full items-center justify-center bg-card-bg">
                    <LuFileText size={24} className="text-secondary" />
                  </div>
                ) : (
                  <Image
                    src={
                      item.kind === 'design'
                        ? withCacheBust(item.url)
                        : item.url
                    }
                    alt={item.label}
                    fill
                    className="object-cover"
                    sizes="56px"
                    unoptimized
                  />
                )}
                {item.kind === 'design' && item.productId && (
                  <span
                    className={cn(
                      'absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white',
                      (reviewOverrides[item.productId] ?? !!item.reviewed) ? 'bg-success' : 'bg-warning',
                    )}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file input for photo replacement */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleReplaceFileChange}
      />
    </Modal>
  );
}
