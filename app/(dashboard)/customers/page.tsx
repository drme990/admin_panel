'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Table from '@/components/ui/table';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Tooltip from '@/components/ui/tooltip';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';

import { toast } from 'react-toastify';

import {
  LuBan,
  LuShieldCheck,
  LuSearch,
  LuPencil,
  LuCheck,
  LuX,
} from 'react-icons/lu';

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  appId: 'ghadaq' | 'manasik';
  isBanned: boolean;
  ref: string | null;
  createdAt: string;
};
 
type Referral = {
  _id: string;
  name: string;
  referralId: string;
  phone: string;
};

type AppFilter = 'all' | 'ghadaq' | 'manasik';
type BanFilter = 'all' | 'banned' | 'active';

export default function CustomersPage() {
  const t = useTranslations('admin.customers');
  const { confirm, modalProps } = useConfirmModal();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState<AppFilter>('all');
  const [banFilter, setBanFilter] = useState<BanFilter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isRefModalOpen, setIsRefModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [tempSelectedRefId, setTempSelectedRefId] = useState<string | null>(null);
  const [fetchingRefs, setFetchingRefs] = useState(false);
  const ToolTipPositions = useLocale() === 'ar' ? 'right' : 'left';

  const appFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('filters.allApps') },
      { value: 'manasik' as const, label: t('filters.manasik') },
      { value: 'ghadaq' as const, label: t('filters.ghadaq') },
    ],
    [t],
  );

  const banFilterOptions = useMemo(
    () => [
      { value: 'all' as const, label: t('filters.allStatus') },
      { value: 'active' as const, label: t('status.active') },
      { value: 'banned' as const, label: t('status.banned') },
    ],
    [t],
  );

  const stats = useMemo(() => {
    const total = customers.length;
    const manasik = customers.filter((c) => c.appId === 'manasik').length;
    const ghadaq = customers.filter((c) => c.appId === 'ghadaq').length;

    return { total, manasik, ghadaq };
  }, [customers]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (appFilter !== 'all') params.set('appId', appFilter);
      if (banFilter === 'banned') params.set('isBanned', 'true');
      if (banFilter === 'active') params.set('isBanned', 'false');
      if (search.trim()) params.set('search', search.trim());

      const query = params.toString();
      const url = query ? `/api/customers?${query}` : '/api/customers';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data.customers || []);
      } else {
        toast.error(data.error || t('messages.fetchFailed'));
      }
    } catch {
      toast.error(t('messages.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [appFilter, banFilter, search, t]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);
 
  const fetchReferrals = useCallback(async () => {
    try {
      setFetchingRefs(true);
      const response = await fetch('/api/referrals?limit=200');
      const data = await response.json();
      if (data.success) {
        setReferrals(data.data.referrals || []);
      }
    } catch (error) {
      console.error('Failed to fetch referrals:', error);
    } finally {
      setFetchingRefs(false);
    }
  }, []);
 
  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleToggleBan = useCallback(
    async (customer: Customer) => {
      const nextIsBanned = !customer.isBanned;
      const confirmed = await confirm({
        title: nextIsBanned ? t('banConfirmTitle') : t('unbanConfirmTitle'),
        message: nextIsBanned ? t('banConfirm') : t('unbanConfirm'),
        type: nextIsBanned ? 'danger' : 'info',
        confirmText: nextIsBanned ? t('ban') : t('unban'),
        cancelText: t('cancel'),
      });

      if (!confirmed) return;

      setUpdatingId(customer._id);
      try {
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/ban`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isBanned: nextIsBanned }),
          },
        );

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || t('messages.updateFailed'));
          return;
        }

        setCustomers((prev) =>
          prev.map((item) =>
            item._id === customer._id && item.appId === customer.appId
              ? { ...item, isBanned: nextIsBanned }
              : item,
          ),
        );
        toast.success(
          nextIsBanned ? t('messages.banSuccess') : t('messages.unbanSuccess'),
        );
      } catch {
        toast.error(t('messages.updateFailed'));
      } finally {
        setUpdatingId(null);
      }
    },
    [confirm, t],
  );
 
  const handleUpdateRef = useCallback(
    async (customer: Customer, ref: string | null) => {
      setUpdatingId(customer._id);
      try {
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/ref`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: ref || null }),
          },
        );
 
        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || t('messages.updateFailed'));
          return;
        }
 
        setCustomers((prev) =>
          prev.map((item) =>
            item._id === customer._id && item.appId === customer.appId
              ? { ...item, ref: ref || null }
              : item,
          ),
        );
        toast.success(t('messages.updateSuccess'));
        setIsRefModalOpen(false);
        setSelectedCustomer(null);
      } catch {
        toast.error(t('messages.updateFailed'));
      } finally {
        setUpdatingId(null);
      }
    },
    [t],
  );

  const columns = useMemo(
    () => [
      {
        header: t('table.userId'),
        accessor: (customer: Customer) => (
          <span className="text-secondary font-mono text-xs break-all">
            {customer._id}
          </span>
        ),
      },
      {
        header: t('table.name'),
        accessor: (customer: Customer) => (
          <div className="min-w-45">
            <p className="font-medium text-foreground">{customer.name}</p>
            <p className="text-xs text-secondary">{customer.email}</p>
          </div>
        ),
      },
      {
        header: t('table.phone'),
        accessor: (customer: Customer) => (
          <span className="text-secondary">{customer.phone || '-'}</span>
        ),
      },
      {
        header: t('table.app'),
        accessor: (customer: Customer) => (
          <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 uppercase">
            {customer.appId}
          </span>
        ),
      },
      {
        header: t('table.ref'),
        accessor: (customer: Customer) => (
          <span className="text-secondary font-mono text-sm">
            {customer.ref || '-'}
          </span>
        ),
      },
      {
        header: t('table.status'),
        accessor: (customer: Customer) => (
          <span
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
              customer.isBanned
                ? 'bg-red-500/10 text-red-500'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}
          >
            {customer.isBanned ? t('status.banned') : t('status.active')}
          </span>
        ),
      },
      {
        header: t('table.createdAt'),
        accessor: (customer: Customer) => (
          <span className="text-secondary">
            {new Date(customer.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: t('table.actions'),
        accessor: (customer: Customer) => (
          <div className="flex items-center gap-2">
            <Tooltip content={t('editRef')} position={ToolTipPositions}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={() => {
                  setSelectedCustomer(customer);
                  setTempSelectedRefId(customer.ref || null);
                  setIsRefModalOpen(true);
                }}
                aria-label={t('editRef')}
              >
                <LuPencil size={16} />
              </Button>
            </Tooltip>
 
            {customer.isBanned ? (
              <Tooltip content={t('unban')} position={ToolTipPositions}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={() => handleToggleBan(customer)}
                  disabled={updatingId === customer._id}
                  aria-label={t('unban')}
                >
                  <LuShieldCheck size={16} />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content={t('ban')} position={ToolTipPositions}>
                <Button
                  variant="icon-danger"
                  size="custom"
                  onClick={() => handleToggleBan(customer)}
                  disabled={updatingId === customer._id}
                  aria-label={t('ban')}
                >
                  <LuBan size={16} />
                </Button>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [handleToggleBan, handleUpdateRef, t, updatingId, ToolTipPositions],
  );
 
  const referralOptions = useMemo(() => {
    const options = referrals.map((r) => ({
      label: `${r.name} (${r.referralId})`,
      value: r.referralId,
    }));
    return [{ label: 'None / Clear', value: '' }, ...options];
  }, [referrals]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('description')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-sm text-secondary">{t('stats.total')}</p>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>

        {/* Manasik */}
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-sm text-secondary">{t('stats.manasik')}</p>
          <p className="text-2xl font-bold text-blue-500">{stats.manasik}</p>
        </div>

        {/* Ghadaq */}
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-sm text-secondary">{t('stats.ghadaq')}</p>
          <p className="text-2xl font-bold text-purple-500">{stats.ghadaq}</p>
        </div>
      </div>

      <div className="bg-card-bg border border-stroke rounded-site p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            suffix={<LuSearch className="text-secondary" size={18} />}
          />

          <div className="flex items-center gap-2 flex-wrap">
            <Tabs
              value={appFilter}
              options={appFilterOptions}
              onChange={setAppFilter}
              size="sm"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Tabs
              value={banFilter}
              options={banFilterOptions}
              onChange={setBanFilter}
              size="sm"
            />
          </div>
        </div>
      </div>

      <Table<Customer>
        columns={columns}
        data={customers}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      <ConfirmModal {...modalProps} />
 
      <Modal
        isOpen={isRefModalOpen}
        onClose={() => setIsRefModalOpen(false)}
        title={t('editRef')}
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setIsRefModalOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                selectedCustomer &&
                handleUpdateRef(selectedCustomer, tempSelectedRefId)
              }
              disabled={updatingId === selectedCustomer?._id}
            >
              {updatingId === selectedCustomer?._id ? t('saving') || 'Saving...' : t('save') || 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-4 min-h-[200px]">
          <p className="text-secondary text-sm mb-1">
            {t('referralSelectionLabel') || 'Select a referral partner for this customer:'}
          </p>
          <Dropdown
            value={tempSelectedRefId || ''}
            options={referralOptions}
            onChange={(val) => setTempSelectedRefId(val || null)}
            placeholder="Select Referral"
          />
 
          {tempSelectedRefId && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <p className="text-xs text-primary font-medium mb-1 uppercase">Selected ID</p>
              <p className="text-lg font-mono text-foreground">{tempSelectedRefId}</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
