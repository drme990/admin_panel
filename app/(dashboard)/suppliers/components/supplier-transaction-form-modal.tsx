'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { Transaction } from '@/types/Transaction';
import { Account } from '@/types/Account';
import { toast } from 'react-toastify';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  transaction: Transaction | null;
  onSuccess: () => void;
}

export default function TransactionFormModal({ isOpen, onClose, supplierId, transaction, onSuccess }: TransactionFormModalProps) {
  const t = useTranslations('admin.suppliers');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (transaction) {
      setAmount(String(transaction.amount));
      setAccountId(transaction.accountId || '');
      setDate(transaction.date ? new Date(transaction.date).toISOString().split('T')[0] : '');
      setPaymentMethod(transaction.paymentMethod || '');
      setReferenceNumber(transaction.referenceNumber || '');
      setNotes(transaction.notes || '');
      setAttachment(transaction.attachment || '');
    } else {
      setAmount('');
      setAccountId('');
      setDate(new Date().toISOString().split('T')[0]);
      setPaymentMethod('');
      setReferenceNumber('');
      setNotes('');
      setAttachment('');
    }
  }, [transaction, isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/invoice', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data?.url) {
        setAttachment(data.data.url);
        toast.success('File uploaded successfully');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error(t('common.amountRequired'));
      return;
    }
    if (!accountId) {
      toast.error(t('payouts.selectAccount'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        amount: Number(amount),
        accountId,
        date: date ? new Date(date).toISOString() : undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        attachment: attachment || undefined,
      };

      const url = transaction
        ? `/api/suppliers/${supplierId}/payouts/${transaction._id}`
        : `/api/suppliers/${supplierId}/payouts`;
      const methodName = transaction ? 'PUT' : 'POST';

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
      toast.success(transaction ? t('messages.payoutUpdateSuccess') : t('messages.payoutCreateSuccess'));
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
      title={transaction ? t('payouts.editPayout') : t('payouts.addPayout')}
      size="md"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? t('common.saving') : transaction ? t('common.update') : t('common.create')}</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label={t('payouts.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min={0} required />
        <Dropdown
          label={t('payouts.account')}
          required
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
        <Input label={t('payouts.paymentMethod') || 'Payment Method'} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="e.g. Bank Transfer, Cash" />
        <Input label={t('payouts.referenceNumber') || 'Reference Number'} value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="Invoice / Receipt #" />
        <Input label={t('payouts.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">Attachment (Invoice / Receipt)</label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile}
            >
              {uploadingFile ? 'Uploading...' : 'Choose File'}
            </Button>
            {uploadingFile && <span className="text-sm text-secondary">Uploading...</span>}
          </div>
          {attachment && (
            <div className="mt-2 flex items-center gap-2">
              <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-sm text-success underline">View attachment</a>
              <Button type="button" variant="custom" size="custom" onClick={() => setAttachment('')} className="text-xs text-error hover:underline">
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
