'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuTrash2, LuRefreshCw } from 'react-icons/lu';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (invoice: InvoiceRow) => void;
  loading: boolean;
}

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

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleConfirm = () => {
    if (!invoice) return;
    onConfirm(invoice);
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
            disabled={loading}
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
      </div>
    </Modal>
  );
}
