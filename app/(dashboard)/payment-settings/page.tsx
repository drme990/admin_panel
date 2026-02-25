'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Button from '@/components/ui/button';
import PageTitle from '@/components/shared/page-title';
import { Loader2 } from 'lucide-react';

export default function PaymentSettingsPage() {
  const [paymentMethod, setPaymentMethod] = useState<'paymob' | 'easykash'>(
    'paymob',
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const t = useTranslations('admin.paymentSettings');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/payment-settings');
      const data = await res.json();
      if (data.success) {
        setPaymentMethod(data.data.paymentMethod);
      }
    } catch (error) {
      console.error('Failed to fetch payment settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('settingsSaved'));
      } else {
        toast.error(data.error || 'Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle>{t('title')}</PageTitle>

      <div className="bg-card-bg border border-stroke rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-1">{t('selectMethod')}</h2>
          <p className="text-secondary text-sm">{t('description')}</p>
        </div>

        <div className="space-y-3">
          <label
            className={`flex items-center gap-4 border rounded-lg p-4 cursor-pointer transition-colors ${
              paymentMethod === 'paymob'
                ? 'border-primary bg-primary/5'
                : 'border-stroke hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="paymob"
              checked={paymentMethod === 'paymob'}
              onChange={() => setPaymentMethod('paymob')}
              className="accent-primary w-4 h-4"
            />
            <div>
              <div className="font-semibold">{t('paymob')}</div>
              <div className="text-sm text-secondary">{t('paymobDesc')}</div>
            </div>
          </label>

          <label
            className={`flex items-center gap-4 border rounded-lg p-4 cursor-pointer transition-colors ${
              paymentMethod === 'easykash'
                ? 'border-primary bg-primary/5'
                : 'border-stroke hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="easykash"
              checked={paymentMethod === 'easykash'}
              onChange={() => setPaymentMethod('easykash')}
              className="accent-primary w-4 h-4"
            />
            <div>
              <div className="font-semibold">{t('easykash')}</div>
              <div className="text-sm text-secondary">{t('easykashDesc')}</div>
            </div>
          </label>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" size={16} />
              {t('saveSettings')}
            </span>
          ) : (
            t('saveSettings')
          )}
        </Button>
      </div>
    </div>
  );
}
