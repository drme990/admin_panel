'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LuCopy, LuPhone } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';
import { toast } from 'react-toastify';

import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import type { Referral } from '@/types/Referral';
import { normalizeWhatsappPhone } from '../../../../lib/order/order-utils';
import { copyToClipboard } from '../lib/invoice-utils';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow | null;
  reason: string;
  referrals: Referral[];
  isOpen: boolean;
  onClose: () => void;
}

export default function InvoiceRejectionFollowupModal({
  invoice,
  reason,
  referrals,
  isOpen,
  onClose,
}: Props) {
  const t = useTranslations('admin.invoices');

  const referral = useMemo(() => {
    if (!invoice?.referralId) return null;
    return referrals.find((r) => r.referralId === invoice.referralId) || null;
  }, [invoice, referrals]);

  const message = useMemo(() => {
    if (!invoice) return '';
    const refName = referral?.name || invoice.referralId || '';
    const refId = invoice.referralId || '';
    const customerName = invoice.customerName || '';
    const orderNumber = invoice.orderNumber || '';
    const rejectionReason = reason || '';

    return `مرحبا ${refName} (${refId}) لقد تم رفض إيصال عميلك ( ${customerName} ) صاحب الطلب رقم ${orderNumber} بسبب ${rejectionReason} برجاء عمل اللازم مع الشكر.`;
  }, [invoice, referral, reason]);

  const phone = useMemo(() => {
    const rawPhone = referral?.phone || '';
    return normalizeWhatsappPhone(rawPhone, false);
  }, [referral]);

  const phoneWithPlus = useMemo(() => {
    const rawPhone = referral?.phone || '';
    return normalizeWhatsappPhone(rawPhone, true);
  }, [referral]);

  const handleCopyMessage = async () => {
    if (!message) return;
    try {
      await copyToClipboard(message);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const handleCopyPhone = async () => {
    if (!phoneWithPlus) {
      toast.error(t('refPhoneMissing'));
      return;
    }
    try {
      await copyToClipboard(phoneWithPlus);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const handleWhatsapp = () => {
    if (!phone) {
      toast.error(t('refPhoneMissing'));
      return;
    }
    if (!message) {
      toast.error(t('refMessageMissing'));
      return;
    }
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const popup = window.open(url, '_blank', 'noopener,noreferrer');
    if (!popup) {
      toast.error(t('whatsappOpenFailed'));
      return;
    }
    toast.success(t('whatsappOpened'));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('rejectionFollowupTitle')}
      size="md"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-stroke bg-background p-4 text-sm leading-relaxed text-foreground">
          {message || t('rejectionFollowupNoMessage')}
        </div>

        <div className="grid grid-cols-1 gap-2">
          <Button variant="outline" onClick={handleCopyMessage} className="w-full gap-2">
            <LuCopy size={18} />
            {t('copyMessage')}
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyPhone}
            className="w-full gap-2"
            disabled={!phoneWithPlus}
          >
            <LuPhone size={18} />
            {t('copyRefPhone')}
          </Button>
          <Button
            variant="primary"
            onClick={handleWhatsapp}
            className="w-full gap-2"
            disabled={!phone || !message}
          >
            <FaWhatsapp size={18} />
            {t('whatsapp')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
