'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { LuRefreshCw } from 'react-icons/lu';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/order';
import type { PaymentMethod } from '@/types/Order';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: InvoiceRow, paymentMethod: PaymentMethod) => void;
  saving: boolean;
}

export default function InvoicePaymentMethodModal({
  invoice,
  isOpen,
  onClose,
  onSave,
  saving,
}: Props) {
  const t = useTranslations('admin.invoices');
  const locale = useLocale();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(
    invoice?.paymentMethod || '',
  );

  const options = PAYMENT_METHODS.map((method) => ({
    value: method,
    label:
      locale === 'ar'
        ? PAYMENT_METHOD_LABELS[method].ar
        : PAYMENT_METHOD_LABELS[method].en,
  }));

  const handleSave = () => {
    if (!invoice || !paymentMethod) return;
    onSave(invoice, paymentMethod as PaymentMethod);
  };

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose} disabled={saving}>
        {t('cancel')}
      </Button>
      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!paymentMethod || saving}
      >
        {saving ? (
          <>
            <LuRefreshCw size={16} className="animate-spin" />
            {t('saving')}
          </>
        ) : (
          t('save')
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editPaymentMethod')}
      size="sm"
      footer={footer}
      className="overflow-visible"
      contentClassName="overflow-visible"
    >
      <Dropdown
        label={t('paymentMethod')}
        value={paymentMethod}
        options={options}
        onChange={(val) => setPaymentMethod(val as PaymentMethod)}
        className="w-full"
      />
    </Modal>
  );
}
