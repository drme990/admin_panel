'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';

import type { InvoiceRow } from '../lib/invoice-utils';
import { CURRENCY_OPTIONS } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  saving: boolean;
  onClose: () => void;
  onSave: (value: number, currency: string) => void;
}

export default function InvoiceEditModal({ invoice, saving, onClose, onSave }: Props) {
  const t = useTranslations('admin.invoices');

  const [editValue, setEditValue] = useState('');
  const [editCurrency, setEditCurrency] = useState('EGP');

  useEffect(() => {
    if (invoice) {
      setEditValue(String(invoice.value || ''));
      setEditCurrency(invoice.invoiceCurrency || 'EGP');
    }
  }, [invoice]);

  return (
    <Modal
      isOpen={!!invoice}
      onClose={onClose}
      title={t('editTitle')}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave(parseFloat(editValue) || 0, editCurrency)}
            disabled={saving}
          >
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      }
      className="overflow-visible"
      contentClassName="overflow-visible"
    >
      {invoice && (
        <div className='flex gap-2 justify-center items-center'>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="0.00"
          />
          <Dropdown
            value={editCurrency}
            options={CURRENCY_OPTIONS}
            onChange={(val) => setEditCurrency(val)}
          />
        </div>
      )
      }
    </Modal >
  );
}
