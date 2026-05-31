'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coupon } from '@/types/Coupon';
import Table from '@/components/ui/table';
import { type CurrencyPrice } from '@/components/admin/multi-currency-price-editor';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Pagination from '@/components/ui/pagination';

import { LuPlus, LuPencil, LuTrash2 } from 'react-icons/lu';
import CouponModal from './components/coupon-modal';

type CountryOption = {
  _id: string;
  code: string;
  currencyCode: string;
  name: { ar: string; en: string };
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    fixedPrices: [] as CurrencyPrice[],
    fixedMainCurrency: '',
    fixedBasePrice: 0,
    maxDiscountPrices: [] as CurrencyPrice[],
    maxDiscountMainCurrency: '',
    maxDiscountBasePrice: 0,
    allowedCountries: [] as string[],
    maxUses: '' as string | number,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: '',
    status: 'active' as 'active' | 'expired' | 'disabled',
    minOrderAmount: '' as string | number,
    description_ar: '',
    description_en: '',
  });
  const t = useTranslations('admin.coupons');
  const { confirm, modalProps } = useConfirmModal();

  const fetchCoupons = useCallback(async (currentPage: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/coupons?limit=20&page=${currentPage}`);
      const data = await res.json();
      if (data.success) {
        setCoupons(data.data.coupons);
        if (data.data.pagination) setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoupons(page);
  }, [page, fetchCoupons]);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetch('/api/countries?active=true');
        const data = await res.json();
        if (data.success) {
          setCountries(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching countries:', error);
      }
    };

    void fetchCountries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const couponData = {
      code: formData.code.toUpperCase().trim(),
      type: formData.type,
      value: formData.type === 'percentage' ? formData.value : undefined,
      fixedPrices:
        formData.type === 'fixed'
          ? formData.fixedPrices
              .map((price) => ({
                currencyCode: price.currencyCode,
                amount: Number(price.amount || 0),
              }))
              .filter((price) => price.currencyCode && price.amount >= 0)
          : undefined,
      maxDiscountPrices:
        formData.maxDiscountPrices.length > 0
          ? formData.maxDiscountPrices
              .map((price) => ({
                currencyCode: price.currencyCode,
                amount: Number(price.amount || 0),
              }))
              .filter((price) => price.currencyCode && price.amount >= 0)
          : undefined,
      allowedCountries:
        formData.allowedCountries.length > 0
          ? formData.allowedCountries
          : undefined,
      maxUses: formData.maxUses ? Number(formData.maxUses) : undefined,
      validFrom: formData.validFrom,
      validUntil: formData.validUntil || undefined,
      status: formData.status,
      minOrderAmount: formData.minOrderAmount
        ? Number(formData.minOrderAmount)
        : undefined,
      description_ar: formData.description_ar || undefined,
      description_en: formData.description_en || undefined,
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
        fetchCoupons(page);
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
        fetchCoupons(page);
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
        fixedPrices: (coupon.fixedPrices || []).map((price) => ({
          currencyCode: price.currencyCode,
          amount: price.amount,
          isManual: true,
        })),
        fixedMainCurrency:
          coupon.fixedPrices?.[0]?.currencyCode ||
          countries[0]?.currencyCode ||
          'SAR',
        fixedBasePrice: coupon.fixedPrices?.[0]?.amount || 0,
        maxDiscountPrices: (coupon.maxDiscountPrices || []).map((price) => ({
          currencyCode: price.currencyCode,
          amount: price.amount,
          isManual: true,
        })),
        maxDiscountMainCurrency:
          coupon.maxDiscountPrices?.[0]?.currencyCode ||
          coupon.fixedPrices?.[0]?.currencyCode ||
          countries[0]?.currencyCode ||
          'SAR',
        maxDiscountBasePrice:
          coupon.maxDiscountPrices?.[0]?.amount ??
          coupon.maxDiscountAmount ??
          0,
        allowedCountries: coupon.allowedCountries || [],
        maxUses: coupon.maxUses || '',
        validFrom: coupon.validFrom
          ? new Date(coupon.validFrom).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        validUntil: coupon.validUntil
          ? new Date(coupon.validUntil).toISOString().split('T')[0]
          : '',
        status: coupon.status,
        minOrderAmount: coupon.minOrderAmount || '',
        description_ar: coupon.description?.ar || '',
        description_en: coupon.description?.en || '',
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        type: 'percentage',
        value: 0,
        fixedPrices: [],
        fixedMainCurrency: countries[0]?.currencyCode || 'SAR',
        fixedBasePrice: 0,
        allowedCountries: [],
        maxUses: '',
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        status: 'active',
        minOrderAmount: '',
        maxDiscountPrices: [],
        maxDiscountMainCurrency: countries[0]?.currencyCode || 'SAR',
        maxDiscountBasePrice: 0,
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
            : t('table.fixedMultiCurrency')}
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
          <Tooltip position="left" content={t('editCoupon')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={() => openModal(coupon)}
              aria-label={t('editCoupon')}
            >
              <LuPencil size={16} />
            </Button>
          </Tooltip>
          <Tooltip position="left" content={t('deleteCoupon')}>
            <Button
              variant="icon-danger"
              size="custom"
              onClick={() => handleDelete(coupon._id)}
              aria-label={t('deleteCoupon')}
            >
              <LuTrash2 size={16} />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  const allCountryCodes = countries.map((country) => country.code);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-secondary">{t('description')}</p>
        </div>
        <Button type="button" onClick={() => openModal()} className="shrink-0">
          <LuPlus size={16} />
          {t('addCoupon')}
        </Button>
      </div>

      <Table
        columns={columns}
        data={coupons}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <Pagination
        currentPage={page}
        totalPages={pagination.totalPages}
        onPageChange={setPage}
      />

      <CouponModal
        showModal={showModal}
        closeModal={closeModal}
        t={t}
        editingCoupon={editingCoupon}
        formData={formData}
        setFormData={setFormData}
        countries={countries}
        handleSubmit={handleSubmit}
        allCountryCodes={allCountryCodes}
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
