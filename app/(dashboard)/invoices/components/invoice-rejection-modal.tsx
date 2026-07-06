'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LuRefreshCw } from 'react-icons/lu';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Textarea from '@/components/ui/textarea';
import Dropdown from '@/components/ui/dropdown';
import type { InvoiceStatus } from '@/types/Order';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  status: InvoiceStatus | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (invoice: InvoiceRow, status: InvoiceStatus, reason: string) => void;
  loading: boolean;
}

const REJECTION_REASON_KEYS = ['missingData', 'differentCurrency', 'unclearPhoto', 'fakeReceipt', 'other'] as const;

export default function InvoiceRejectionModal({
  invoice,
  status,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: Props) {
  const t = useTranslations('admin.invoices');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  const rejectionOptions = useMemo(
    () =>
      REJECTION_REASON_KEYS.map((key) => ({
        value: key,
        label: t(`rejectionReasons.${key}`),
      })),
    [t],
  );

  useEffect(() => {
    if (isOpen) {
      const existing = invoice?.rejectionReason || '';
      const matched = rejectionOptions.find((opt) => opt.label === existing);
      if (matched) {
        setSelectedReason(matched.value);
        setCustomReason('');
      } else {
        setSelectedReason(existing ? 'other' : '');
        setCustomReason(existing);
      }
    } else {
      setSelectedReason('');
      setCustomReason('');
    }
  }, [isOpen, invoice, rejectionOptions]);

  const handleConfirm = () => {
    if (!invoice || !status) return;
    const finalReason = selectedReason === 'other'
      ? customReason.trim()
      : t(`rejectionReasons.${selectedReason as (typeof REJECTION_REASON_KEYS)[number]}`).trim();
    onConfirm(invoice, status, finalReason);
  };

  const canConfirm = selectedReason && (selectedReason !== 'other' || customReason.trim());

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        {t('cancel')}
      </Button>
      <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm || loading}>
        {loading ? (
          <>
            <LuRefreshCw size={16} className="animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('confirm')
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('rejectionReasonTitle')}
      size="sm"
      footer={footer}
      className='overflow-visible'
      contentClassName='overflow-visible'
    >
      <div className="space-y-3">
        <p className="text-sm text-secondary">{t('rejectionReasonHint')}</p>
        <Dropdown
          value={selectedReason}
          options={rejectionOptions}
          onChange={(val) => setSelectedReason(val)}
          placeholder={t('rejectionReasonPlaceholder')}
        />
        {selectedReason === 'other' && (
          <Textarea
            value={customReason}
            onChange={(val) => setCustomReason(val)}
            placeholder={t('rejectionReasonPlaceholder')}
            rows={3}
          />
        )}
      </div>
    </Modal>
  );
}
