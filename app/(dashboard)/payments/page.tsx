'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Dropdown from '@/components/ui/dropdown';
import Button from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { LuCopy, LuLink2, LuRefreshCcw, LuTrash2 } from 'react-icons/lu';

type LinkStatus = 'unused' | 'opened' | 'used';

interface PaymentLinkRow {
  _id: string;
  source: 'manasik' | 'ghadaq';
  amountRequested: number;
  currency: string;
  status: LinkStatus;
  isExpired: boolean;
  openedAt: string | null;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  payLinkUrl: string | null;
}

interface PaymentLinksResponse {
  links: PaymentLinkRow[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface CountryLite {
  currencyCode: string;
}

export default function PaymentsPage() {
  const t = useTranslations('admin.payments');
  const locale = useLocale();
  const tooltipPosition = locale === 'ar' ? 'right' : 'left';

  const [loading, setLoading] = useState(true);
  const [creatingPayLink, setCreatingPayLink] = useState(false);
  const [links, setLinks] = useState<PaymentLinkRow[]>([]);
  const [usageFilter, setUsageFilter] = useState<'' | LinkStatus>('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<
    PaymentLinksResponse['pagination']
  >({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  const [customAmount, setCustomAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState('EGP');
  const [payLinkSource, setPayLinkSource] = useState<'manasik' | 'ghadaq'>(
    'manasik',
  );
  const [createdLink, setCreatedLink] = useState<{
    payLinkUrl: string;
    amountRequested: number;
    currency: string;
    expiresAt: string;
  } | null>(null);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(['EGP']);

  const { confirm: confirmDelete, modalProps: deleteConfirmModalProps } =
    useConfirmModal();

  useEffect(() => {
    async function loadCurrencies() {
      try {
        const response = await fetch('/api/countries?active=true');
        const payload = await response.json();
        if (!payload.success || !Array.isArray(payload.data)) return;

        const values = Array.from(
          new Set(
            (payload.data as CountryLite[])
              .map((c) => c.currencyCode?.trim().toUpperCase())
              .filter(
                (code): code is string => !!code && /^[A-Z]{3}$/.test(code),
              ),
          ),
        );

        if (!values.length) return;
        setCurrencyOptions(values);
        if (!values.includes(currencyCode)) {
          setCurrencyCode(values[0]);
        }
      } catch {
        // Keep fallback currency list
      }
    }

    void loadCurrencies();
  }, [currencyCode]);

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '10',
        kind: 'custom',
      });
      if (usageFilter) params.set('usage', usageFilter);
      if (sourceFilter) params.set('source', sourceFilter);

      const response = await fetch(`/api/payments/links?${params.toString()}`);
      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || t('messages.linksLoadFailed'));
      }

      const result = payload.data as PaymentLinksResponse;
      setLinks(result.links || []);
      setPagination(result.pagination);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('messages.linksLoadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, sourceFilter, t, usageFilter]);

  useEffect(() => {
    void fetchLinks();
  }, [fetchLinks]);

  const createPayLink = async () => {
    const parsedAmount = Number(customAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error(t('messages.customAmountInvalid'));
      return;
    }

    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      toast.error(t('messages.currencyRequired'));
      return;
    }

    try {
      setCreatingPayLink(true);
      const response = await fetch('/api/payments/pay-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customAmount: parsedAmount,
          currencyCode,
          source: payLinkSource,
        }),
      });

      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || t('messages.createFailed'));
      }

      setCreatedLink(payload.data);
      await navigator.clipboard.writeText(payload.data.payLinkUrl);
      toast.success(t('messages.createSuccess'));
      setCurrentPage(1);
      void fetchLinks();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('messages.createFailed'),
      );
    } finally {
      setCreatingPayLink(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('messages.copied'));
    } catch {
      toast.error(t('messages.copyFailed'));
    }
  };

  const deletePayLink = async (linkId: string) => {
    const confirmed = await confirmDelete({
      title: t('links.actions.deleteTitle'),
      message: t('links.actions.deleteConfirm'),
      type: 'danger',
      confirmText: t('links.actions.delete'),
      cancelText: t('links.actions.cancel'),
    });

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/payments/links/${linkId}`, {
        method: 'DELETE',
      });
      const payload = await response.json();

      if (!payload.success) {
        throw new Error(payload.error || t('messages.deleteLinkFailed'));
      }

      toast.success(t('messages.deleteLinkSuccess'));
      setLinks((prev) => prev.filter((x) => x._id !== linkId));
      void fetchLinks();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('messages.deleteLinkFailed'),
      );
    }
  };

  const usageOptions = useMemo(
    () => [
      { value: '', label: t('links.filters.allUsage') },
      { value: 'unused', label: t('links.status.unused') },
      { value: 'opened', label: t('links.status.opened') },
      { value: 'used', label: t('links.status.used') },
    ],
    [t],
  );

  const sourceOptions = useMemo(
    () => [
      { value: '', label: t('filters.allSources') },
      { value: 'manasik', label: t('filters.manasikSource') },
      { value: 'ghadaq', label: t('filters.ghadaqSource') },
    ],
    [t],
  );

  const currencyDropdownOptions = useMemo(
    () =>
      currencyOptions.map((value) => ({
        value,
        label: value,
      })),
    [currencyOptions],
  );

  const sourceDropdownOptions = useMemo(
    () => [
      { value: 'manasik', label: t('filters.manasikSource') },
      { value: 'ghadaq', label: t('filters.ghadaqSource') },
    ],
    [t],
  );

  const formatDate = (value: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusBadge = (status: LinkStatus) => {
    if (status === 'used') {
      return (
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {t('links.status.used')}
        </span>
      );
    }

    if (status === 'opened') {
      return (
        <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          {t('links.status.opened')}
        </span>
      );
    }

    return (
      <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        {t('links.status.unused')}
      </span>
    );
  };

  const columns = [
    {
      header: t('links.table.source'),
      accessor: (row: PaymentLinkRow) => row.source,
    },
    {
      header: t('links.table.amount'),
      accessor: (row: PaymentLinkRow) => (
        <span className="font-semibold">
          {row.amountRequested.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('links.table.status'),
      accessor: (row: PaymentLinkRow) => statusBadge(row.status),
    },
    {
      header: t('links.table.openedAt'),
      accessor: (row: PaymentLinkRow) => formatDate(row.openedAt),
    },
    {
      header: t('links.table.usedAt'),
      accessor: (row: PaymentLinkRow) => formatDate(row.usedAt),
    },
    {
      header: t('links.table.expiresAt'),
      accessor: (row: PaymentLinkRow) => formatDate(row.expiresAt),
    },
    {
      header: t('links.table.actions'),
      accessor: (row: PaymentLinkRow) => {
        const canCopy =
          !!row.payLinkUrl && (!row.isExpired || row.status === 'unused');

        return (
          <div className="flex items-center gap-2">
            {canCopy ? (
              <Tooltip
                content={t('links.actions.copy')}
                position={tooltipPosition}
              >
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyLink(row.payLinkUrl as string);
                  }}
                >
                  <LuCopy size={14} />
                </Button>
              </Tooltip>
            ) : null}
            <Tooltip
              content={t('links.actions.delete')}
              position={tooltipPosition}
            >
              <Button
                variant="icon-danger"
                size="custom"
                onClick={(e) => {
                  e.stopPropagation();
                  void deletePayLink(row._id);
                }}
              >
                <LuTrash2 size={14} />
              </Button>
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          {t('title')}
        </h1>
        <p className="text-secondary">{t('descriptionDirect')}</p>
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-3">
        <h2 className="text-lg font-semibold">{t('payLink.title')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-secondary">
              {t('payLink.customAmount')}
            </label>
            <input
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={t('payLink.customAmountPlaceholder')}
              className="mt-1 w-full rounded-lg border border-stroke bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-secondary">
              {t('payLink.currencyCode')}
            </label>
            <Dropdown
              value={currencyCode}
              options={currencyDropdownOptions}
              onChange={setCurrencyCode}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs text-secondary">
              {t('table.source')}
            </label>
            <Dropdown
              value={payLinkSource}
              options={sourceDropdownOptions}
              onChange={(value) =>
                setPayLinkSource(value as 'manasik' | 'ghadaq')
              }
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={createPayLink} disabled={creatingPayLink}>
            <LuLink2 size={16} />
            {creatingPayLink
              ? t('payLink.creating')
              : t('payLink.createButton')}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setCustomAmount('');
              setCreatedLink(null);
            }}
          >
            {t('payLink.reset')}
          </Button>
        </div>

        {createdLink ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={createdLink.payLinkUrl}
                className="w-full rounded-md border border-stroke bg-background px-2 py-1 text-xs"
              />
              <Button
                variant="icon-primary"
                size="sm"
                onClick={() => void copyLink(createdLink.payLinkUrl)}
              >
                <LuCopy size={14} />
              </Button>
            </div>
            <p className="text-xs text-secondary">
              {t('payLink.customMeta', {
                source: payLinkSource,
                amount: createdLink.amountRequested.toFixed(2),
                currency: createdLink.currency,
                expiresAt: formatDate(createdLink.expiresAt),
              })}
            </p>
          </div>
        ) : null}
      </div>

      <div className="rounded-site border border-stroke bg-card-bg p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <h2 className="text-lg font-semibold">{t('links.title')}</h2>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <Dropdown
            value={usageFilter}
            options={usageOptions}
            onChange={(value) => {
              setUsageFilter(value as '' | LinkStatus);
              setCurrentPage(1);
            }}
            className="w-full lg:w-48"
          />

          <Dropdown
            value={sourceFilter}
            options={sourceOptions}
            onChange={(value) => {
              setSourceFilter(value);
              setCurrentPage(1);
            }}
            className="w-full lg:w-40"
          />

          <Tooltip
            content={t('links.filters.refresh')}
            position={tooltipPosition}
          >
            <Button
              variant="icon-primary"
              size="custom"
              onClick={() => void fetchLinks()}
              aria-label={t('links.filters.refresh')}
            >
              <LuRefreshCcw size={18} />
            </Button>
          </Tooltip>
        </div>

        <Table
          columns={columns}
          data={links}
          loading={loading}
          emptyMessage={t('links.emptyMessage')}
        />

        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={setCurrentPage}
          hasNextPage={pagination.hasNextPage}
          hasPrevPage={pagination.hasPrevPage}
        />
      </div>

      <ConfirmModal {...deleteConfirmModalProps} />
    </div>
  );
}
