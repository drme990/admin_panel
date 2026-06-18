'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { SupplierPayout } from '@/types/Supplier';
import { Account } from '@/types/Account';
import { toast } from 'react-toastify';

interface PayoutFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  payout: SupplierPayout | null;
  onSuccess: () => void;
}

export default function PayoutFormModal({ isOpen, onClose, supplierId, payout, onSuccess }: PayoutFormModalProps) {
  const t = useTranslations('admin.suppliers');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch('/api/accounts?isActive=true&limit=200');
      const data = await res.json();
      if (data.success) setAccounts(data.data.accounts);
    } catch {
      console.error('Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) fetchAccounts();
  }, [isOpen, fetchAccounts]);

  useEffect(() => {
    if (payout) {
      setAmount(String(payout.amount));
      setAccountId(payout.accountId || '');
      setDate(payout.date ? new Date(payout.date).toISOString().split('T')[0] : '');
      setNotes(payout.notes || '');
    } else {
      setAmount('');
      setAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [payout, isOpen]);

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error(t('common.amountRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        amount: Number(amount),
        accountId: accountId || undefined,
        date: date ? new Date(date).toISOString() : undefined,
        notes: notes.trim() || undefined,
      };

      const url = payout
        ? `/api/suppliers/${supplierId}/payouts/${payout._id}`
        : `/api/suppliers/${supplierId}/payouts`;
      const methodName = payout ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: methodName,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t('common.failedSave'));
        return;
      }
      toast.success(payout ? t('messages.payoutUpdateSuccess') : t('messages.payoutCreateSuccess'));
      onSuccess();
      onClose();
    } catch {
      toast.error(t('common.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={payout ? t('payouts.editPayout') : t('payouts.addPayout')}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? t('common.saving') : payout ? t('common.update') : t('common.create')}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label={t('payouts.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} required />
        <Dropdown
          label={t('payouts.account')}
          value={accountId}
          placeholder={loadingAccounts ? t('common.loading') : t('payouts.selectAccount')}
          disabled={loadingAccounts || accounts.length === 0}
          options={[
            { value: '', label: t('payouts.selectAccount') },
            ...accounts.map((acc) => ({
              value: acc._id,
              label: `${acc.name} — ${acc.currency}`,
            })),
          ]}
          onChange={(value) => setAccountId(value as string)}
        />
        <Input label={t('payouts.date')} value={date} onChange={(e) => setDate(e.target.value)} type="date" />
        <Input label={t('payouts.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
