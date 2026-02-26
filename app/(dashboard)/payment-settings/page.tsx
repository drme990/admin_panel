'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Button from '@/components/ui/button';
import PageTitle from '@/components/shared/page-title';
import { Loader2 } from 'lucide-react';

type ProjectName = 'ghadaq' | 'manasik';
type PaymentMethod = 'paymob' | 'easykash';

const PROJECTS: { key: ProjectName; label: string }[] = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
];

export default function PaymentSettingsPage() {
  const [settings, setSettings] = useState<Record<ProjectName, PaymentMethod>>({
    ghadaq: 'paymob',
    manasik: 'paymob',
  });
  const [activeProject, setActiveProject] = useState<ProjectName>('ghadaq');
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
      if (data.success && Array.isArray(data.data)) {
        const newSettings: Record<ProjectName, PaymentMethod> = {
          ghadaq: 'paymob',
          manasik: 'paymob',
        };
        data.data.forEach(
          (item: { project: ProjectName; paymentMethod: PaymentMethod }) => {
            newSettings[item.project] = item.paymentMethod;
          },
        );
        setSettings(newSettings);
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
        body: JSON.stringify({
          project: activeProject,
          paymentMethod: settings[activeProject],
        }),
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

      {/* Project Tabs */}
      <div className="flex gap-2 border-b border-stroke">
        {PROJECTS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveProject(p.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeProject === p.key
                ? 'border-current font-bold'
                : 'border-transparent text-secondary hover:text-foreground'
            }`}
            style={
              activeProject === p.key
                ? {
                    background: 'var(--gradient-site)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }
                : undefined
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-card-bg border border-stroke rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-1">{t('selectMethod')}</h2>
          <p className="text-secondary text-sm">{t('description')}</p>
        </div>

        <div className="space-y-3">
          <label
            className={`flex items-center gap-4 border rounded-lg p-4 cursor-pointer transition-colors ${
              settings[activeProject] === 'paymob'
                ? 'border-primary bg-primary/5'
                : 'border-stroke hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="paymob"
              checked={settings[activeProject] === 'paymob'}
              onChange={() =>
                setSettings((prev) => ({ ...prev, [activeProject]: 'paymob' }))
              }
              className="accent-primary w-4 h-4"
            />
            <div>
              <div className="font-semibold">{t('paymob')}</div>
              <div className="text-sm text-secondary">{t('paymobDesc')}</div>
            </div>
          </label>

          <label
            className={`flex items-center gap-4 border rounded-lg p-4 cursor-pointer transition-colors ${
              settings[activeProject] === 'easykash'
                ? 'border-primary bg-primary/5'
                : 'border-stroke hover:border-primary/50'
            }`}
          >
            <input
              type="radio"
              name="paymentMethod"
              value="easykash"
              checked={settings[activeProject] === 'easykash'}
              onChange={() =>
                setSettings((prev) => ({
                  ...prev,
                  [activeProject]: 'easykash',
                }))
              }
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
