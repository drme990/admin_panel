'use client';

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
    executionDate: 'orderHistory.typeExecutionDate',
    bulk_execution_date: 'orderHistory.typeBulkExecutionDate',
    gender: 'orderHistory.typeGender',
    isAlive: 'orderHistory.typeIsAlive',
    intention: 'orderHistory.typeIntention',
  };
  return t(keyMap[type] || 'orderHistory.typeUnknown');
}

function formatValue(type: OrderHistoryEntry['changeType'], value: string | null): string {
  if (value === null || value === undefined) return '-';
  if (type === 'items') {
    try {
      const items = JSON.parse(value) as Array<{
        productName?: { ar?: string; en?: string };
        quantity?: number;
      }>;
      return items
        .map((item) => `${item.quantity || 1}x ${item.productName?.en || item.productName?.ar || '?'}`)
        .join(', ');
    } catch {
      return value;
    }
  }
  if (type === 'photo') {
    return value.length > 40 ? `${value.slice(0, 40)}...` : value;
  }
  return value;
}

export default function OrderHistoryModal({
  isOpen,
  onClose,
  orderNumber,
  history,
  loading,
}: Props) {
  const t = useTranslations('execution');

  return (
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
                  <span className="text-xs text-secondary block">
                    {t('orderHistory.previous')}
                  </span>
                  <span className="text-foreground break-all">
                    {formatValue(entry.changeType, entry.previousValue)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-secondary block">
                    {t('orderHistory.new')}
                  </span>
                  <span className="text-foreground break-all">
                    {formatValue(entry.changeType, entry.newValue)}
                  </span>
                </div>
              </div>

              <div className="text-xs text-secondary pt-1 border-t border-stroke">
                {t('orderHistory.by')} {entry.changedByUserName}{' '}
                <span className="opacity-60">({entry.changedByUserEmail})</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
