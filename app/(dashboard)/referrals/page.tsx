'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { Referral } from '@/types/Referral';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { toast } from 'react-toastify';
import DefaultPhoneNumbersModal from './components/default-phone-numbers-modal';

import {
  LuPlus as Plus,
  LuPen as Edit,
  LuTrash2 as Trash2,
  LuSearch as Search,
  LuPhone,
} from 'react-icons/lu';

/**
 * Extract a human-readable error message from an API response.
 * The backend returns either a plain string (`{ error: "..." }`)
 * or a structured error (`{ error: { code, message, details } }`).
 */
function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const error = (data as Record<string, unknown>).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    const details = typeof errObj.details === 'string' ? errObj.details : null;
    const message = typeof errObj.message === 'string' ? errObj.message : null;
    // details has the field-specific message (e.g. "phone: Invalid phone number format")
    if (details) return details;
    if (message) return message;
  }
  return fallback;
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingReferral, setEditingReferral] = useState<Referral | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    referralId: '',
    phone: '',
    appId: 'manasik' as 'manasik' | 'ghadaq',
  });
  const [appFilter, setAppFilter] = useState<'all' | 'manasik' | 'ghadaq'>('all');
  const [showDefaultPhonesModal, setShowDefaultPhonesModal] = useState(false);
  const t = useTranslations('admin.referrals');
  const { confirm, modalProps } = useConfirmModal();
  const ToolTipPositions = useLocale() === 'ar' ? 'right' : 'left';

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '100',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (appFilter !== 'all') params.set('appId', appFilter);

      const response = await fetch(`/api/referrals?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReferrals(data.data.referrals);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, appFilter]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      name: formData.name,
      referralId: formData.referralId,
      phone: formData.phone,
      appId: formData.appId,
    };

    try {
      const url = editingReferral
        ? `/api/referrals/${editingReferral._id}`
        : '/api/referrals';
      const method = editingReferral ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(
          editingReferral
            ? t('messages.updateSuccess')
            : t('messages.createSuccess'),
        );
        await fetchReferrals();
        handleCloseModal();
      } else {
        toast.error(extractApiError(data, t('messages.saveFailed')));
      }
    } catch (error) {
      console.error('Error saving referral:', error);
      toast.error(t('messages.saveFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirm'),
      type: 'danger',
      confirmText: t('deleteButton'),
      cancelText: t('cancelButton'),
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/referrals/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success(t('messages.deleteSuccess'));
        await fetchReferrals();
      } else {
        toast.error(extractApiError(data, t('messages.deleteFailed')));
      }
    } catch (error) {
      console.error('Error deleting referral:', error);
      toast.error(t('messages.deleteFailed'));
    }
  };

  const handleEdit = (referral: Referral) => {
    setEditingReferral(referral);
    setFormData({
      name: referral.name,
      referralId: referral.referralId,
      phone: referral.phone,
      appId: referral.appId || 'manasik',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingReferral(null);
    setFormData({
      name: '',
      referralId: '',
      phone: '',
      appId: 'manasik',
    });
  };

  const columns = [
    {
      header: t('table.name'),
      accessor: (row: Referral) => (
        <span className="font-medium">{row.name}</span>
      ),
    },
    {
      header: t('table.referralId'),
      accessor: (row: Referral) => (
        <span className="font-mono text-sm font-semibold text-primary">
          {row.referralId}
        </span>
      ),
    },
    {
      header: t('table.phone'),
      accessor: (row: Referral) => (
        <span className="text-sm" dir="ltr">
          {row.phone}
        </span>
      ),
    },
    {
      header: t('table.app'),
      accessor: (row: Referral) => (
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
          {row.appId === 'manasik' ? 'Manasik' : 'Ghadaq'}
        </span>
      ),
    },
    {
      header: t('table.createdAt'),
      accessor: (row: Referral) => (
        <span className="text-sm text-secondary">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (row: Referral) => (
        <div className="flex items-center gap-2">
          <Tooltip position={ToolTipPositions} content={t('editReferral')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              aria-label={t('editReferral')}
            >
              <Edit size={16} />
            </Button>
          </Tooltip>
          <Tooltip position={ToolTipPositions} content={t('deleteButton')}>
            <Button
              variant="icon-danger"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row._id);
              }}
              aria-label={t('deleteButton')}
            >
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </div>
      ),
      className: 'w-24',
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
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex gap-2" onClick={() => setShowDefaultPhonesModal(true)}>
            <LuPhone size={18} />
            {t('defaultPhones.button')}
          </Button>
          <Button className="flex gap-2" onClick={() => setShowModal(true)}>
            <Plus size={20} />
            {t('addReferral')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
          />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'manasik', 'ghadaq'] as const).map((app) => (
            <button
              key={app}
              onClick={() => {
                setAppFilter(app);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${appFilter === app
                ? 'bg-primary text-primary-text'
                : 'bg-background border border-stroke text-secondary hover:bg-stroke'
                }`}
            >
              {app === 'all'
                ? (t('filterAll') || 'All')
                : app === 'manasik'
                  ? 'Manasik'
                  : 'Ghadaq'}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={referrals}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingReferral ? t('editReferral') : t('addReferral')}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              {t('buttons.cancel')}
            </Button>
            <Button type="submit" variant="primary" form="referral-form">
              {editingReferral
                ? t('buttons.updateReferral')
                : t('buttons.addReferral')}
            </Button>
          </div>
        }
      >
        <form id="referral-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('form.name')}
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t('form.namePlaceholder')}
            required
          />

          <Input
            label={t('form.referralId')}
            type="text"
            value={formData.referralId}
            onChange={(e) =>
              setFormData({ ...formData, referralId: e.target.value })
            }
            placeholder={t('form.referralIdPlaceholder')}
            required
            disabled={!!editingReferral}
          />

          <Input
            label={t('form.phone')}
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder={t('form.phonePlaceholder')}
            required
            dir="ltr"
          />

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('form.app') || 'App'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['manasik', 'ghadaq'] as const).map((app) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => setFormData({ ...formData, appId: app })}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${formData.appId === app
                    ? 'bg-primary text-primary-text'
                    : 'bg-background border border-stroke text-secondary hover:bg-stroke'
                    }`}
                >
                  {app === 'manasik' ? 'Manasik' : 'Ghadaq'}
                </button>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      <DefaultPhoneNumbersModal
        isOpen={showDefaultPhonesModal}
        onClose={() => setShowDefaultPhonesModal(false)}
      />

      <ConfirmModal {...modalProps} />
    </div>
  );
}
