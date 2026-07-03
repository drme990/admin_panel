'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LuRefreshCw } from 'react-icons/lu';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Textarea from '@/components/ui/textarea';
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

export default function InvoiceRejectionModal({
  invoice,
  status,
  isOpen,
  onClose,
  onConfirm,
  loading,
}: Props) {
  const t = useTranslations('admin.invoices');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(invoice?.rejectionReason || '');
    } else {
      setReason('');
    }
  }, [isOpen, invoice]);

  const handleConfirm = () => {
    if (!invoice || !status) return;
    onConfirm(invoice, status, reason.trim());
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={loading}>
        {t('cancel')}
      </Button>
      <Button variant="primary" onClick={handleConfirm} disabled={!reason.trim() || loading}>
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
    >
      <div className="space-y-3">
        <p className="text-sm text-secondary">{t('rejectionReasonHint')}</p>
        <Textarea
          value={reason}
          onChange={(val) => setReason(val)}
          placeholder={t('rejectionReasonPlaceholder')}
          rows={4}
        />
      </div>
    </Modal>
  );
}
