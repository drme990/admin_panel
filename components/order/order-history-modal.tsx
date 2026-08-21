'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LuFileText } from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import { STATUS_COLORS } from '../../lib/order/order-status';
import { OrderStatus } from '@/types/Order';
import InvoicePreviewModal from '../../app/(dashboard)/invoices/components/invoice-preview-modal';

export interface OrderHistoryEntry {
  _id: string;
  changeType:
  | 'name'
  | 'items'
  | 'duaa'
  | 'photo'
  | 'invoice'
  | 'invoiceImage'
  | 'invoiceStatus'
  | 'invoiceValue'
  | 'executionDate'
  | 'bulk_execution_date'
  | 'gender'
  | 'isAlive'
  | 'intention'
  | 'status'
  | 'payment';
  previousValue: string | null;
  newValue: string | null;
  changedByUserName: string;
  changedByUserEmail: string;
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  history: OrderHistoryEntry[];
  loading: boolean;
  onRollback?: (entry: OrderHistoryEntry) => void;
  updating?: boolean;
  namespace?: 'orders' | 'execution';
}

function formatChangeType(
  type: OrderHistoryEntry['changeType'],
  t: (key: string) => string,
): string {
  const keyMap: Record<OrderHistoryEntry['changeType'], string> = {
    name: 'orderHistory.typeName',
    items: 'orderHistory.typeItems',
    duaa: 'orderHistory.typeDuaa',
    photo: 'orderHistory.typePhoto',
    invoice: 'orderHistory.typeInvoice',
    invoiceImage: 'orderHistory.typeInvoiceImage',
    invoiceStatus: 'orderHistory.typeInvoiceStatus',
    invoiceValue: 'orderHistory.typeInvoiceValue',
    executionDate: 'orderHistory.typeExecutionDate',
    bulk_execution_date: 'orderHistory.typeBulkExecutionDate',
    gender: 'orderHistory.typeGender',
    isAlive: 'orderHistory.typeIsAlive',
    intention: 'orderHistory.typeIntention',
    status: 'orderHistory.typeStatus',
    payment: 'orderHistory.typePayment',
  };
  return t(keyMap[type] || 'orderHistory.typeUnknown');
}

function isImageUrl(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith('http') && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(value);
}

function extractInvoiceUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('http')) return value;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { url?: unknown } | undefined;
      if (first && typeof first.url === 'string') return first.url;
    }
    if (parsed && typeof parsed === 'object') {
      const url = (parsed as { url?: unknown }).url;
      if (typeof url === 'string') return url;
    }
  } catch {
    // ignore
  }
  return null;
}

function extractInvoiceStatus(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { invoiceStatus?: unknown } | undefined;
      if (first && typeof first.invoiceStatus === 'string') return first.invoiceStatus;
    }
    if (parsed && typeof parsed === 'object') {
      const invoiceStatus = (parsed as { invoiceStatus?: unknown }).invoiceStatus;
      if (typeof invoiceStatus === 'string') return invoiceStatus;
    }
  } catch {
    // ignore
  }
  return null;
}

function parseInvoiceFieldValue(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore
  }
  return null;
}

function parsePhotoUrls(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string' && v.length > 0);
    }
  } catch {
    // Not JSON — treat as a single URL (legacy)
  }
  return isImageUrl(value) ? [value] : [];
}

function PhotoValue({ value, onClick }: { value: string | null; onClick?: (url: string) => void }) {
  if (!value) return <span className="text-secondary">-</span>;
  const urls = parsePhotoUrls(value);
  if (urls.length > 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onClick?.(url)}
            className="block group cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic URL with onError hide fallback */}
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              className="w-24 h-24 object-cover rounded-lg border border-stroke group-hover:ring-2 ring-primary transition-all"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
        ))}
      </div>
    );
  }
  return <span className="text-foreground break-all">{value.length > 40 ? `${value.slice(0, 40)}...` : value}</span>;
}

function InvoiceValue({ value, onClick }: { value: string | null; onClick?: (url: string) => void }) {
  const url = extractInvoiceUrl(value);
  const status = extractInvoiceStatus(value);
  const displayUrl = url || value || '';
  const statusLabel = status ? `(${status})` : '';

  if (!value) return <span className="text-secondary">-</span>;
  return (
    <button
      type="button"
      onClick={() => url && onClick?.(url)}
      disabled={!url}
      className="flex items-center gap-2 text-primary hover:underline text-sm disabled:opacity-60 disabled:cursor-default"
    >
      {url && isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic URL with conditional render
        <img
          src={url}
          alt="Invoice"
          className="w-16 h-16 object-cover rounded hover:opacity-80 transition-opacity"
        />
      ) : (
        <>
          <span className="inline-flex items-center justify-center p-2 rounded-lg border border-stroke bg-background">
            <LuFileText size={24} />
          </span>
          <span className="break-all max-w-50">
            {displayUrl.length > 40 ? `${displayUrl.slice(0, 40)}...` : displayUrl}
            {statusLabel && <span className="ml-1 text-xs text-secondary">{statusLabel}</span>}
          </span>
        </>
      )}
    </button>
  );
}

function InvoiceImageValue({ value, onClick }: { value: string | null; onClick?: (url: string) => void }) {
  const t = useTranslations('admin.invoices');
  const parsed = parseInvoiceFieldValue(value);
  let url = value;
  if (parsed && typeof parsed.url === 'string') {
    url = parsed.url;
  }

  if (!value) return <span className="text-secondary">-</span>;
  if (!url) return <span className="text-secondary">-</span>;

  return (
    <button
      type="button"
      onClick={() => onClick?.(url)}
      className="flex items-center gap-2 text-primary hover:underline text-sm"
    >
      {isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic URL with conditional render
        <img
          src={url}
          alt={t('preview')}
          className="w-16 h-16 object-cover rounded hover:opacity-80 transition-opacity"
        />
      ) : (
        <>
          <span className="inline-flex items-center justify-center p-2 rounded-lg border border-stroke bg-background">
            <LuFileText size={24} />
          </span>
          <span className="break-all max-w-50">{url.length > 40 ? `${url.slice(0, 40)}...` : url}</span>
        </>
      )}
    </button>
  );
}

function InvoiceStatusValue({ value }: { value: string | null }) {
  const tInvoices = useTranslations('admin.invoices');
  const parsed = parseInvoiceFieldValue(value);
  let status = value;
  if (parsed && typeof parsed.invoiceStatus === 'string') {
    status = parsed.invoiceStatus;
  }
  const rejectionReason = parsed && typeof parsed.rejectionReason === 'string' ? parsed.rejectionReason : null;

  if (!status) return <span className="text-secondary">-</span>;

  const statusColors: Record<string, string> = {
    confirmed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    waiting: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };

  const label = tInvoices(`status.${status}`) || status;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-block w-fit px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {label}
      </span>
      {rejectionReason && (
        <span className="text-xs text-error">{rejectionReason}</span>
      )}
    </div>
  );
}

function InvoiceValueValue({ value }: { value: string | null }) {
  const parsed = parseInvoiceFieldValue(value);
  const amount = typeof parsed?.value === 'number' ? parsed.value : null;
  const currency = typeof parsed?.currency === 'string' ? parsed.currency : null;

  if (amount === null) return <span className="text-secondary">-</span>;

  return (
    <span className="text-foreground font-medium">
      {amount.toFixed(2)} {currency || ''}
    </span>
  );
}

function TextValue({ type, value }: { type: OrderHistoryEntry['changeType']; value: string | null }) {
  if (value === null || value === undefined) return <span className="text-secondary">-</span>;
  if (type === 'items') {
    let parsedItems: Array<{ productName?: { ar?: string; en?: string }; quantity?: number }> | null = null;
    try {
      parsedItems = JSON.parse(value) as Array<{
        productName?: { ar?: string; en?: string };
        quantity?: number;
      }>;
    } catch {
      parsedItems = null;
    }
    if (Array.isArray(parsedItems)) {
      return (
        <span className="text-foreground">
          {parsedItems
            .map((item) => `${item.quantity || 1}x ${item.productName?.en || item.productName?.ar || '?'}`)
            .join(', ')}
        </span>
      );
    }
    return <span className="text-foreground break-all">{value}</span>;
  }
  return <span className="text-foreground break-all">{value}</span>;
}

function StatusValue({ value, t }: { value: string | null; t: (key: string) => string }) {
  if (!value) return <span className="text-secondary">-</span>;
  const colorClass = STATUS_COLORS[value as OrderStatus] || 'bg-gray-100 text-gray-800';
  const label = t(`status.${value}`) || value;
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  orderNumber,
  history,
  loading,
  onRollback,
  updating,
  namespace = 'execution',
}: Props) {
  const t = useTranslations(namespace);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Find the index of the most recent status change (history is newest-first)
  const latestStatusIndex = history.findIndex((e) => e.changeType === 'status');

  const renderValue = (entry: OrderHistoryEntry, field: 'previousValue' | 'newValue') => {
    const value = entry[field];
    if (entry.changeType === 'photo') {
      return <PhotoValue value={value} onClick={setPreviewUrl} />;
    }
    if (entry.changeType === 'invoice') {
      return <InvoiceValue value={value} onClick={setPreviewUrl} />;
    }
    if (entry.changeType === 'invoiceImage') {
      return <InvoiceImageValue value={value} onClick={setPreviewUrl} />;
    }
    if (entry.changeType === 'invoiceStatus') {
      return <InvoiceStatusValue value={value} />;
    }
    if (entry.changeType === 'invoiceValue') {
      return <InvoiceValueValue value={value} />;
    }
    if (entry.changeType === 'status') {
      return <StatusValue value={value} t={t} />;
    }
    return <TextValue type={entry.changeType} value={value} />;
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`${t('orderHistory.title')} — ${orderNumber}`}
        size="lg"
        footer={
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>
              {t('orderHistory.close')}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="py-8 flex justify-center">
            <Loading />
          </div>
        ) : history.length === 0 ? (
          <div className="py-8 text-center text-secondary">
            {t('orderHistory.empty')}
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {history.map((entry, index) => {
              const canRollback =
                onRollback &&
                entry.previousValue &&
                ((entry.changeType === 'photo' ||
                  entry.changeType === 'invoice' ||
                  entry.changeType === 'invoiceImage' ||
                  entry.changeType === 'invoiceStatus' ||
                  entry.changeType === 'invoiceValue') ||
                  (entry.changeType === 'status' && index === latestStatusIndex));

              return (
                <div
                  key={entry._id}
                  className="p-3 rounded-lg border border-stroke bg-background space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                      {formatChangeType(entry.changeType, t)}
                    </span>
                    <span className="text-xs text-secondary">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-xs text-secondary block mb-1">
                        {t('orderHistory.previous')}
                      </span>
                      {renderValue(entry, 'previousValue')}
                    </div>
                    <div>
                      <span className="text-xs text-secondary block mb-1">
                        {t('orderHistory.new')}
                      </span>
                      {renderValue(entry, 'newValue')}
                    </div>
                  </div>

                  {canRollback && (
                    <div className="pt-1 border-t border-stroke">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRollback(entry)}
                        disabled={updating}
                        className="text-primary hover:text-primary/80"
                      >
                        {updating ? t('orderHistory.rollingBack') : t('orderHistory.rollback')}
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-secondary pt-1 border-t border-stroke">
                    {t('orderHistory.by')} {entry.changedByUserName}{' '}
                    <span className="opacity-60">({entry.changedByUserEmail})</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <InvoicePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
    </>
  );
}