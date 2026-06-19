'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import MultiCurrencyPriceEditor, {
  CurrencyPrice,
} from '@/components/admin/multi-currency-price-editor';
import { toast } from 'react-toastify';

export interface UserTier {
  _id: string;
  name: string;
  color: string;
  mainCurrency: string;
  baseAmount: number;
  minimumAmounts: CurrencyPrice[];
}

interface TierFormData {
  name: string;
  color: string;
  mainCurrency: string;
  baseAmount: number;
  minimumAmounts: CurrencyPrice[];
}

interface TierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingTier: UserTier | null;
}

const EMPTY_FORM: TierFormData = {
  name: '',
  color: '#6366f1',
  mainCurrency: 'USD',
  baseAmount: 0,
  minimumAmounts: [],
};

export default function TierFormModal({
  isOpen,
  onClose,
  onSaved,
  editingTier,
}: TierFormModalProps) {
  const t = useTranslations('admin.crm');
  const [form, setForm] = useState<TierFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editingTier) {
        setForm({
          name: editingTier.name,
          color: editingTier.color || '#6366f1',
          mainCurrency: editingTier.mainCurrency,
          baseAmount: editingTier.baseAmount,
          minimumAmounts: editingTier.minimumAmounts,
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, editingTier]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('tiers.validation.nameRequired'));
      return;
    }
    if (form.minimumAmounts.length === 0) {
      toast.error(t('tiers.validation.amountsRequired'));
      return;
    }

    setSaving(true);
    try {
      const url = editingTier
        ? `/api/crm/tiers/${editingTier._id}`
        : '/api/crm/tiers';
      const method = editingTier ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || t('tiers.messages.saveFailed'));
        return;
      }

      toast.success(
        editingTier
          ? t('tiers.messages.updateSuccess')
          : t('tiers.messages.createSuccess'),
      );
      onSaved();
      onClose();
    } catch {
      toast.error(t('tiers.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingTier ? t('tiers.editTitle') : t('tiers.addTitle')}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('tiers.buttons.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('tiers.buttons.saving') : t('tiers.buttons.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('tiers.form.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t('tiers.form.namePlaceholder')}
            required
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('tiers.form.color')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-10 h-10 p-0 border-0 rounded-lg cursor-pointer"
              />
              <span className="text-xs text-secondary font-mono">{form.color}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            {t('tiers.form.minimumSpending')}
          </p>
          <p className="text-xs text-secondary">
            {t('tiers.form.minimumSpendingHelp')}
          </p>
          <MultiCurrencyPriceEditor
            mainCurrency={form.mainCurrency}
            basePrice={form.baseAmount}
            prices={form.minimumAmounts}
            onChange={(prices) => setForm({ ...form, minimumAmounts: prices })}
            onMainCurrencyChange={(currency) =>
              setForm({ ...form, mainCurrency: currency })
            }
            onBasePriceChange={(price) =>
              setForm({ ...form, baseAmount: price })
            }
          />
        </div>
      </div>
    </Modal>
  );
}
