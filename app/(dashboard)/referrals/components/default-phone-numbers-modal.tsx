'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';

interface DefaultPhones {
  manasik: string;
  ghadaq: string;
}

export default function DefaultPhoneNumbersModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('admin.referrals.defaultPhones');
  const [phones, setPhones] = useState<DefaultPhones>({
    manasik: '',
    ghadaq: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPhones = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/default-phones');
      const data = await response.json();
      if (data.success) {
        setPhones(data.data);
      } else {
        toast.error(t('loadFailed'));
      }
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) fetchPhones();
  }, [isOpen, fetchPhones]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch('/api/settings/default-phones', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(phones),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t('saveSuccess'));
        onClose();
      } else {
        toast.error(data.error || t('saveFailed'));
      }
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title')}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" form="default-phones-form" disabled={saving || loading}>
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-sm text-secondary">{t('description')}</p>
      <form id="default-phones-form" onSubmit={handleSave} className="space-y-4">
        <Input
          label={t('manasik')}
          type="tel"
          value={phones.manasik}
          onChange={(e) =>
            setPhones((prev) => ({ ...prev, manasik: e.target.value }))
          }
          placeholder={t('manasikPlaceholder')}
          disabled={loading || saving}
          dir="ltr"
          required
        />
        <Input
          label={t('ghadaq')}
          type="tel"
          value={phones.ghadaq}
          onChange={(e) =>
            setPhones((prev) => ({ ...prev, ghadaq: e.target.value }))
          }
          placeholder={t('ghadaqPlaceholder')}
          disabled={loading || saving}
          dir="ltr"
          required
        />
      </form>
    </Modal>
  );
}
