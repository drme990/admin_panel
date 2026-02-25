'use client';

import { useEffect, useState } from 'react';
import { Coupon } from '@/types/Coupon';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    maxUses: '' as string | number,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    status: 'active' as 'active' | 'expired' | 'disabled',
    minOrderAmount: '' as string | number,
    maxDiscountAmount: '' as string | number,
    description_ar: '',
    description_en: '',
  });
  const t = useTranslations('admin.coupons');
  const { confirm, modalProps } = useConfirmModal();

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await fetch('/api/coupons');
      const data = await res.json();
      if (data.success) {
        setCoupons(data.data.coupons);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const couponData = {
      code: formData.code.toUpperCase().trim(),
      type: formData.type,
      value: formData.value,
      maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
      validFrom: formData.validFrom,
      validUntil: formData.validUntil || undefined,
      status: formData.status,
      minOrderAmount: formData.minOrderAmount
        ? Number(formData.minOrderAmount)
        : undefined,
      maxDiscountAmount: formData.maxDiscountAmount
        ? Number(formData.maxDiscountAmount)
        : undefined,
      description: {
        ar: formData.description_ar,
        en: formData.description_en,
      },
    };

    try {
      const url = editingCoupon
        ? `/api/coupons/${editingCoupon._id}`
        : '/api/coupons';
      const method = editingCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(couponData),
      });

      if (res.ok) {
        toast.success(
          editingCoupon
            ? t('messages.updateSuccess')
            : t('messages.createSuccess'),
        );
        fetchCoupons();
        closeModal();
      } else {
        const data = await res.json();
        toast.error(data.error || t('messages.saveFailed'));
      }
    } catch (error) {
      console.error('Error saving coupon:', error);
      toast.error(t('messages.saveFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirm'),
      type: 'danger',
      confirmText: t('deleteButton'),
      cancelText: t('buttons.cancelButton'),
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('messages.deleteSuccess'));
        fetchCoupons();
      } else {
        const data = await res.json();
        toast.error(data.error || t('messages.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting coupon:', error);
    }
  };

  const openModal = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxUses: coupon.maxUses || '',
        validFrom: coupon.validFrom
          ? new Date(coupon.validFrom).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        validUntil: coupon.validUntil
          ? new Date(coupon.validUntil).toISOString().split('T')[0]
          : '',
        status: coupon.status,
        minOrderAmount: coupon.minOrderAmount || '',
        maxDiscountAmount: coupon.maxDiscountAmount || '',
        description_ar: coupon.description?.ar || '',
        description_en: coupon.description?.en || '',
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        maxUses: '',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        status: 'active',
        minOrderAmount: '',
        maxDiscountAmount: '',
        description_ar: '',
        description_en: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
  };

  const columns = [
    {
      header: t('table.code'),
      accessor: (coupon: Coupon) => (
        <span className="font-mono font-bold text-primary">{coupon.code}</span>
      ),
    },
    {
      header: t('table.type'),
      accessor: (coupon: Coupon) => (
        <span>
          {coupon.type === 'percentage'
            ? `${coupon.value}%`
            : `${coupon.value}`}
        </span>
      ),
    },
    {
      header: t('table.uses'),
      accessor: (coupon: Coupon) => (
        <span>
          {coupon.usedCount}
          {coupon.maxUses ? ` / ${coupon.maxUses}` : ''}
        </span>
      ),
    },
    {
      header: t('table.status'),
      accessor: (coupon: Coupon) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            coupon.status === 'active'
              ? 'bg-success/10 text-success'
              : coupon.status === 'expired'
                ? 'bg-error/10 text-error'
                : 'bg-stroke/20 text-secondary'
          }`}
        >
          {t(`status.${coupon.status}`)}
        </span>
      ),
    },
    {
      header: t('table.validUntil'),
      accessor: (coupon: Coupon) =>
        coupon.validUntil
          ? new Date(coupon.validUntil).toLocaleDateString()
          : '-',
    },
    {
      header: t('table.actions'),
      accessor: (coupon: Coupon) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openModal(coupon);
            }}
            className="p-2 hover:bg-background rounded-lg transition-colors"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(coupon._id);
            }}
            className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          {t('addCoupon')}
        </button>
      </div>

      <Table
        columns={columns}
        data={coupons}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCoupon ? t('editCoupon') : t('addCoupon')}
        size="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 py-2 bg-background border border-stroke rounded-lg hover:bg-stroke/10 transition-colors font-medium"
            >
              {t('buttons.cancelButton')}
            </button>
            <button
              type="submit"
              form="coupon-form"
              className="flex-1 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              {editingCoupon
                ? t('buttons.updateCoupon')
                : t('buttons.addCoupon')}
            </button>
          </div>
        }
      >
        <form id="coupon-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('form.code')}
            type="text"
            required
            value={formData.code}
            onChange={(e) =>
              setFormData({
                ...formData,
                code: e.target.value.toUpperCase(),
              })
            }
            placeholder="SUMMER2024"
            disabled={!!editingCoupon}
          />

          <div className="grid grid-cols-2 gap-4">
            <Dropdown
              label={t('form.type')}
              value={formData.type}
              options={[
                { label: t('form.typePercentage'), value: 'percentage' },
                { label: t('form.typeFixed'), value: 'fixed' },
              ]}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  type: value as 'percentage' | 'fixed',
                })
              }
            />
            <Input
              label={t('form.value')}
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.value || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  value: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.validFrom')}
              type="date"
              required
              value={formData.validFrom}
              onChange={(e) =>
                setFormData({ ...formData, validFrom: e.target.value })
              }
            />
            <Input
              label={t('form.validUntil')}
              type="date"
              value={formData.validUntil}
              onChange={(e) =>
                setFormData({ ...formData, validUntil: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.maxUses')}
              type="number"
              min="1"
              value={formData.maxUses}
              onChange={(e) =>
                setFormData({ ...formData, maxUses: e.target.value })
              }
              placeholder={t('form.unlimited')}
            />
            <Input
              label={t('form.minOrderAmount')}
              type="number"
              min="0"
              step="0.01"
              value={formData.minOrderAmount}
              onChange={(e) =>
                setFormData({ ...formData, minOrderAmount: e.target.value })
              }
            />
          </div>

          <Input
            label={t('form.maxDiscountAmount')}
            type="number"
            min="0"
            step="0.01"
            value={formData.maxDiscountAmount}
            onChange={(e) =>
              setFormData({ ...formData, maxDiscountAmount: e.target.value })
            }
            placeholder={t('form.noLimit')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('form.descriptionAr')}
              value={formData.description_ar}
              onChange={(e) =>
                setFormData({ ...formData, description_ar: e.target.value })
              }
            />
            <Input
              label={t('form.descriptionEn')}
              value={formData.description_en}
              onChange={(e) =>
                setFormData({ ...formData, description_en: e.target.value })
              }
              dir="ltr"
            />
          </div>

          {editingCoupon && (
            <Dropdown
              label={t('form.status')}
              value={formData.status}
              options={[
                { label: t('status.active'), value: 'active' },
                { label: t('status.disabled'), value: 'disabled' },
                { label: t('status.expired'), value: 'expired' },
              ]}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  status: value as 'active' | 'expired' | 'disabled',
                })
              }
            />
          )}
        </form>
      </Modal>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
