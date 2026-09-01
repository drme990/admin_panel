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
import CustomDatePicker from '@/components/ui/custom-date-picker';
import CustomerOrdersModal from './components/customer-orders-modal';
import CustomerHistoryModal, {
  CountryHistoryEntry,
} from './components/customer-history-modal';
import CustomerInfoModal from './components/customer-info-modal';
import CustomerExportModal from './components/customer-export-modal';
import { Order } from '@/types/Order';

import { toast } from 'react-toastify';

import {
  LuBan,
  LuSearch,
  LuShoppingCart,
  LuHistory,
  LuInfo,
  LuCopy,
  LuCheck,
  LuDownload,
} from 'react-icons/lu';

import { Customer, UserTier } from './types';
import {
  getRelativeIsoDate,
  normalizeDateRange,
} from '../../../lib/order/order-utils';

type Referral = {
  _id: string;
  name: string;
  referralId: string;
  phone: string;
  appId: 'manasik' | 'ghadaq';
};

type AppFilter = 'all' | 'ghadaq' | 'manasik';
type BanFilter = 'all' | 'banned' | 'active';
type RefFilter = 'all' | 'default' | string;
type TierFilter = 'all' | 'none' | string;

type DateQuickPreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'last30Days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

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
  return appId === 'ghadaq' ? 'GHD-D' : 'MNK-D';
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-secondary hover:text-primary transition-colors"
      title="Copy ID"
      type="button"
    >
      {copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
    </button>
  );
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
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [detectedCountryFilter, setDetectedCountryFilter] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState<DateQuickPreset>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [selectedCustomerKeys, setSelectedCustomerKeys] = useState<string[]>(
    [],
  );
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [fetchingRefs, setFetchingRefs] = useState(false);
  const [tiers, setTiers] = useState<UserTier[]>([]);
  const [fetchingTiers, setFetchingTiers] = useState(false);
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';

  const [bulkRefValue, setBulkRefValue] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // User orders modal state
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // History modal state (merged ref + country)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [loadingRefHistory, setLoadingRefHistory] = useState(false);
  const [loadingCountryHistory, setLoadingCountryHistory] = useState(false);
  const [selectedHistoryCustomer, setSelectedHistoryCustomer] = useState<{
    _id: string;
    name: string;
    ref: string | null;
    appId: Customer['appId'];
    detectedCountry?: string | null;
  } | null>(null);
  const [refHistory, setRefHistory] = useState<CustomerRefHistory[]>([]);
  const [countryHistory, setCountryHistory] = useState<CountryHistoryEntry[]>([]);

  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [updatingCountryId, setUpdatingCountryId] = useState<string | null>(
    null,
  );
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [pageSize, setPageSize] = useState<number>(52);

  const handleDatePreset = (preset: Exclude<DateQuickPreset, 'custom'>) => {
    setActiveDatePreset(preset);
    switch (preset) {
      case 'all':
        setFromDateFilter('');
        setToDateFilter('');
        break;
      case 'today':
        setFromDateFilter(getRelativeIsoDate(0));
        setToDateFilter(getRelativeIsoDate(0));
        break;
      case 'yesterday':
        setFromDateFilter(getRelativeIsoDate(-1));
        setToDateFilter(getRelativeIsoDate(-1));
        break;
      case 'last7Days':
        setFromDateFilter(getRelativeIsoDate(-6));
        setToDateFilter(getRelativeIsoDate(0));
        break;
      case 'last30Days':
        setFromDateFilter(getRelativeIsoDate(-29));
        setToDateFilter(getRelativeIsoDate(0));
        break;
      case 'thisMonth': {
        const now = new Date();
        setFromDateFilter(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
        setToDateFilter(getRelativeIsoDate(0));
        break;
      }
      case 'lastMonth': {
        const now = new Date();
        setFromDateFilter(toIsoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
        setToDateFilter(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 0)));
        break;
      }
    }
  };

  const handleFromDateChange = (value: string) => {
    setFromDateFilter(value);
    setActiveDatePreset('custom');
  };

  const handleToDateChange = (value: string) => {
    setToDateFilter(value);
    setActiveDatePreset('custom');
  };

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
      { value: 'MNK-D' as const, label: 'MNK-D' },
      { value: 'GHD-D' as const, label: 'GHD-D' },
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
      if (tierFilter !== 'all') params.set('tier', tierFilter === 'none' ? '__none__' : tierFilter);
      if (countryFilter) params.set('country', countryFilter);
      if (detectedCountryFilter) params.set('detectedCountry', detectedCountryFilter);
      if (search.trim()) params.set('search', search.trim());

      const normalizedRange = normalizeDateRange(fromDateFilter, toDateFilter);
      if (normalizedRange.fromDate) params.set('fromDate', normalizedRange.fromDate);
      if (normalizedRange.toDate) params.set('toDate', normalizedRange.toDate);
      params.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));

      params.set('page', page.toString());
      params.set('limit', String(pageSize));

      const query = params.toString();
      const url = query ? `/api/customers?${query}` : '/api/customers';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data.customers || []);
        setTotalPages(data.data.pagination?.totalPages || 0);
        setTotalCustomers(data.data.pagination?.total || 0);
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
  }, [appFilter, banFilter, refFilter, tierFilter, countryFilter, detectedCountryFilter, search, fromDateFilter, toDateFilter, page, pageSize, t]);

  const fetchCustomersForExport = useCallback(async (limit: number, offset: number = 0) => {
    const params = new URLSearchParams();
    if (appFilter !== 'all') params.set('appId', appFilter);
    if (banFilter === 'banned') params.set('isBanned', 'true');
    if (banFilter === 'active') params.set('isBanned', 'false');
    if (refFilter !== 'all') params.set('ref', refFilter);
    if (tierFilter !== 'all') params.set('tier', tierFilter === 'none' ? '__none__' : tierFilter);
    if (countryFilter) params.set('country', countryFilter);
    if (detectedCountryFilter) params.set('detectedCountry', detectedCountryFilter);
    if (search.trim()) params.set('search', search.trim());

    const normalizedExportRange = normalizeDateRange(fromDateFilter, toDateFilter);
    if (normalizedExportRange.fromDate) params.set('fromDate', normalizedExportRange.fromDate);
    if (normalizedExportRange.toDate) params.set('toDate', normalizedExportRange.toDate);
    params.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));

    params.set('page', '1');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.set('globalSlice', 'true');

    const query = params.toString();
    const url = query ? `/api/customers?${query}` : '/api/customers';
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || t('messages.fetchFailed'));
    }

    return (data.data.customers || []) as Customer[];
  }, [appFilter, banFilter, refFilter, tierFilter, countryFilter, detectedCountryFilter, search, fromDateFilter, toDateFilter, t]);

  useEffect(() => {
    setPage(1);
  }, [appFilter, banFilter, refFilter, tierFilter, countryFilter, detectedCountryFilter, search, fromDateFilter, toDateFilter, pageSize]);

  useEffect(() => {
    setSelectedCustomerKeys([]);
  }, [page, appFilter, banFilter, refFilter, tierFilter, countryFilter, detectedCountryFilter, search, fromDateFilter, toDateFilter, pageSize]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchTiers = useCallback(async () => {
    try {
      setFetchingTiers(true);
      const res = await fetch('/api/crm/tiers');
      const data = await res.json();
      if (data.success) {
        setTiers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    } finally {
      setFetchingTiers(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

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

  const fetchCustomerHistory = useCallback(
    async (customer: Customer) => {
      try {
        setLoadingRefHistory(true);
        setLoadingCountryHistory(true);
        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}/history`,
        );
        const data = await response.json();

        if (data.success) {
          setRefHistory(data.data.refHistory || []);
          setCountryHistory(data.data.countryHistory || []);
        } else {
          toast.error(data.error || tCommon('historyLoadFailed'));
        }
      } catch (error) {
        console.error('Error fetching customer history:', error);
        toast.error(tCommon('historyLoadFailed'));
      } finally {
        setLoadingRefHistory(false);
        setLoadingCountryHistory(false);
      }
    },
    [tCommon],
  );

  const updateCustomer = useCallback(
    async (
      customer: Customer,
      fields: { ref?: string; detectedCountry?: string | null },
    ) => {
      const hasRef = 'ref' in fields;
      const hasCountry = 'detectedCountry' in fields;

      if (!hasRef && !hasCountry) return false;

      if (hasRef) setUpdatingId(customer._id);
      if (hasCountry) setUpdatingCountryId(getCustomerKey(customer));

      try {
        const body: Record<string, unknown> = {};
        if (hasRef) {
          body.ref = fields.ref || getDefaultRefForApp(customer.appId);
        }
        if (hasCountry) {
          body.detectedCountry = fields.detectedCountry || null;
        }

        const response = await fetch(
          `/api/customers/${customer.appId}/${customer._id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          },
        );

        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || t('messages.updateFailed'));
          return false;
        }

        if (hasRef) {
          await fetchCustomers();
        }
        if (hasCountry) {
          setCustomers((prev) =>
            prev.map((item) =>
              item._id === customer._id && item.appId === customer.appId
                ? { ...item, detectedCountry: fields.detectedCountry || null }
                : item,
            ),
          );
          setSelectedCustomer((current) =>
            current &&
              current._id === customer._id &&
              current.appId === customer.appId
              ? { ...current, detectedCountry: fields.detectedCountry || null }
              : current,
          );
        }

        toast.success(t('messages.updateSuccess'));
        return true;
      } catch {
        toast.error(t('messages.updateFailed'));
        return false;
      } finally {
        if (hasRef) setUpdatingId(null);
        if (hasCountry) setUpdatingCountryId(null);
      }
    },
    [fetchCustomers, t],
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
      await updateCustomer(customer, { ref: nextRefValue });
    },
    [updateCustomer],
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
      setCountryHistory([]);
      setIsHistoryModalOpen(true);
      await fetchCustomerHistory(customer);
    },
    [fetchCustomerHistory],
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

  const handleCountryChange = useCallback(
    async (customer: Customer, nextCountry: string) => {
      await updateCustomer(customer, { detectedCountry: nextCountry });
    },
    [updateCustomer],
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
        header: t('table.name'),
        accessor: (customer: Customer) => {
          const tier = customer.tier ? tiers.find((t) => t._id === customer.tier) : null;
          return (
            <div className="flex flex-col gap-1 min-w-50">
              <div className="flex items-center gap-2">
                <CopyIdButton id={customer._id} />
                <p className="font-medium text-foreground">{customer.name}</p>
              </div>
              {tier && (
                <span
                  className="self-start inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: tier.color }}
                >
                  {tier.name}
                </span>
              )}
            </div>
          );
        },
      },
      {
        header: t('table.email'),
        accessor: (customer: Customer) => (
          <span className="text-secondary text-sm">{customer.email}</span>
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
              ...refActionOptions.filter((opt) => {
                const referral = referrals.find((r) => r.referralId === opt.value);
                return !referral || referral.appId === customer.appId;
              }),
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
            className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${customer.isBanned
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

            {customer.isBanned ? (
              <Tooltip content={t('unban')} position={ToolTipPositions}>
                <Button
                  variant="icon-danger"
                  size="custom"
                  onClick={() => handleToggleBan(customer)}
                  disabled={updatingId === customer._id}
                  aria-label={t('unban')}
                >
                  <LuBan size={16} />
                </Button>
              </Tooltip>
            ) : (
              <Tooltip content={t('ban')} position={ToolTipPositions}>
                <Button
                  variant="icon-primary"
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
      loading,
      bulkUpdating,
      tCommon,
      tOrders,
      refActionOptions,
      referrals,
      selectedCustomerKeys,
      t,
      ToolTipPositions,
      updatingId,
      updatingCountryId,
      locale,
      tiers,
    ],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsExportModalOpen(true)}
          className="gap-2"
        >
          <LuDownload size={18} />
          {t('export.button')}
        </Button>
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
        {/* Date range filter */}
        <div className="rounded-site border border-stroke bg-background p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CustomDatePicker
              value={fromDateFilter}
              onChange={handleFromDateChange}
              locale={locale}
              label={t('filters.fromDate')}
              placeholder={t('filters.fromDate')}
            />
            <CustomDatePicker
              value={toDateFilter}
              onChange={handleToDateChange}
              locale={locale}
              label={t('filters.toDate')}
              placeholder={t('filters.toDate')}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { value: 'all' as const, label: t('filters.dateModeAll') },
              { value: 'today' as const, label: t('filters.today') },
              { value: 'yesterday' as const, label: t('filters.yesterday') },
              { value: 'last7Days' as const, label: t('filters.last7Days') },
              { value: 'last30Days' as const, label: t('filters.last30Days') },
              { value: 'thisMonth' as const, label: t('filters.thisMonth') },
              { value: 'lastMonth' as const, label: t('filters.lastMonth') },
            ].map((preset) => (
              <Button
                key={preset.value}
                variant="custom"
                type="button"
                size="custom"
                onClick={() => handleDatePreset(preset.value)}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${activeDatePreset === preset.value
                  ? 'bg-foreground border-foreground text-background shadow-sm'
                  : 'bg-background border-stroke text-foreground hover:bg-foreground/5'
                  }`}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          suffix={<LuSearch className="text-secondary" size={18} />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-fr">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterApp')}
            </p>
            <Tabs
              value={appFilter}
              options={appFilterOptions}
              onChange={setAppFilter}
              size="sm"
              className="flex-wrap"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterStatus')}
            </p>
            <Tabs
              value={banFilter}
              options={banFilterOptions}
              onChange={setBanFilter}
              size="sm"
              className="flex-wrap"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterRef')}
            </p>
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
                className="flex-wrap"
              />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterTier')}
            </p>
            {fetchingTiers ? (
              <span className="text-sm text-secondary">
                {tCommon('loadingTiers')}
              </span>
            ) : (
              <Tabs
                value={tierFilter}
                options={[
                  { value: 'all', label: tCommon('allTiers') },
                  { value: 'none', label: tCommon('noTier') },
                  ...tiers.map((tier) => ({
                    value: tier._id,
                    label: tier.name,
                  })),
                ]}
                onChange={setTierFilter}
                size="sm"
                className="flex-wrap"
              />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterProfileCountry')}
            </p>
            <CountrySelector
              value={countryFilter}
              onChange={(value) => {
                setCountryFilter(value);
                setPage(1);
              }}
              placeholder={t('filters.allCountries')}
              allowClear
              clearLabel={t('filters.allCountries')}
              className="w-full"
            />
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase text-secondary font-medium tracking-wide">
              {tCommon('filterDetectedCountry')}
            </p>
            <CountrySelector
              value={detectedCountryFilter}
              onChange={(value) => {
                setDetectedCountryFilter(value);
                setPage(1);
              }}
              placeholder={t('filters.allCountries')}
              allowClear
              clearLabel={t('filters.allCountries')}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <BulkAction
        selectedCount={selectedCustomerKeys.length}
        value={bulkRefValue}
        options={[
          { label: 'MNK-D', value: 'MNK-D' },
          { label: 'GHD-D', value: 'GHD-D' },
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

      <div className="flex items-center justify-between text-sm">
        <span className="text-secondary">
          {t('total')}: <span className="font-semibold text-foreground">{totalCustomers}</span>
        </span>
      </div>

      <Table<Customer>
        columns={columns}
        data={customers}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      {/* Pagination */}
      <div className="space-y-4">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          disabled={loading}
        />
      </div>

      <ConfirmModal {...modalProps} />

      <CustomerOrdersModal
        isOrdersModalOpen={isOrdersModalOpen}
        setIsOrdersModalOpen={setIsOrdersModalOpen}
        selectedCustomer={selectedCustomer}
        customerOrders={customerOrders}
        loadingOrders={loadingOrders}
      />

      <CustomerHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        loadingRef={loadingRefHistory}
        loadingCountry={loadingCountryHistory}
        customer={selectedHistoryCustomer}
        refHistory={refHistory}
        countryHistory={countryHistory}
      />

      <CustomerInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        customer={selectedCustomer}
      />

      <CustomerExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        customers={customers}
        locale={locale}
        tiers={tiers}
        totalCount={totalCustomers}
        onFetchForExport={fetchCustomersForExport}
        filters={{
          app: appFilter,
          ban: banFilter,
          ref: refFilter,
          tier: tierFilter,
          country: countryFilter,
          detectedCountry: detectedCountryFilter,
          search: search,
          fromDate: fromDateFilter,
          toDate: toDateFilter,
        }}
      />
    </div>
  );
}
