'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import { OrderStatus } from '@/types/Order';
import { STATUS_COLORS } from '../lib/order-status';

type CancellationPreset = 'returned' | 'scammer' | 'duplicate' | 'other';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: OrderStatus;
  onUpdateStatus: (status: OrderStatus, cancellationReason?: string, isScammer?: boolean) => void;
  updating: boolean;
  namespace?: 'orders' | 'execution';
}

const AVAILABLE_STATUSES: OrderStatus[] = ['completed', 'refunded', 'cancelled'];

export default function ChangeStatusModal({
  isOpen,
  onClose,
  currentStatus,
  onUpdateStatus,
  updating,
  namespace = 'orders',
}: Props) {
  const t = useTranslations(namespace);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('completed');
  const [cancellationPreset, setCancellationPreset] = useState<CancellationPreset>('returned');
  const [customReason, setCustomReason] = useState('');

  const presetOptions = useMemo(
    () => [
      { label: t('changeStatusModal.reasonReturned'), value: 'returned' as CancellationPreset },
      { label: t('changeStatusModal.reasonScammer'), value: 'scammer' as CancellationPreset },
      { label: t('changeStatusModal.reasonDuplicate'), value: 'duplicate' as CancellationPreset },
      { label: t('changeStatusModal.reasonOther'), value: 'other' as CancellationPreset },
    ],
    [t],
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedStatus('completed');
      setCancellationPreset('returned');
      setCustomReason('');
    }
  }, [isOpen]);

  const isCancelled = selectedStatus === 'cancelled';
  const isOther = cancellationPreset === 'other';
  const cancellationReason = isOther ? customReason.trim() : t(`changeStatusModal.reason${cancellationPreset.charAt(0).toUpperCase() + cancellationPreset.slice(1)}`);
  const canSubmit = !isCancelled || (isOther ? customReason.trim().length > 0 : true);

  const handleSave = () => {
    if (!canSubmit) return;
    onUpdateStatus(selectedStatus, isCancelled ? cancellationReason : undefined, isCancelled && cancellationPreset === 'scammer');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('changeStatusModal.title')}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {AVAILABLE_STATUSES.map((status) => (
            <label
              key={status}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedStatus === status
                ? 'border-primary bg-primary/5'
                : 'border-stroke bg-background hover:bg-foreground/5'
                }`}
            >
              <input
                type="radio"
                name="order-status"
                value={status}
                checked={selectedStatus === status}
                onChange={() => setSelectedStatus(status)}
                className="accent-primary h-4 w-4 shrink-0"
              />
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[status]}`}>
                {t(`status.${status}`)}
              </span>
            </label>
          ))}
        </div>

        {isCancelled && (
          <div className="flex flex-col gap-2">
            <Dropdown
              label={t('changeStatusModal.cancellationReasonLabel')}
              value={cancellationPreset}
              options={presetOptions}
              onChange={(val) => setCancellationPreset(val)}
              placeholder={t('changeStatusModal.cancellationReasonPlaceholder')}
            />
            {isOther && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder={t('changeStatusModal.customReasonPlaceholder')}
                rows={2}
                className="w-full rounded-lg border border-stroke bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
              />
            )}
            {!canSubmit && (
              <span className="text-xs text-red-500">
                {t('changeStatusModal.cancellationReasonRequired')}
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={updating}>
            {t('changeStatusModal.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={updating || !canSubmit}
          >
            {updating ? t('changeStatusModal.saving') : t('changeStatusModal.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
