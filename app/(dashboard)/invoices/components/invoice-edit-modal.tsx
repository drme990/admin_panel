'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { LuFileText } from 'react-icons/lu';

import type { InvoiceRow } from '../lib/invoice-utils';
import { isImageUrl, CURRENCY_OPTIONS } from '../lib/invoice-utils';

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
    <Modal isOpen={!!invoice} onClose={onClose} title={t('editTitle')} size="sm">
      {invoice && (
        <div className="flex flex-col gap-4">
          {/* Preview */}
          <div className="flex justify-center">
            {isImageUrl(invoice.url) ? (
              <img
                src={invoice.url}
                alt="Invoice"
                className="max-h-48 object-contain rounded-lg border border-stroke"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 rounded-lg border border-stroke bg-card-bg">
                <LuFileText size={32} className="text-secondary" />
                <a
                  href={invoice.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {t('openUrl')}
                </a>
              </div>
            )}
          </div>

          {/* Order info */}
          <div className="text-sm text-secondary space-y-1">
            <p>
              <span className="font-medium text-foreground">{t('colOrderNumber')}:</span>{' '}
              {invoice.orderNumber}
            </p>
            <p>
              <span className="font-medium text-foreground">{t('colCustomer')}:</span>{' '}
              {invoice.customerName || '-'}
            </p>
          </div>

          {/* Value input with currency selector */}
          <div className="flex flex-row gap-2 items-start">
            <div className="flex-1 min-w-0">
              <Input
                label={t('colValue')}
                type="number"
                min={0}
                step="0.01"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="shrink-0 w-24 pt-px">
              <Dropdown
                value={editCurrency}
                options={CURRENCY_OPTIONS}
                onChange={(val) => setEditCurrency(val)}
              />
            </div>
          </div>

          {/* Actions */}
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
        </div>
      )}
    </Modal>
  );
}
