'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Table from '@/components/ui/table';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tabs from '@/components/ui/tabs';
import BulkAction from '@/components/ui/bulk-action';
import Pagination from '@/components/ui/pagination';
import Checkbox from '@/components/ui/checkbox';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Tooltip from '@/components/ui/tooltip';
import Dropdown from '@/components/ui/dropdown';
import CountrySelector from '@/components/shared/country-selector';
import CustomerOrdersModal from './components/customer-orders-modal';
import CustomerRefHistoryModal from './components/customer-ref-history-modal';
import CustomerCountryHistoryModal, {
  CountryHistoryEntry,
} from './components/customer-country-history-modal';
import CustomerInfoModal from './components/customer-info-modal';
import { Order } from '@/types/Order';

import { toast } from 'react-toastify';

import {
  LuBan,
  LuShieldCheck,
  LuSearch,
  LuShoppingCart,
  LuHistory,
  LuInfo,
  LuGlobe,
} from 'react-icons/lu';

type Customer = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  detectedCountry?: string | null;
  registrationIp?: string;
  lastLoginIp?: string;
  lastLoginAt?: string;
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
type RefFilter = 'all' | 'default' | string;

type CustomerRefHistory = {
  _id: string;
  previousRef: string | null;
  newRef: string | null;
  changedByUserName: string;
  changedByUserEmail: string;
  changeSource: 'single' | 'bulk';
  createdAt: string;
};

function getCustomerKey(customer: Customer): string {
  return `${customer.appId}:${customer._id}`;
}

function getDefaultRefForApp(appId: Customer['appId']): string {
  return appId === 'ghadaq' ? 'default-GHD' : 'default-MNK';
}

export default function CustomersPage() {
  const t = useTranslations('admin.customers');
  const tCommon = useTranslations('admin.customers.common');
  const tOrders = useTranslations('admin.customers.ordersModal');
  const { confirm, modalProps } = useConfirmModal();
  const locale = useLocale();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appFilter, setAppFilter] = useState<AppFilter>('all');
  const [banFilter, setBanFilter] = useState<BanFilter>('all');
  const [refFilter, setRefFilter] = useState<RefFilter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<string[]>(
    [],
  );
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [fetchingRefs, setFetchingRefs] = useState(false);
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';

  const [bulkRefValue, setBulkRefValue] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // User orders modal state
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Ref history modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<{
    _id: string;
    name: string;
    ref: string | null;
    appId: Customer['appId'];
  } | null>(null);
  const [refHistory, setRefHistory] = useState<CustomerRefHistory[]>([]);

  // Country state
  const [isCountryHistoryModalOpen, setIsCountryHistoryModalOpen] =
    useState(false);
  const [loadingCountryHistory, setLoadingCountryHistory] = useState(false);
  const [countryHistory, setCountryHistory] = useState<CountryHistoryEntry[]>(
    [],
  );

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [updatingCountryId, setUpdatingCountryId] = useState<string | null>(
    null,
  );

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 20;

  // Stats from API (all customers, not filtered)
  const [stats, setStats] = useState({
    total: 0,
    manasik: 0,
    ghadaq: 0,
    banned: 0,
    active: 0,
  });

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

  const refFilterOptions = useMemo(() => {
    const options = referrals.map((r) => ({
      label: r.referralId,
      value: r.referralId,
    }));
    return [
      { value: 'all' as const, label: tCommon('allReferences') },
      { value: 'default-MNK' as const, label: 'default-MNK' },
      { value: 'default-GHD' as const, label: 'default-GHD' },
      ...options,
    ];
  }, [referrals, tCommon]);

  const refActionOptions = useMemo(() => {
    const options = referrals.map((r) => ({
      label: r.referralId,
      value: r.referralId,
    }));

    return options;
  }, [referrals]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (appFilter !== 'all') params.set('appId', appFilter);
      if (banFilter === 'banned') params.set('isBanned', 'true');
      if (banFilter === 'active') params.set('isBanned', 'false');
      if (refFilter !== 'all') params.set('ref', refFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      const query = params.toString();
      const url = query ? `/api/customers?${query}` : '/api/customers';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data.customers || []);
        setTotalPages(data.data.pagination?.totalPages || 0);
        setStats(
          data.data.stats || {
            total: 0,
            manasik: 0,
            ghadaq: 0,
            banned: 0,
            active: 0,
          },
        );
      } else {
        toast.error(data.error || t('messages.fetchFailed'));
      }
    } catch {
      toast.error(t('messages.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [appFilter, banFilter, refFilter, search, page, limit, t]);

  useEffect(() => {
    setPage(1);
  }, [appFilter, banFilter, refFilter, search]);

  useEffect(() => {
    setSelectedCustomerKeys([]);
  }, [page, appFilter, banFilter, refFilter, search, limit]);

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

  const fetchCustomerOrders = useCallback(
    async (customer: Customer) => {
      try {
        setLoadingOrders(true);
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/orders`,
        );
        const data = await response.json();

        if (data.success) {
          setCustomerOrders(data.data.orders || []);
        } else {
          toast.error(data.error || tOrders('loadFailed'));
        }
      } catch (error) {
        console.error('Error fetching customer orders:', error);
        toast.error(tOrders('loadFailed'));
      } finally {
        setLoadingOrders(false);
      }
    },
    [tOrders],
  );

  const fetchCustomerRefHistory = useCallback(
    async (customer: Customer) => {
      try {
        setLoadingHistory(true);
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/ref-history`,
        );
        const data = await response.json();

        if (data.success) {
          setRefHistory(data.data.history || []);
        } else {
          toast.error(data.error || tCommon('historyLoadFailed'));
        }
      } catch (error) {
        console.error('Error fetching customer ref history:', error);
        toast.error(tCommon('historyLoadFailed'));
      } finally {
        setLoadingHistory(false);
      }
    },
    [tCommon],
  );

  const updateCustomerRef = useCallback(
    async (customer: Customer, nextRefValue: string) => {
      const nextRef = nextRefValue || getDefaultRefForApp(customer.appId);
      setUpdatingId(customer._id);

      try {
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/ref`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref: nextRef }),
          },
        );

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || t('messages.updateFailed'));
          return false;
        }

        await fetchCustomers();
        toast.success(t('messages.updateSuccess'));
        return true;
      } catch {
        toast.error(t('messages.updateFailed'));
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    [fetchCustomers, t],
  );

  const fetchCustomerCountryHistory = useCallback(
    async (customer: Customer) => {
      try {
        setLoadingCountryHistory(true);
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/detected-country-history`,
        );
        const data = await response.json();

        if (data.success) {
          setCountryHistory(data.data || []);
        } else {
          toast.error(data.error || 'Failed to load country history');
        }
      } catch (error) {
        console.error('Error fetching customer country history:', error);
        toast.error('Failed to load country history');
      } finally {
        setLoadingCountryHistory(false);
      }
    },
    [],
  );

  const updateCustomerCountry = useCallback(
    async (customer: Customer, nextCountry: string) => {
      setUpdatingCountryId(getCustomerKey(customer));

      try {
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/detected-country`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ detectedCountry: nextCountry || null }),
          },
        );

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || t('messages.updateFailed'));
          return false;
        }

        setCustomers((prev) =>
          prev.map((item) =>
            item._id === customer._id && item.appId === customer.appId
              ? { ...item, detectedCountry: nextCountry || null }
              : item,
          ),
        );

        setSelectedCustomer((current) =>
          current &&
          current._id === customer._id &&
          current.appId === customer.appId
            ? { ...current, detectedCountry: nextCountry || null }
            : current,
        );

        toast.success(t('messages.updateSuccess'));
        return true;
      } catch {
        toast.error(t('messages.updateFailed'));
        return false;
      } finally {
        setUpdatingCountryId(null);
      }
    },
    [t],
  );

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

  const handleRefDropdownChange = useCallback(
    async (customer: Customer, nextRefValue: string) => {
      await updateCustomerRef(customer, nextRefValue);
    },
    [updateCustomerRef],
  );

  const handleToggleCustomerSelection = useCallback((customer: Customer) => {
    const key = getCustomerKey(customer);
    setSelectedCustomerKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const handleToggleAllCustomers = useCallback(() => {
    const allKeys = customers.map(getCustomerKey);
    const allSelected =
      allKeys.length > 0 &&
      allKeys.every((key) => selectedCustomerKeys.includes(key));

    if (allSelected) {
      setSelectedCustomerKeys([]);
      return;
    }

    setSelectedCustomerKeys(allKeys);
  }, [customers, selectedCustomerKeys]);

  const handleClearSelection = useCallback(() => {
    setSelectedCustomerKeys([]);
    setBulkRefValue('');
  }, []);

  const handleBulkApplyRef = useCallback(async () => {
    const selected = customers.filter((customer) =>
      selectedCustomerKeys.includes(getCustomerKey(customer)),
    );

    if (selected.length === 0 || !bulkRefValue) {
      return;
    }

    setBulkUpdating(true);
    try {
      const response = await fetch('/api/customers/bulk-ref', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: bulkRefValue,
          customers: selected.map((customer) => ({
            id: customer._id,
            appId: customer.appId,
          })),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        toast.error(data.error || t('messages.updateFailed'));
        return;
      }

      await fetchCustomers();
      handleClearSelection();
      toast.success(t('messages.updateSuccess'));
    } catch {
      toast.error(t('messages.updateFailed'));
    } finally {
      setBulkUpdating(false);
    }
  }, [
    bulkRefValue,
    customers,
    fetchCustomers,
    handleClearSelection,
    selectedCustomerKeys,
    t,
  ]);

  const handleOpenHistory = useCallback(
    async (customer: Customer) => {
      setSelectedHistoryCustomer(customer);
      setRefHistory([]);
      setIsHistoryModalOpen(true);
      await fetchCustomerRefHistory(customer);
    },
    [fetchCustomerRefHistory],
  );

  const handleViewOrders = useCallback(
    (customer: Customer) => {
      setSelectedCustomer(customer);
      setIsOrdersModalOpen(true);
      fetchCustomerOrders(customer);
    },
    [fetchCustomerOrders],
  );

  const handleOpenInfo = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setIsInfoModalOpen(true);
  }, []);

  const handleOpenCountryHistory = useCallback(
    async (customer: Customer) => {
      setSelectedCustomer(customer);
      setCountryHistory([]);
      setIsCountryHistoryModalOpen(true);
      await fetchCustomerCountryHistory(customer);
    },
    [fetchCustomerCountryHistory],
  );

  const handleCountryChange = useCallback(
    async (customer: Customer, nextCountry: string) => {
      await updateCustomerCountry(customer, nextCountry);
    },
    [updateCustomerCountry],
  );

  const columns = useMemo(
    () => [
      {
        header: (
          <Checkbox
            checked={
              customers.length > 0 &&
              customers.every((customer) =>
                selectedCustomerKeys.includes(getCustomerKey(customer)),
              )
            }
            onChange={handleToggleAllCustomers}
            aria-label={tCommon('selectAllCustomers')}
          />
        ),
        accessor: (customer: Customer) => (
          <Checkbox
            checked={selectedCustomerKeys.includes(getCustomerKey(customer))}
            onChange={() => handleToggleCustomerSelection(customer)}
            aria-label={tCommon('selectCustomer', { name: customer.name })}
          />
        ),
        className: 'w-12',
      },
      {
        header: t('table.userId'),
        accessor: (customer: Customer) => (
          <div className="min-w-40">
            <span className="text-secondary font-mono text-xs break-all">
              {customer._id}
            </span>
          </div>
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
        header: locale === 'ar' ? 'البلد' : 'Country',
        accessor: (customer: Customer) => (
          <CountrySelector
            value={customer.detectedCountry || ''}
            onChange={(nextCountry) =>
              handleCountryChange(customer, nextCountry)
            }
            placeholder={locale === 'ar' ? 'اختر البلد' : 'Select country'}
            allowClear
            clearLabel={locale === 'ar' ? 'حذف البلد' : 'Clear country'}
            disabled={
              loading ||
              bulkUpdating ||
              updatingId === customer._id ||
              updatingCountryId === getCustomerKey(customer)
            }
            className="min-w-56"
          />
        ),
      },
      {
        header: t('table.ref'),
        accessor: (customer: Customer) => (
          <Dropdown
            value={customer.ref || getDefaultRefForApp(customer.appId)}
            options={[
              {
                label: getDefaultRefForApp(customer.appId),
                value: getDefaultRefForApp(customer.appId),
              },
              ...refActionOptions,
            ]}
            onChange={(value) => handleRefDropdownChange(customer, value)}
            placeholder={tCommon('selectReferral')}
            disabled={loading || bulkUpdating || updatingId === customer._id}
            className="min-w-52"
          />
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
          <div className="flex flex-wrap justify-center gap-2 w-30">
            <Tooltip content={tOrders('title')} position={ToolTipPositions}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={() => handleViewOrders(customer)}
                aria-label={tOrders('title')}
              >
                <LuShoppingCart size={16} />
              </Button>
            </Tooltip>

            <Tooltip
              content={tCommon('historyIcon')}
              position={ToolTipPositions}
            >
              <Button
                variant="icon-primary"
                size="custom"
                onClick={() => handleOpenHistory(customer)}
                aria-label={tCommon('historyIcon')}
              >
                <LuHistory size={16} />
              </Button>
            </Tooltip>

            <Tooltip content={tCommon('infoIcon')} position={ToolTipPositions}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={() => handleOpenInfo(customer)}
                aria-label={tCommon('infoIcon')}
              >
                <LuInfo size={16} />
              </Button>
            </Tooltip>

            <Tooltip
              content={tCommon('countryHistoryIcon')}
              position={ToolTipPositions}
            >
              <Button
                variant="icon-primary"
                size="custom"
                onClick={() => handleOpenCountryHistory(customer)}
                aria-label={tCommon('countryHistoryIcon')}
              >
                <LuGlobe size={16} />
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
    [
      customers,
      handleOpenHistory,
      handleToggleAllCustomers,
      handleToggleBan,
      handleToggleCustomerSelection,
      handleViewOrders,
      handleRefDropdownChange,
      handleCountryChange,
      handleOpenInfo,
      handleOpenCountryHistory,
      loading,
      bulkUpdating,
      tCommon,
      tOrders,
      refActionOptions,
      selectedCustomerKeys,
      t,
      ToolTipPositions,
      updatingId,
      updatingCountryId,
      locale,
    ],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('description')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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

        {/* Active */}
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-sm text-secondary">{t('stats.active')}</p>
          <p className="text-2xl font-bold text-emerald-500">{stats.active}</p>
        </div>

        {/* Banned */}
        <div className="bg-card-bg border border-stroke rounded-site p-4">
          <p className="text-sm text-secondary">{t('stats.banned')}</p>
          <p className="text-2xl font-bold text-red-500">{stats.banned}</p>
        </div>
      </div>

      <div className="bg-card-bg border border-stroke rounded-site p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
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

          <div className="flex items-center gap-2 flex-wrap">
            {fetchingRefs ? (
              <span className="text-sm text-secondary">
                {tCommon('loadingRefs')}
              </span>
            ) : (
              <Tabs
                value={refFilter}
                options={refFilterOptions}
                onChange={setRefFilter}
                size="sm"
              />
            )}
          </div>
        </div>
      </div>

      <BulkAction
        selectedCount={selectedCustomerKeys.length}
        value={bulkRefValue}
        options={[
          { label: 'default-MNK', value: 'default-MNK' },
          { label: 'default-GHD', value: 'default-GHD' },
          ...refActionOptions,
        ]}
        onValueChange={setBulkRefValue}
        onApply={handleBulkApplyRef}
        onClear={handleClearSelection}
        applyLabel={tCommon('bulkApplyRef')}
        applyingLabel={tCommon('bulkApplying')}
        clearLabel={tCommon('bulkClearSelection')}
        selectionLabel={tCommon('bulkSelectionLabel', {
          count: selectedCustomerKeys.length,
        })}
        dropdownLabel={tCommon('bulkDropdownLabel')}
        disabled={!bulkRefValue}
        loading={bulkUpdating}
      />

      <Table<Customer>
        columns={columns}
        data={customers}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="space-y-4">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      )}

      <ConfirmModal {...modalProps} />

      <CustomerOrdersModal
        isOrdersModalOpen={isOrdersModalOpen}
        setIsOrdersModalOpen={setIsOrdersModalOpen}
        selectedCustomer={selectedCustomer}
        customerOrders={customerOrders}
        loadingOrders={loadingOrders}
      />

      <CustomerRefHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        loading={loadingHistory}
        customer={selectedHistoryCustomer}
        history={refHistory}
      />

      <CustomerInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        customer={selectedCustomer}
      />

      <CustomerCountryHistoryModal
        isOpen={isCountryHistoryModalOpen}
        onClose={() => setIsCountryHistoryModalOpen(false)}
        loading={loadingCountryHistory}
        customer={selectedCustomer}
        history={countryHistory}
      />
    </div>
  );
}
