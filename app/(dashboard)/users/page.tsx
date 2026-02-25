'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { User, AdminPage, ALL_ADMIN_PAGES } from '@/types/User';
import { Plus, Trash2, Shield, UserCog, Pencil } from 'lucide-react';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';
import Input from '@/components/ui/input';
import { toast } from 'react-toastify';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/components/providers/auth-provider';

type ModalMode = 'add' | 'edit';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin' as 'admin' | 'super_admin',
    allowedPages: [] as AdminPage[],
  });
  const t = useTranslations('admin.users');
  const { confirm, modalProps } = useConfirmModal();
  const { user: currentUser } = useAuth();

  const roleOptions = [
    { value: 'admin', label: t('roles.admin') },
    { value: 'super_admin', label: t('roles.super_admin') },
  ];

  const canDelete = useCallback(
    (target: User) => {
      if (!currentUser) return false;
      if (target._id === currentUser._id) return false;
      if (target.role === 'super_admin' && currentUser.role !== 'super_admin')
        return false;
      return true;
    },
    [currentUser],
  );

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) setUsers(data.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openAddModal = () => {
    setModalMode('add');
    setEditingUserId(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'admin',
      allowedPages: [],
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setModalMode('edit');
    setEditingUserId(user._id);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      allowedPages: user.allowedPages ?? [],
    });
    setShowModal(true);
  };

  const handleDelete = useCallback(
    async (user: User) => {
      if (!canDelete(user)) {
        toast.error(
          user._id === currentUser?._id
            ? t('cannotDeleteSelf')
            : t('cannotDeleteSuperAdmin'),
        );
        return;
      }

      const confirmed = await confirm({
        title: t('deleteConfirmTitle'),
        message: t('deleteConfirm'),
        type: 'danger',
        confirmText: t('deleteConfirmButton'),
        cancelText: t('deleteCancelButton'),
      });
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/users/${user._id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          toast.success(t('messages.deleteSuccess'));
          fetchUsers();
        } else {
          toast.error(data.error || t('messages.deleteFailed'));
        }
      } catch {
        toast.error(t('messages.deleteFailed'));
      }
    },
    [canDelete, confirm, currentUser, fetchUsers, t],
  );

  const columns = useMemo(
    () => [
      {
        header: t('table.name'),
        accessor: (user: User) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              {user.role === 'super_admin' ? (
                <Shield size={16} className="text-primary" />
              ) : (
                <UserCog size={16} className="text-primary" />
              )}
            </div>
            <span className="font-medium">{user.name}</span>
          </div>
        ),
      },
      {
        header: t('table.email'),
        accessor: (user: User) => (
          <span className="text-secondary">{user.email}</span>
        ),
      },
      {
        header: t('table.role'),
        accessor: (user: User) => (
          <div className="flex flex-col gap-1">
            <span
              className={`inline-block w-fit px-2 py-1 rounded-full text-xs font-medium ${
                user.role === 'super_admin'
                  ? 'bg-purple-500/10 text-purple-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}
            >
              {user.role === 'super_admin'
                ? t('roles.super_admin')
                : t('roles.admin')}
            </span>
            {user.role === 'admin' &&
              user.allowedPages &&
              user.allowedPages.length > 0 && (
                <span className="text-xs text-secondary">
                  {user.allowedPages.length} {t('pagesAccess')}
                </span>
              )}
          </div>
        ),
      },
      {
        header: t('table.createdAt'),
        accessor: (user: User) => (
          <span className="text-secondary">
            {new Date(user.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: t('table.actions'),
        accessor: (user: User) => (
          <div className="flex items-center gap-1">
            {user._id !== currentUser?._id && (
              <button
                onClick={() => openEditModal(user)}
                className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"
                title={t('editUser')}
              >
                <Pencil size={16} />
              </button>
            )}
            {canDelete(user) && (
              <button
                onClick={() => handleDelete(user)}
                className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, canDelete, handleDelete, currentUser],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modalMode === 'add') {
      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          toast.success(t('messages.createSuccess'));
          fetchUsers();
          setShowModal(false);
        } else {
          const data = await res.json();
          toast.error(data.error || t('messages.createFailed'));
        }
      } catch {
        toast.error(t('messages.createFailed'));
      }
    } else {
      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        allowedPages: formData.allowedPages,
      };
      if (formData.password.trim().length >= 6)
        payload.password = formData.password;

      try {
        const res = await fetch(`/api/users/${editingUserId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(t('messages.updateSuccess'));
          fetchUsers();
          setShowModal(false);
        } else {
          toast.error(data.error || t('messages.updateFailed'));
        }
      } catch {
        toast.error(t('messages.updateFailed'));
      }
    }
  };

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
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={20} />
          {t('addUser')}
        </button>
      </div>

      <Table<User>
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? t('addUser') : t('editUser')}
        size="md"
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 py-2 bg-background border border-stroke rounded-lg hover:bg-stroke/10 transition-colors font-medium"
            >
              {t('buttons.cancel')}
            </button>
            <button
              type="submit"
              form="user-form"
              className="flex-1 py-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              {modalMode === 'add'
                ? t('buttons.addUser')
                : t('buttons.updateUser')}
            </button>
          </div>
        }
      >
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('form.name')}
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label={t('form.email')}
            type="email"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />

          <Input
            label={
              modalMode === 'add'
                ? t('form.password')
                : t('form.passwordOptional')
            }
            type="password"
            required={modalMode === 'add'}
            minLength={modalMode === 'add' ? 6 : undefined}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            placeholder={
              modalMode === 'add'
                ? t('form.passwordPlaceholder')
                : t('form.passwordOptionalPlaceholder')
            }
            helperText={
              modalMode === 'add' ? t('form.passwordPlaceholder') : undefined
            }
          />

          <Dropdown
            label={t('form.role')}
            value={formData.role}
            options={roleOptions}
            onChange={(value) =>
              setFormData({
                ...formData,
                role: value as 'admin' | 'super_admin',
                allowedPages:
                  value === 'super_admin' ? [] : formData.allowedPages,
              })
            }
          />

          {formData.role === 'admin' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                {t('form.allowedPages')}
              </label>
              <p className="text-xs text-secondary mb-2">
                {t('form.allowedPagesHelp')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ADMIN_PAGES.map((page) => (
                  <label
                    key={page}
                    className="flex items-center gap-2 p-2 rounded-lg border border-stroke hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.allowedPages.includes(page)}
                      onChange={(e) => {
                        const pages = e.target.checked
                          ? [...formData.allowedPages, page]
                          : formData.allowedPages.filter((p) => p !== page);
                        setFormData({ ...formData, allowedPages: pages });
                      }}
                      className="rounded accent-primary"
                    />
                    <span className="text-sm">{t(`pageLabels.${page}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
