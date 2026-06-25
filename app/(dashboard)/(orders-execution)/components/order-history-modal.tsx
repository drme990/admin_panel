'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';

export interface OrderHistoryEntry {
  _id: string;
  changeType:
  | 'name'
  | 'items'
  | 'duaa'
  | 'photo'
  | 'invoice'
  | 'executionDate'
  | 'bulk_execution_date'
  | 'gender'
  | 'isAlive'
  | 'intention';
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
    executionDate: 'orderHistory.typeExecutionDate',
    bulk_execution_date: 'orderHistory.typeBulkExecutionDate',
    gender: 'orderHistory.typeGender',
    isAlive: 'orderHistory.typeIsAlive',
    intention: 'orderHistory.typeIntention',
  };
  return t(keyMap[type] || 'orderHistory.typeUnknown');
}

function isImageUrl(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith('http') && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(value);
}

function PhotoValue({ value, onClick }: { value: string | null; onClick?: (url: string) => void }) {
  if (!value) return <span className="text-secondary">-</span>;
  if (isImageUrl(value)) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(value)}
        className="block group cursor-pointer"
      >
        <img
          src={value}
          alt="Photo"
          className="w-24 h-24 object-cover rounded-lg border border-stroke group-hover:ring-2 ring-primary transition-all"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      </button>
    );
  }
  return <span className="text-foreground break-all">{value.length > 40 ? `${value.slice(0, 40)}...` : value}</span>;
}

function InvoiceValue({ value, onClick }: { value: string | null; onClick?: (url: string) => void }) {
  if (!value) return <span className="text-secondary">-</span>;
  if (isImageUrl(value)) {
    return (
      <img
        src={value}
        alt="Invoice"
        className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => onClick?.(value)}
      />
    );
  }
  return (
    <a
      href={value}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-all text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {value}
    </a>
  );
}

function TextValue({ type, value }: { type: OrderHistoryEntry['changeType']; value: string | null }) {
  if (value === null || value === undefined) return <span className="text-secondary">-</span>;
  if (type === 'items') {
    try {
      const items = JSON.parse(value) as Array<{
        productName?: { ar?: string; en?: string };
        quantity?: number;
      }>;
      return (
        <span className="text-foreground">
          {items
            .map((item) => `${item.quantity || 1}x ${item.productName?.en || item.productName?.ar || '?'}`)
            .join(', ')}
        </span>
      );
    } catch {
      return <span className="text-foreground break-all">{value}</span>;
    }
  }
  return <span className="text-foreground break-all">{value}</span>;
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
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

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
            {history.map((entry) => (
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
                    {entry.changeType === 'photo' ? (
                      <PhotoValue value={entry.previousValue} onClick={setExpandedPhoto} />
                    ) : entry.changeType === 'invoice' ? (
                      <InvoiceValue value={entry.previousValue} onClick={setExpandedPhoto} />
                    ) : (
                      <TextValue type={entry.changeType} value={entry.previousValue} />
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-secondary block mb-1">
                      {t('orderHistory.new')}
                    </span>
                    {entry.changeType === 'photo' ? (
                      <PhotoValue value={entry.newValue} onClick={setExpandedPhoto} />
                    ) : entry.changeType === 'invoice' ? (
                      <InvoiceValue value={entry.newValue} onClick={setExpandedPhoto} />
                    ) : (
                      <TextValue type={entry.changeType} value={entry.newValue} />
                    )}
                  </div>
                </div>

                {(entry.changeType === 'photo' || entry.changeType === 'invoice') && entry.previousValue && onRollback && (
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
            ))}
          </div>
        )}
      </Modal>

      {/* Expanded photo lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedPhoto(null)}
        >
          <img
            src={expandedPhoto}
            alt="Expanded"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}
    </>
  );
}
