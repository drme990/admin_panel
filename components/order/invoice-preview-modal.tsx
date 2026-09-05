'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import {
  LuDownload,
  LuCheck,
  LuClock,
  LuFileText,
  LuExternalLink,
  LuRefreshCw,
  LuChevronLeft,
  LuChevronRight,
  LuX,
  LuPencil,
  LuTrash2,
} from 'react-icons/lu';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { downloadFile } from '@/lib/download-utils';
import { isImageUrl } from '@/lib/order/order-utils';
import { cn } from '@/lib/utils';
import { CURRENCY_OPTIONS } from '@/app/(dashboard)/invoices/lib/invoice-utils';
import ExchangeRateDisplay from '@/components/order/exchange-rate-display';
import type { Order, InvoiceStatus } from '@/types/Order';

interface InvoicePreviewModalProps {
  /** The order to display invoices for. null = modal closed. */
  order: Order | null;
  /** Called when the modal is closed. */
  onClose: () => void;
  /** Called when an invoice status is changed. Receives the updated invoiceUrls array. */
  onStatusChange?: (orderId: string, invoiceUrls: Order['invoiceUrls']) => Promise<void>;
  /** Called when an invoice value/currency is edited. Receives the updated invoiceUrls array. */
  onEditValue?: (orderId: string, invoiceUrls: Order['invoiceUrls']) => Promise<void>;
  /** Index of the invoice to show first (defaults to 0). */
  initialIndex?: number;
}

export default function InvoicePreviewModal({
  order,
  onClose,
  onStatusChange,
  onEditValue,
  initialIndex = 0,
}: InvoicePreviewModalProps) {
  const t = useTranslations('execution.table');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  // Inline labels for the invoice preview modal. These are defined here
  // instead of using the translation system to avoid next-intl's
  // MISSING_MESSAGE console errors that occur even inside try/catch.
  const L = {
    value: isRtl ? 'القيمة' : 'Value',
    status: isRtl ? 'الحالة' : 'Status',
    nonImageInvoice: isRtl ? 'فاتورة' : 'Invoice',
    downloadFailed: isRtl ? 'فشل تحميل الفاتورة' : 'Failed to download invoice',
    statusConfirmed: isRtl ? 'تم تأكيد الفاتورة' : 'Invoice marked as confirmed',
    statusWaiting: isRtl ? 'تم وضع الفاتورة بانتظار التأكيد' : 'Invoice marked as waiting',
    statusUpdated: isRtl ? 'تم تحديث حالة الفاتورة' : 'Invoice status updated',
    statusUpdateFailed: isRtl ? 'فشل تحديث حالة الفاتورة' : 'Failed to update invoice status',
    editValue: isRtl ? 'تعديل القيمة' : 'Edit Value',
    save: isRtl ? 'حفظ' : 'Save',
    cancel: isRtl ? 'إلغاء' : 'Cancel',
    valueUpdated: isRtl ? 'تم تحديث قيمة الفاتورة' : 'Invoice value updated',
    valueUpdateFailed: isRtl ? 'فشل تحديث قيمة الفاتورة' : 'Failed to update invoice value',
  } as const;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  // Local override so the UI updates instantly after a status change
  const [statusOverrides, setStatusOverrides] = useState<Record<number, InvoiceStatus>>({});

  // Inline edit state
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [editCurrency, setEditCurrency] = useState('EGP');
  const [isSavingValue, setIsSavingValue] = useState(false);
  // Local value overrides so the UI updates instantly after an edit
  const [valueOverrides, setValueOverrides] = useState<Record<number, { value: number; currency?: string }>>({});

  const invoices = useMemo(() => order?.invoiceUrls || [], [order]);
  const isOpen = invoices.length > 0;

  // Reset state when a different order is opened
  useEffect(() => {
    setStatusOverrides({});
    setValueOverrides({});
    setSelectedIndex(initialIndex);
    setIsEditingValue(false);
  }, [order?._id, initialIndex]);

  // Clamp selectedIndex when invoices shrink
  useEffect(() => {
    if (selectedIndex > invoices.length - 1) {
      setSelectedIndex(Math.max(0, invoices.length - 1));
    }
  }, [invoices.length, selectedIndex]);

  const currentInvoice = invoices[selectedIndex] || null;
  const currentStatus: InvoiceStatus =
    statusOverrides[selectedIndex] ?? currentInvoice?.invoiceStatus ?? 'waiting';
  // Apply value overrides for instant UI update after edit
  const valueOverride = valueOverrides[selectedIndex];
  const displayValue = valueOverride?.value ?? currentInvoice?.value ?? 0;
  const displayCurrency = valueOverride?.currency ?? currentInvoice?.currency;
  const isImage = currentInvoice ? isImageUrl(currentInvoice.url) : false;
  const displayUrl = currentInvoice?.url || null;

  const goToPrevious = useCallback(() => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : invoices.length - 1));
  }, [invoices.length]);

  const goToNext = useCallback(() => {
    setSelectedIndex((prev) => (prev < invoices.length - 1 ? prev + 1 : 0));
  }, [invoices.length]);

  // Keyboard navigation — mirrored in RTL
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
    if (!currentInvoice || isDownloading) return;
    const filename = `invoice-${order?.orderNumber || ''}-${selectedIndex + 1}`;
    setIsDownloading(true);
    try {
      await downloadFile(currentInvoice.url, filename);
    } catch {
      toast.error(L.downloadFailed);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!order || !currentInvoice || isUpdatingStatus || newStatus === currentStatus) return;

    const updatedInvoiceUrls = invoices.map((inv, idx) =>
      idx === selectedIndex
        ? { ...inv, invoiceStatus: newStatus, rejectionReason: newStatus === 'rejected' ? inv.rejectionReason || '' : '' }
        : inv,
    );

    // Optimistic UI update
    setStatusOverrides((prev) => ({ ...prev, [selectedIndex]: newStatus }));
    setIsUpdatingStatus(true);

    try {
      await onStatusChange?.(order._id, updatedInvoiceUrls);
      toast.success(
        newStatus === 'confirmed'
          ? L.statusConfirmed
          : newStatus === 'waiting'
            ? L.statusWaiting
            : L.statusUpdated,
      );
    } catch {
      // Revert on failure
      setStatusOverrides((prev) => {
        const next = { ...prev };
        delete next[selectedIndex];
        return next;
      });
      toast.error(L.statusUpdateFailed);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleStartEdit = () => {
    if (!currentInvoice) return;
    setEditValue(String(currentInvoice.value || ''));
    setEditCurrency(currentInvoice.currency || 'EGP');
    setIsEditingValue(true);
  };

  const handleCancelEdit = () => {
    setIsEditingValue(false);
  };

  const handleSaveValue = async () => {
    if (!order || !currentInvoice || isSavingValue || !onEditValue) return;
    const newValue = parseFloat(editValue) || 0;
    const newCurrency = editCurrency || 'EGP';

    const updatedInvoiceUrls = invoices.map((inv, idx) =>
      idx === selectedIndex
        ? { ...inv, value: newValue, currency: newCurrency }
        : inv,
    );

    // Optimistic UI update
    setValueOverrides((prev) => ({
      ...prev,
      [selectedIndex]: { value: newValue, currency: newCurrency },
    }));
    setIsSavingValue(true);

    try {
      await onEditValue(order._id, updatedInvoiceUrls);
      toast.success(L.valueUpdated);
      setIsEditingValue(false);
    } catch {
      // Revert on failure
      setValueOverrides((prev) => {
        const next = { ...prev };
        delete next[selectedIndex];
        return next;
      });
      toast.error(L.valueUpdateFailed);
    } finally {
      setIsSavingValue(false);
    }
  };

  if (!isOpen || !currentInvoice) return null;

  const formatValue = (value: number, currency?: string) => {
    const formatted = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return currency ? `${formatted} ${currency}` : formatted;
  };

  const statusConfig: Record<InvoiceStatus, { label: string; color: string; bg: string; border: string; icon: typeof LuCheck }> = {
    confirmed: {
      label: t('confirmedInvoice'),
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/30',
      icon: LuCheck,
    },
    waiting: {
      label: t('waitingInvoice'),
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/30',
      icon: LuClock,
    },
    pending: {
      label: t('pendingInvoice'),
      color: 'text-secondary',
      bg: 'bg-muted/30',
      border: 'border-stroke',
      icon: LuClock,
    },
    rejected: {
      label: t('rejectedInvoice'),
      color: 'text-error',
      bg: 'bg-error/10',
      border: 'border-error/30',
      icon: LuX,
    },
    deleted: {
      label: t('deletedInvoice'),
      color: 'text-secondary',
      bg: 'bg-muted/30',
      border: 'border-stroke',
      icon: LuTrash2,
    },
  };

  const currentStatusConfig = statusConfig[currentStatus];
  const StatusIcon = currentStatusConfig.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('viewInvoice')}${invoices.length > 1 ? ` (${selectedIndex + 1}/${invoices.length})` : ''}`}
      size="xl"
      contentClassName="flex flex-col p-0 overflow-hidden"
      footer={
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {/* Download button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <LuRefreshCw size={16} className="mr-1 animate-spin" />
            ) : (
              <LuDownload size={16} className="mr-1" />
            )}
            {t('downloadInvoice')}
          </Button>

          {/* Open in new tab (for PDFs and non-image files) */}
          {!isImage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => displayUrl && window.open(displayUrl, '_blank')}
            >
              <LuExternalLink size={16} className="mr-1" />
              {t('openUrl')}
            </Button>
          )}

          {/* Single toggle button — swaps between confirmed and waiting.
              Hidden for deleted invoices (status cannot be changed). */}
          {currentStatus !== 'deleted' && (
            <div className="flex items-center gap-1.5 ms-2 ps-2 border-s border-stroke">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleStatusChange(currentStatus === 'confirmed' ? 'waiting' : 'confirmed')}
                disabled={isUpdatingStatus}
                className={cn(
                  'transition-colors',
                  currentStatus === 'confirmed'
                    ? 'text-success border-success/40 bg-success/10 hover:bg-success/20'
                    : 'text-warning border-warning/40 bg-warning/10 hover:bg-warning/20',
                )}
              >
                {isUpdatingStatus ? (
                  <LuRefreshCw size={16} className="mr-1 animate-spin" />
                ) : currentStatus === 'confirmed' ? (
                  <LuCheck size={16} className="mr-1" />
                ) : (
                  <LuClock size={16} className="mr-1" />
                )}
                {currentStatus === 'confirmed' ? t('confirmedInvoice') : t('waitingInvoice')}
              </Button>
            </div>
          )}
        </div>
      }
    >
      {/* Invoice info bar — value, status, currency */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-4 py-3 border-b border-stroke bg-muted/20">
        <div className="flex items-center gap-4">
          {/* Value (inline-editable) */}
          {isEditingValue ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">{L.value}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="0.00"
                  className="w-28"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveValue();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Dropdown
                  value={editCurrency}
                  options={CURRENCY_OPTIONS}
                  onChange={(val) => setEditCurrency(val)}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveValue}
                  disabled={isSavingValue}
                  className="px-2"
                >
                  {isSavingValue ? (
                    <LuRefreshCw size={14} className="animate-spin" />
                  ) : (
                    <LuCheck size={14} />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={isSavingValue}
                  className="px-2"
                >
                  <LuX size={14} />
                </Button>
              </div>
              {/* Exchange rate preview — shown when currency differs from order currency */}
              <ExchangeRateDisplay
                fromCurrency={editCurrency}
                toCurrency={order?.currency || 'EGP'}
                amount={parseFloat(editValue) || 0}
                namespace="execution"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-xs text-secondary">
                  {L.value}
                </span>
                <span className="text-sm font-bold text-foreground">
                  {formatValue(displayValue, displayCurrency)}
                </span>
              </div>
              {onEditValue && currentStatus !== 'deleted' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartEdit}
                  className="p-1 text-secondary hover:text-primary"
                  aria-label={L.editValue}
                >
                  <LuPencil size={14} />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">
            {L.status}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium',
              currentStatusConfig.color,
              currentStatusConfig.bg,
              currentStatusConfig.border,
            )}
          >
            <StatusIcon size={14} />
            {currentStatusConfig.label}
          </span>
        </div>
      </div>

      {/* Main preview area — reduced height so thumbnail strip + footer fit */}
      <div className="relative flex items-center justify-center w-full h-[40vh] shrink-0 bg-background overflow-hidden">
        {isImage && displayUrl ? (
          <Image
            src={displayUrl}
            alt={t('invoice')}
            className="max-h-full max-w-full object-contain rounded-lg"
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            unoptimized
          />
        ) : displayUrl ? (
          <div className="flex flex-col items-center gap-3 p-6">
            <LuFileText size={48} className="text-secondary" />
            <span className="text-sm text-secondary text-center">
              {L.nonImageInvoice} {selectedIndex + 1}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
                {isDownloading ? <LuRefreshCw size={16} className="mr-1 animate-spin" /> : <LuDownload size={16} className="mr-1" />}
                {t('downloadInvoice')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(displayUrl, '_blank')}>
                <LuExternalLink size={16} className="mr-1" />
                {t('openUrl')}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Navigation arrows (only when multiple invoices) */}
        {invoices.length > 1 && (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors',
                isRtl ? 'right-2' : 'left-2',
              )}
              aria-label="Previous"
            >
              {isRtl ? <LuChevronRight size={20} /> : <LuChevronLeft size={20} />}
            </button>
            <button
              type="button"
              onClick={goToNext}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors',
                isRtl ? 'left-2' : 'right-2',
              )}
              aria-label="Next"
            >
              {isRtl ? <LuChevronLeft size={20} /> : <LuChevronRight size={20} />}
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip (only when multiple invoices) — compact, clean */}
      {invoices.length > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 border-t border-stroke bg-muted/10">
          {invoices.map((inv, index) => {
            const invIsImage = isImageUrl(inv.url);
            const invStatus = statusOverrides[index] ?? inv.invoiceStatus ?? 'waiting';
            return (
              <button
                key={`thumb-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all flex items-center justify-center',
                  index === selectedIndex
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-stroke hover:border-primary/50 opacity-60 hover:opacity-100',
                )}
              >
                {invIsImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element -- thumbnail */
                  <img
                    src={inv.url}
                    alt={`Invoice ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <LuFileText size={18} className="text-secondary" />
                )}
                {/* Status dot */}
                <span
                  className={cn(
                    'absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-white',
                    invStatus === 'confirmed' ? 'bg-success' :
                      invStatus === 'waiting' ? 'bg-warning' :
                        invStatus === 'rejected' ? 'bg-error' :
                          invStatus === 'deleted' ? 'bg-muted-foreground' :
                            'bg-secondary',
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
