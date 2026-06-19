'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import { Account, AccountType, ACCOUNT_TYPES } from '@/types/Account';

interface AccountFormData {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: string;
  notes: string;
  isActive: boolean;
}

const DEFAULT_FORM: AccountFormData = {
  name: '',
  type: 'bank_account',
  currency: '',
  openingBalance: '0',
  notes: '',
  isActive: true,
};

interface AccountFormModalProps {
  isOpen: boolean;
  account: Account | null;
  onClose: () => void;
  onSubmit: (data: AccountFormData) => Promise<void>;
  isSubmitting: boolean;
}

export default function AccountFormModal({
  isOpen,
  account,
  onClose,
  onSubmit,
  isSubmitting,
}: AccountFormModalProps) {
  const t = useTranslations('admin.accounts');
  const [formData, setFormData] = useState<AccountFormData>(DEFAULT_FORM);

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name,
        type: account.type,
        currency: account.currency,
        openingBalance: String(account.openingBalance),
        notes: account.notes ?? '',
        isActive: account.isActive,
      });
    } else {
      setFormData(DEFAULT_FORM);
    }
  }, [account, isOpen]);

  const typeOptions = ACCOUNT_TYPES.map((type) => ({
    value: type,
    label: t(`types.${type}`),
  }));

  const isAddMode = !account;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isAddMode ? t('addAccount') : t('editAccount')}
      size="md"
      footer={
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSubmitting}
          >
            {t('buttons.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            form="account-form"
            className="flex-1"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('buttons.saving')
              : isAddMode
                ? t('buttons.addAccount')
                : t('buttons.updateAccount')}
          </Button>
        </div>
      }
    >
      <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('form.name')}
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder={t('form.namePlaceholder')}
        />

        <Dropdown
          label={t('form.type')}
          value={formData.type}
          options={typeOptions}
          onChange={(value) =>
            setFormData({ ...formData, type: value as AccountType })
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('form.currency')}
            type="text"
            required
            value={formData.currency}
            onChange={(e) =>
              setFormData({
                ...formData,
                currency: e.target.value.toUpperCase(),
              })
            }
            placeholder="SAR"
            maxLength={10}
          />

          <Input
            label={t('form.openingBalance')}
            type="number"
            step="0.01"
            required
            value={formData.openingBalance}
            onChange={(e) =>
              setFormData({ ...formData, openingBalance: e.target.value })
            }
            placeholder="0.00"
          />
        </div>

        <Input
          label={t('form.notes')}
          type="text"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder={t('form.notesPlaceholder')}
        />

        <Checkbox
          checked={formData.isActive}
          onChange={(checked) =>
            setFormData({ ...formData, isActive: checked })
          }
          label={t('form.isActive')}
        />
      </form>
    </Modal>
  );
}
