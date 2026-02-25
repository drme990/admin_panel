'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import { toast } from 'react-toastify';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { Referral } from '@/types/Referral';

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
  });
  const t = useTranslations('admin.referrals');
  const { confirm, modalProps } = useConfirmModal();

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (searchQuery) params.set('search', searchQuery);

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
  }, [page, searchQuery]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      name: formData.name,
      referralId: formData.referralId,
      phone: formData.phone,
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
        toast.error(data.error || t('messages.saveFailed'));
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
        toast.error(data.error || t('messages.deleteFailed'));
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row._id);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
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
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          {t('addReferral')}
        </button>
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
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 border border-stroke rounded-md text-foreground hover:bg-muted/50 transition-colors"
            >
              {t('buttons.cancel')}
            </button>
            <button
              type="submit"
              form="referral-form"
              className="px-4 py-2 bg-primary text-background rounded-md hover:bg-primary/90 transition-colors"
            >
              {editingReferral
                ? t('buttons.updateReferral')
                : t('buttons.addReferral')}
            </button>
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
        </form>
      </Modal>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
