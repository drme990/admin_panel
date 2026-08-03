'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { LuDownload, LuPencil, LuChevronLeft, LuChevronRight, LuRefreshCw } from 'react-icons/lu';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { downloadFile } from '@/lib/download-utils';
import { cn } from '@/lib/utils';
import type { Order, OrderDesignUrl } from '@/types/Order';

/**
 * A single gallery item — either a customer-uploaded photo or a
 * generated design image.
 */
export interface GalleryItem {
  /** Stable unique key for React lists */
  id: string;
  /** 'photo' = customer-uploaded image, 'design' = generated design */
  kind: 'photo' | 'design';
  /** Public R2 URL of the image */
  url: string;
  /** Human-readable label shown in the thumbnail strip */
  label: string;
  /** For design items: which template variant was used */
  templateType?: 'text' | 'image';
  /** For design items: the design-app project ID (for editing) */
  projectId?: string;
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
  mode: 'photo' | 'design',
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
  /** Which kind of images to show: 'photo' = customer photos only, 'design' = designs only */
  mode: 'photo' | 'design';
  /** Called when the modal is closed (click outside, Escape, X button). */
  onClose: () => void;
  /** Called when the "edit design" button is clicked. Receives the design item. */
  onEditDesign?: (item: GalleryItem) => void;
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
}: OrderGalleryModalProps) {
  const t = useTranslations('execution.table');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const items = useMemo(() => buildGalleryItems(order, mode, t), [order, mode, t]);
  const isOpen = items.length > 0;

  // Selection resets to 0 automatically when the parent passes a new `key`
  // (keyed by order ID in the execution page), which remounts this component.

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

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrevious, goToNext]);

  const handleDownload = async () => {
    if (!currentItem || isDownloading) return;
    const filename = currentItem.kind === 'design'
      ? `design-${order?.orderNumber || ''}`
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

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'photo' ? t('viewPhoto') : t('viewDesign')}
      size="xl"
      contentClassName="flex flex-col items-center justify-center p-0 overflow-hidden"
      footer={
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <LuRefreshCw size={16} className="mr-1 animate-spin" />
            ) : (
              <LuDownload size={16} className="mr-1" />
            )}
            {currentItem?.kind === 'design'
              ? t('downloadDesign')
              : t('downloadPhoto')}
          </Button>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={handleEdit}>
              <LuPencil size={16} className="mr-1" />
              {t('editDesign')}
            </Button>
          )}
        </div>
      }
    >
      {/* Main image — fixed height, fits viewport, no scroll */}
      <div className="relative flex items-center justify-center w-full h-[60vh] shrink-0">
        {displayUrl && (
          <Image
            src={displayUrl}
            alt={currentItem?.label || t('design')}
            className="max-h-full max-w-full object-contain rounded-lg"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            unoptimized
          />
        )}

        {/* Navigation arrows (only when multiple items) */}
        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Previous"
            >
              <LuChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Next"
            >
              <LuChevronRight size={24} />
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
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
