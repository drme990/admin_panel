'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Dropdown from '@/components/ui/dropdown';
import { Supplier } from '@/types/Supplier';
import { toast } from 'react-toastify';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  onSuccess: () => void;
}

export default function SupplierFormModal({
  isOpen,
  onClose,
  supplier,
  onSuccess,
}: SupplierFormModalProps) {
  const t = useTranslations('admin.suppliers');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (supplier) {
      setName(supplier.name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setNotes(supplier.notes || '');
      setStatus(supplier.status || 'active');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
      setStatus('active');
    }
    setErrors({});
  }, [supplier, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t('common.requiredField');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        status,
      };

      const url = supplier ? `/api/suppliers/${supplier._id}` : '/api/suppliers';
      const method = supplier ? 'PUT' : 'POST';

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

      toast.success(supplier ? t('messages.updateSuccess') : t('messages.createSuccess'));
      onSuccess();
      onClose();
    } catch {
      toast.error(t('common.failedSave'));
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: 'active', label: t('status.active') },
    { value: 'inactive', label: t('status.inactive') },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier ? t('editSupplier') : t('addSupplier')}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? t('common.saving') : supplier ? t('common.update') : t('common.create')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label={t('fields.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          required
        />
        <Dropdown
          label={t('fields.status')}
          options={statusOptions}
          value={status}
          onChange={(val) => setStatus(val as 'active' | 'inactive')}
        />
        <Input
          label={t('fields.phone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          type="tel"
        />
        <Input
          label={t('fields.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
        <Textarea
          label={t('fields.address')}
          value={address}
          onChange={(val) => setAddress(val)}
        />
        <Textarea
          label={t('fields.notes')}
          value={notes}
          onChange={(val) => setNotes(val)}
        />
      </div>
    </Modal>
  );
}
