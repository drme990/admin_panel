'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Table from '@/components/ui/table';
import { toast } from 'react-toastify';

interface CategoryOrderItem {
  productId: string;
  productName: { ar: string; en: string };
  quantity: number;
}

interface AchievementRow {
  _id: string;
  customerKey: string;
  customer: { fullName: string; email: string; phone: string };
  reservationName?: string;
  order?: {
    _id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
    amount: number;
    currency: string;
    items?: CategoryOrderItem[];
  };
}

export interface CategoryRef {
  /** null → uncategorized bucket */
  id: string | null;
  name: string | null;
  color: string;
  products: { id: string }[];
}

interface AdminCategoryOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: { _id: string; name: string } | null;
  category: CategoryRef | null;
  /** Active booking-intent filters (same query string as the stats). */
  query?: string;
}

/**
 * "Orders in this category" modal for the achievement cards — mirrors
 * the execution-page category modal: rows fetched under the same
 * filters, grouped by product, each group rendered as a small table.
 */
export default function AdminCategoryOrdersModal({
  isOpen,
  onClose,
  admin,
  category,
  query = '',
}: AdminCategoryOrdersModalProps) {
  const te = useTranslations('execution');
  const t = useTranslations('admin.bookingIntent');
  const locale = useLocale();
  const [result, setResult] = useState<{
    key: string;
    rows: AchievementRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const categoryId = category?.id ?? '__uncategorized__';
  const fetchKey = `${admin?._id}:${categoryId}:${query}`;

  useEffect(() => {
    if (!isOpen || !admin || !category) return;
    let cancelled = false;
    const params = new URLSearchParams(query);
    params.set('category', categoryId);
    fetch(`/api/users/${admin._id}/achievements?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setResult({ key: fetchKey, rows: data.data.achievements || [] });
        } else {
          setFailed(true);
          toast.error(data.error || te('messages.loadFailed'));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        toast.error(te('messages.loadFailed'));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchKey, t]);

  const rows = result && result.key === fetchKey ? result.rows : null;
  const loading = rows === null && !failed;

  // Only items that belong to the clicked category.
  const productIds = useMemo(
    () => new Set((category?.products ?? []).map((p) => p.id)),
    [category],
  );

  const groups = useMemo(() => {
    const map = new Map<string, AchievementRow[]>();
    for (const row of rows ?? []) {
      const items = row.order?.items ?? [];
      const matching = items.filter((it) => productIds.has(it.productId));
      const first = matching[0] ?? items[0];
      const name = first
        ? (locale === 'ar' ? first.productName?.ar : first.productName?.en) ||
        first.productName?.en ||
        first.productName?.ar ||
        te('stats.uncategorized')
        : te('stats.uncategorized');
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(row);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, categoryId, productIds, locale]);

  const title = category
    ? category.name ?? te('stats.uncategorized')
    : '';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {loading ? (
          <div className="py-10 text-center text-sm text-secondary">
            {t('loading')}
          </div>
        ) : !rows || rows.length === 0 ? (
          <div className="py-8 text-center text-secondary">
            {te('emptyMessage')}
          </div>
        ) : (
          groups.map(([productName, groupRows]) => (
            <div
              key={productName}
              className="bg-card-bg border border-stroke rounded-site overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-stroke">
                <h4 className="font-semibold text-sm">{productName}</h4>
                <span className="text-xs text-secondary bg-card-bg border border-stroke rounded-full px-2.5 py-1">
                  {groupRows.length} {te('ordersCount')}
                </span>
              </div>
              <Table<AchievementRow>
                columns={[
                  {
                    header: te('table.orderNumber'),
                    accessor: (row) => (
                      <span className="font-semibold">
                        {row.order?.orderNumber || '-'}
                      </span>
                    ),
                    className: 'min-w-28',
                  },
                  {
                    header: te('table.sacrificeFor'),
                    accessor: (row) => (
                      <span>
                        {row.customer.fullName ||
                          row.reservationName ||
                          row.customerKey ||
                          '-'}
                      </span>
                    ),
                    className: 'min-w-40',
                  },
                  {
                    header: te('table.count'),
                    accessor: (row) => {
                      const matching = (row.order?.items ?? []).filter(
                        (it) => productIds.has(it.productId),
                      );
                      const count = matching.reduce(
                        (s, it) => s + (it.quantity || 1),
                        0,
                      );
                      return (
                        <span className="font-semibold">
                          {count || '-'}
                        </span>
                      );
                    },
                    className: 'w-16',
                  },
                  {
                    header: te('table.items'),
                    accessor: (row) => {
                      const matching = (row.order?.items ?? []).filter(
                        (it) => productIds.has(it.productId),
                      );
                      if (matching.length === 0)
                        return <span className="text-secondary">-</span>;
                      return (
                        <div className="flex flex-col gap-0.5">
                          {matching.map((it, i) => (
                            <span
                              key={i}
                              className="text-sm text-foreground"
                            >
                              {(locale === 'ar'
                                ? it.productName?.ar
                                : it.productName?.en) ||
                                it.productName?.en ||
                                it.productName?.ar}
                              {it.quantity > 1 ? ` ×${it.quantity}` : ''}
                            </span>
                          ))}
                        </div>
                      );
                    },
                    className: 'min-w-40',
                  },
                  {
                    header: t('colAmount'),
                    accessor: (row) => (
                      <span className="font-medium">
                        {row.order
                          ? `${row.order.amount.toLocaleString()} ${row.order.currency}`
                          : '-'}
                      </span>
                    ),
                    className: 'w-28',
                  },
                ]}
                data={groupRows}
                loading={false}
              />
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
