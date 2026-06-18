'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { SupplierOrder } from '@/types/Supplier';
import { toast } from 'react-toastify';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

interface OrderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  order: SupplierOrder | null;
  onSuccess: () => void;
}

export default function OrderFormModal({ isOpen, onClose, supplierId, order, onSuccess }: OrderFormModalProps) {
  const t = useTranslations('admin.suppliers');
  const [items, setItems] = useState([{ name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const [orderDate, setOrderDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'received' | 'cancelled'>('pending');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setItems(order.items.map((i) => ({ ...i })));
      setOrderDate(order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '');
      setNotes(order.notes || '');
      setStatus(order.status);
    } else {
      setItems([{ name: '', quantity: 1, unitPrice: 0, total: 0 }]);
      setOrderDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setStatus('pending');
    }
  }, [order, isOpen]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const next = items.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        updated.total = updated.quantity * updated.unitPrice;
      }
      return updated;
    });
    setItems(next);
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (items.some((i) => !i.name.trim())) {
      toast.error(t('common.itemNameRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        items: items.map((i) => ({
          name: i.name.trim(),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
        orderDate: orderDate ? new Date(orderDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        status,
      };

      const url = order
        ? `/api/suppliers/${supplierId}/orders/${order._id}`
        : `/api/suppliers/${supplierId}/orders`;
      const method = order ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t('common.failedSave'));
        return;
      }
      toast.success(order ? t('messages.orderUpdateSuccess') : t('messages.orderCreateSuccess'));
      onSuccess();
      onClose();
    } catch {
      toast.error(t('common.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const total = items.reduce((sum, i) => sum + i.total, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? t('orders.editOrder') : t('orders.addOrder')}
      size="lg"
      footer={
        <div className="flex justify-between items-center w-full">
          <span className="font-bold text-foreground">{t('common.total')}: {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? t('common.saving') : order ? t('common.update') : t('common.create')}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-2 items-end bg-background border border-stroke rounded-lg p-3">
            <div className="col-span-5">
              <Input label={index === 0 ? t('orders.itemName') : ''} value={item.name}
                onChange={(e) => updateItem(index, 'name', e.target.value)} placeholder={t('orders.itemName')} />
            </div>
            <div className="col-span-2">
              <Input label={index === 0 ? t('orders.quantity') : ''} value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))} type="number" min={1} />
            </div>
            <div className="col-span-2">
              <Input label={index === 0 ? t('orders.unitPrice') : ''} value={item.unitPrice}
                onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))} type="number" min={0} />
            </div>
            <div className="col-span-2">
              <Input label={index === 0 ? t('orders.total') : ''} value={item.total} readOnly />
            </div>
            <div className="col-span-1">
              <Button variant="ghost" size="sm" onClick={() => removeItem(index)} disabled={items.length === 1} className="p-1.5 text-error">
                <LuTrash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="flex items-center gap-1">
          <LuPlus size={14} />{t('orders.addItem')}
        </Button>

        <div className="grid grid-cols-2 gap-4">
          <Input label={t('orders.orderDate')} value={orderDate} onChange={(e) => setOrderDate(e.target.value)} type="date" />
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">{t('orders.statusLabel')}</label>
            <select className="w-full px-3 py-2 border border-stroke rounded-lg bg-background text-foreground"
              value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'received' | 'cancelled')}>
              <option value="pending">{t('orders.status.pending')}</option>
              <option value="received">{t('orders.status.received')}</option>
              <option value="cancelled">{t('orders.status.cancelled')}</option>
            </select>
          </div>
        </div>
        <Input label={t('orders.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Modal>
  );
}
