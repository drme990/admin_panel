'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Table from '@/components/ui/table';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { Supplier, SupplierOrder } from '@/types/Supplier';
import { Transaction } from '@/types/Transaction';
import { toast } from 'react-toastify';
import {
  LuPencil, LuTrash2, LuPlus, LuPackage, LuWallet, LuUser, LuCalendar,
} from 'react-icons/lu';
import OrderFormModal from './supplier-order-form-modal';
import TransactionFormModal from './supplier-transaction-form-modal';

type TabKey = 'info' | 'orders' | 'payouts';

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSupplierUpdated: () => void;
}

export default function SupplierDetailModal({
  isOpen, onClose, supplier, onSupplierUpdated,
}: SupplierDetailModalProps) {
  const t = useTranslations('admin.suppliers');
  const { confirm, modalProps } = useConfirmModal();
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');
  const [savingInfo, setSavingInfo] = useState(false);

  const [orderFormOpen, setOrderFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SupplierOrder | null>(null);
  const [transactionFormOpen, setTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!supplier) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/orders`);
      const data = await res.json();
      if (data.success) setOrders(data.data.orders || []);
    } catch { toast.error('Failed to load orders'); }
    finally { setLoadingOrders(false); }
  }, [supplier]);

  const fetchTransactions = useCallback(async () => {
    if (!supplier) return;
    setLoadingTransactions(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/payouts`);
      const data = await res.json();
      if (data.success) setTransactions(data.data.transactions || []);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoadingTransactions(false); }
  }, [supplier]);

  useEffect(() => {
    if (isOpen && supplier) {
      setActiveTab('info');
      setIsEditingInfo(false);
      setEditName(supplier.name || '');
      setEditPhone(supplier.phone || '');
      setEditEmail(supplier.email || '');
      setEditAddress(supplier.address || '');
      setEditNotes(supplier.notes || '');
      setEditStatus(supplier.status || 'active');
    }
  }, [isOpen, supplier]);

  useEffect(() => { if (activeTab === 'orders' && supplier) fetchOrders(); }, [activeTab, supplier, fetchOrders]);
  useEffect(() => { if (activeTab === 'payouts' && supplier) fetchTransactions(); }, [activeTab, supplier, fetchTransactions]);

  const handleSaveInfo = async () => {
    if (!supplier) return;
    setSavingInfo(true);
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(), phone: editPhone.trim() || undefined,
          email: editEmail.trim() || undefined, address: editAddress.trim() || undefined,
          notes: editNotes.trim() || undefined, status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || t('common.failedUpdate')); return; }
      toast.success(t('messages.updateSuccess'));
      setIsEditingInfo(false);
      onSupplierUpdated();
    } catch { toast.error(t('common.failedUpdate')); }
    finally { setSavingInfo(false); }
  };

  const handleDeleteOrder = async (order: SupplierOrder) => {
    if (!supplier) return;
    const confirmed = await confirm({ title: t('orders.deleteOrder'), message: t('messages.orderDeleteConfirm') });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/orders/${order._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || t('common.failedDelete')); return; }
      toast.success(t('messages.orderDeleteSuccess'));
      fetchOrders(); onSupplierUpdated();
    } catch { toast.error(t('common.failedDelete')); }
  };

  const handleDeleteTransaction = async (tx: Transaction) => {
    if (!supplier) return;
    const confirmed = await confirm({ title: t('payouts.deletePayout'), message: t('messages.payoutDeleteConfirm') });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}/payouts/${tx._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) { toast.error(data.error || t('common.failedDelete')); return; }
      toast.success(t('messages.payoutDeleteSuccess'));
      fetchTransactions(); onSupplierUpdated();
    } catch { toast.error(t('common.failedDelete')); }
  };

  const tabs = [
    { key: 'info' as TabKey, label: t('tabs.info'), icon: <LuUser size={16} /> },
    { key: 'orders' as TabKey, label: t('tabs.orders'), icon: <LuPackage size={16} /> },
    { key: 'payouts' as TabKey, label: t('tabs.payouts'), icon: <LuWallet size={16} /> },
  ];

  if (!supplier) return null;

  const balance = (supplier.balance || 0);
  const totalOrdersAmount = (supplier.totalOrders || 0);
  const totalPayoutsAmount = (supplier.totalPayouts || 0);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`${t('supplierDetails')} - ${supplier.name}`} size="xl">
        <div className="space-y-4">
          <div className="flex border-b border-stroke">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-success text-success' : 'border-transparent text-secondary hover:text-foreground'
                  }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                {!isEditingInfo ? (
                  <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(true)} className="flex items-center gap-1">
                    <LuPencil size={14} />{t('editSupplier')}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingInfo(false)}>{t('common.cancel')}</Button>
                    <Button size="sm" onClick={handleSaveInfo} disabled={savingInfo}>{savingInfo ? t('common.saving') : t('common.save')}</Button>
                  </div>
                )}
              </div>
              {!isEditingInfo ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoRow label={t('fields.name')} value={supplier.name} />
                  <InfoRow label={t('fields.phone')} value={supplier.phone || '-'} />
                  <InfoRow label={t('fields.email')} value={supplier.email || '-'} />
                  <InfoRow label={t('fields.status')} value={supplier.status === 'active' ? t('status.active') : t('status.inactive')} />
                  <InfoRow label={t('fields.balance')} value={balance.toLocaleString()} />
                  <InfoRow label={t('fields.totalOrders')} value={totalOrdersAmount.toLocaleString()} />
                  <InfoRow label={t('fields.totalPayouts')} value={totalPayoutsAmount.toLocaleString()} />
                  <InfoRow label={t('fields.address')} value={supplier.address || '-'} />
                  <InfoRow label={t('fields.notes')} value={supplier.notes || '-'} className="sm:col-span-2" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label={t('fields.name')} value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  <Input label={t('fields.phone')} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  <Input label={t('fields.email')} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
                  <Input label={t('fields.address')} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />
                  <Input label={t('fields.notes')} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">{t('fields.status')}</label>
                    <select className="w-full px-3 py-2 border border-stroke rounded-lg bg-background text-foreground" value={editStatus} onChange={(e) => setEditStatus(e.target.value as 'active' | 'inactive')}>
                      <option value="active">{t('status.active')}</option>
                      <option value="inactive">{t('status.inactive')}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-foreground">{t('orders.title')}</h3>
                <Button size="sm" onClick={() => { setEditingOrder(null); setOrderFormOpen(true); }} className="flex items-center gap-1">
                  <LuPlus size={14} />{t('orders.addOrder')}
                </Button>
              </div>
              <Table
                columns={[
                  {
                    header: t('orders.itemName'), accessor: (row: SupplierOrder) => (
                      <div className="space-y-1">{row.items.map((item, i) => (
                        <div key={i} className="text-sm">{item.name} x{item.quantity}</div>
                      ))}</div>
                    )
                  },
                  { header: t('orders.total'), accessor: (row: SupplierOrder) => <span className="font-mono">{row.totalAmount.toLocaleString()}</span> },
                  {
                    header: t('orders.statusLabel'), accessor: (row: SupplierOrder) => {
                      const map = { pending: t('orders.status.pending'), received: t('orders.status.received'), cancelled: t('orders.status.cancelled') };
                      return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.status === 'received' ? 'bg-success/10 text-success' : row.status === 'cancelled' ? 'bg-error/10 text-error' : 'bg-warning/10 text-warning'
                        }`}>{map[row.status] || row.status}</span>;
                    }
                  },
                  {
                    header: t('orders.orderDate'), accessor: (row: SupplierOrder) => (
                      <span className="text-sm text-secondary flex items-center gap-1"><LuCalendar size={12} />{new Date(row.orderDate).toLocaleDateString()}</span>
                    )
                  },
                  {
                    header: t('actions'), accessor: (row: SupplierOrder) => (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingOrder(row); setOrderFormOpen(true); }} className="p-1.5" title={t('orders.editOrder')}><LuPencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteOrder(row)} className="p-1.5 text-error hover:text-error" title={t('orders.deleteOrder')}><LuTrash2 size={14} /></Button>
                      </div>
                    ), className: 'w-24'
                  },
                ]}
                data={orders} loading={loadingOrders} emptyMessage={t('orders.noOrders')}
              />
            </div>
          )}

          {activeTab === 'payouts' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 bg-background border border-stroke rounded-site p-4">
                <div><p className="text-xs text-secondary uppercase">{t('fields.totalOrders')}</p><p className="text-lg font-bold text-foreground">{totalOrdersAmount.toLocaleString()}</p></div>
                <div><p className="text-xs text-secondary uppercase">{t('fields.totalPayouts')}</p><p className="text-lg font-bold text-foreground">{totalPayoutsAmount.toLocaleString()}</p></div>
                <div><p className="text-xs text-secondary uppercase">{t('fields.balance')}</p><p className={`text-lg font-bold ${balance > 0 ? 'text-success' : balance < 0 ? 'text-error' : 'text-success'}`}>{balance.toLocaleString()}</p></div>
              </div>
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-foreground">{t('payouts.title')}</h3>
                <Button size="sm" onClick={() => { setEditingTransaction(null); setTransactionFormOpen(true); }} className="flex items-center gap-1">
                  <LuPlus size={14} />{t('payouts.addPayout')}
                </Button>
              </div>
              <Table
                columns={[
                  { header: t('payouts.amount'), accessor: (row: Transaction) => <span className="font-mono font-medium">{row.amount.toLocaleString()}</span> },
                  {
                    header: t('payouts.account'), accessor: (row: Transaction) => {
                      if (row.account) {
                        return (
                          <span className="text-sm text-foreground">
                            {row.account.name} ({row.account.currency})
                          </span>
                        );
                      }
                      return <span className="text-sm text-secondary">—</span>;
                    }
                  },
                  {
                    header: t('payouts.date'), accessor: (row: Transaction) => (
                      <span className="text-sm text-secondary flex items-center gap-1"><LuCalendar size={12} />{new Date(row.date).toLocaleDateString()}</span>
                    )
                  },
                  { header: t('payouts.notes'), accessor: (row: Transaction) => row.notes || '-', className: 'max-w-[200px] truncate' },
                  {
                    header: t('actions'), accessor: (row: Transaction) => (
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => { setEditingTransaction(row); setTransactionFormOpen(true); }} className="p-1.5" title={t('payouts.editPayout')}><LuPencil size={14} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTransaction(row)} className="p-1.5 text-error hover:text-error" title={t('payouts.deletePayout')}><LuTrash2 size={14} /></Button>
                      </div>
                    ), className: 'w-24'
                  },
                ]}
                data={transactions} loading={loadingTransactions} emptyMessage={t('payouts.noPayouts')}
              />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal {...modalProps} />

      {orderFormOpen && (
        <OrderFormModal isOpen={orderFormOpen} onClose={() => { setOrderFormOpen(false); setEditingOrder(null); }}
          supplierId={supplier._id} order={editingOrder} onSuccess={() => { fetchOrders(); onSupplierUpdated(); }} />
      )}
      {transactionFormOpen && (
        <TransactionFormModal isOpen={transactionFormOpen} onClose={() => { setTransactionFormOpen(false); setEditingTransaction(null); }}
          supplierId={supplier._id} transaction={editingTransaction} onSuccess={() => { fetchTransactions(); onSupplierUpdated(); }} />
      )}
    </>
  );
}

function InfoRow({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-background border border-stroke rounded-lg p-3 ${className}`}>
      <p className="text-xs text-secondary uppercase mb-1">{label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}
