'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Table from '@/components/ui/table';
import { LuCalendar } from 'react-icons/lu';

interface SupplierPayoutTransaction {
  _id: string;
  amount: number;
  date: string;
  notes?: string;
  supplier?: { _id: string; name: string };
  createdAt: string;
}

interface AccountTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
  accountName: string;
}

export default function AccountTransactionsModal({
  isOpen,
  onClose,
  accountId,
  accountName,
}: AccountTransactionsModalProps) {
  const t = useTranslations('admin.accounts');
  const [payouts, setPayouts] = useState<SupplierPayoutTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchPayouts = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/payouts?limit=200`);
      const data = await res.json();
      if (data.success) {
        setPayouts(data.data.payouts);
        setTotalCount(data.data.pagination.total);
      } else {
        console.error(data.error);
      }
    } catch {
      console.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (isOpen && accountId) fetchPayouts();
  }, [isOpen, accountId, fetchPayouts]);

  const totalAmount = payouts.reduce((sum, p) => sum + p.amount, 0);

  const columns = [
    {
      header: t('transactions.supplier'),
      accessor: (row: SupplierPayoutTransaction) => (
        <span className="text-sm font-medium text-foreground">
          {row.supplier?.name || '—'}
        </span>
      ),
    },
    {
      header: t('transactions.amount'),
      accessor: (row: SupplierPayoutTransaction) => (
        <span className="font-mono font-semibold text-sm text-foreground">
          {row.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      ),
    },
    {
      header: t('transactions.date'),
      accessor: (row: SupplierPayoutTransaction) => (
        <span className="text-sm text-secondary flex items-center gap-1">
          <LuCalendar size={12} />
          {new Date(row.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: t('transactions.notes'),
      accessor: (row: SupplierPayoutTransaction) => (
        <span className="text-sm text-secondary truncate max-w-[200px]">
          {row.notes || '—'}
        </span>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('transactions.title')} — ${accountName}`}
      size="xl"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="border border-stroke rounded-lg px-4 py-3 bg-card-bg flex-1">
            <p className="text-xs uppercase text-secondary mb-1">
              {t('transactions.totalTransactions')}
            </p>
            <p className="text-xl font-bold text-foreground">{totalCount}</p>
          </div>
          <div className="border border-stroke rounded-lg px-4 py-3 bg-card-bg flex-1">
            <p className="text-xs uppercase text-secondary mb-1">
              {t('transactions.totalAmount')}
            </p>
            <p className="text-xl font-bold text-foreground">
              {totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <Table<SupplierPayoutTransaction>
          columns={columns}
          data={payouts}
          loading={loading}
          emptyMessage={t('transactions.emptyMessage')}
        />

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('buttons.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
