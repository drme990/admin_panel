'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { LuTrash2, LuRefreshCw } from 'react-icons/lu';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Textarea from '@/components/ui/textarea';
import Dropdown from '@/components/ui/dropdown';
import type { InvoiceDeletionReason } from '@/types/Order';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    invoice: InvoiceRow,
    reason: InvoiceDeletionReason,
    customReason: string,
  ) => void;
  loading: boolean;
}

const DELETION_REASON_KEYS: InvoiceDeletionReason[] = [
  'returned',
  'duplicate',
  'fake',
  'test',
  'uploaded_by_mistake',
  'other',
];

export default function InvoiceDeleteModal({
  invoice,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: Props) {
  const t = useTranslations('admin.invoices');
  const locale = useLocale();
  const isRtl = locale === 'ar';

  const [selectedReason, setSelectedReason] = useState<InvoiceDeletionReason | ''>('');
  const [customReason, setCustomReason] = useState('');

  const reasonOptions = useMemo(
    () =>
      DELETION_REASON_KEYS.map((key) => ({
        value: key,
        label: t(`deleteReasons.${key}`),
      })),
    [t],
  );

  const handleClose = () => {
    if (loading) return;
    setSelectedReason('');
    setCustomReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (!invoice || !selectedReason) return;
    if (selectedReason === 'other' && !customReason.trim()) return;
    onConfirm(
      invoice,
      selectedReason,
      selectedReason === 'other' ? customReason.trim() : '',
    );
  };

  const formatValue = (value: number, currency?: string) => {
    const formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? `${formatted} ${currency}` : formatted;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('deleteTitle')}
      size="sm"
      className="overflow-visible"
      contentClassName='overflow-visible'
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={loading || !selectedReason || (selectedReason === 'other' && !customReason.trim())}
          >
            {loading ? (
              <LuRefreshCw size={16} className={isRtl ? 'ml-1 animate-spin' : 'mr-1 animate-spin'} />
            ) : (
              <LuTrash2 size={16} className={isRtl ? 'ml-1' : 'mr-1'} />
            )}
            {t('deleteConfirm')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Warning */}
        <p className="text-sm text-secondary">
          {t('deleteWarning')}
        </p>

        {/* Invoice value display */}
        {invoice && invoice.value > 0 && (
          <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2">
            <span className="text-xs text-secondary">
              {t('deleteValueLabel')}:
            </span>{' '}
            <span className="text-sm font-bold text-foreground">
              {formatValue(invoice.value, invoice.invoiceCurrency)}
            </span>
          </div>
        )}

        {/* Reason dropdown */}
        <div>
          <label className="text-xs font-medium text-secondary mb-1.5 block">
            {t('deleteReasonLabel')}
            <span className="text-error ms-0.5">*</span>
          </label>
          <Dropdown
            value={selectedReason}
            options={reasonOptions}
            onChange={(val) => setSelectedReason(val as InvoiceDeletionReason)}
            placeholder={t('deleteReasonPlaceholder')}
          />
        </div>

        {/* Custom reason input when "other" is selected */}
        {selectedReason === 'other' && (
          <div>
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('deleteCustomReasonLabel')}
              <span className="text-error ms-0.5">*</span>
            </label>
            <Textarea
              value={customReason}
              onChange={setCustomReason}
              placeholder={t('deleteCustomReasonPlaceholder')}
              rows={3}
              maxLength={500}
              showCount
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
