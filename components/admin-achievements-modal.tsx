'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LuPhoneCall, LuCircleCheck } from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Loading from '@/components/ui/loading';
import { toast } from 'react-toastify';

interface AchievementOrder {
  _id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  amount: number;
  currency: string;
}

interface AdminAchievementRow {
  _id: string;
  customerKey: string;
  status: 'talking' | 'paid';
  claimedAt: string;
  paidAt?: string;
  customer: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
  };
  reservationName?: string;
  order?: AchievementOrder;
}

interface AdminAchievementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  admin: { _id: string; name: string } | null;
  /** Active booking-intent filters — the modal shows only the displayed
   * rows this admin owns, matching the stats table exactly. */
  query?: string;
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
}

export default function AdminAchievementsModal({
  isOpen,
  onClose,
  admin,
  query = '',
}: AdminAchievementsModalProps) {
  const t = useTranslations('admin.users.achievementsModal');
  // rows === null → loading (or not yet fetched). Tagged with adminId so
  // switching admins never shows the previous admin's data.
  const [result, setResult] = useState<{
    adminId: string;
    rows: AdminAchievementRow[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isOpen || !admin) return;
    let cancelled = false;
    fetch(`/api/users/${admin._id}/achievements?${query}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setResult({ adminId: admin._id, rows: data.data.achievements || [] });
        } else {
          setFailed(true);
          toast.error(data.error || t('loadError'));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        toast.error(t('loadError'));
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, admin, query, t]);

  const rows = result && result.adminId === admin?._id ? result.rows : null;
  const loading = rows === null && !failed;

  const talkingCount = (rows ?? []).filter((r) => r.status === 'talking').length;
  const paidCount = (rows ?? []).filter((r) => r.status === 'paid').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('title', { name: admin?.name ?? '' })}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center py-10">
          <Loading />
        </div>
      ) : !rows || rows.length === 0 ? (
        <p className="text-center text-secondary py-10">{t('empty')}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 text-warning px-3 py-1 font-medium">
              <LuPhoneCall size={14} />
              {t('talking')}: {talkingCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 text-success px-3 py-1 font-medium">
              <LuCircleCheck size={14} />
              {t('paid')}: {paidCount}
            </span>
          </div>

          <div className="space-y-2">
            {rows.map((row) => {
              const name =
                row.customer.fullName ||
                row.reservationName ||
                row.customerKey;
              return (
                <div
                  key={row._id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-stroke p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {name}
                      </span>
                      {row.order?.orderNumber && (
                        <span className="font-mono text-xs text-secondary">
                          #{row.order.orderNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-secondary space-x-2 rtl:space-x-reverse">
                      {row.customer.phone && <span>{row.customer.phone}</span>}
                      {row.customer.email && <span>{row.customer.email}</span>}
                    </div>
                    <div className="text-xs text-secondary">
                      {t('claimedAt')}: {formatDateTime(row.claimedAt)}
                      {row.paidAt && (
                        <>
                          {' · '}
                          {t('paidAt')}: {formatDateTime(row.paidAt)}
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${row.status === 'paid'
                      ? 'bg-success/15 text-success'
                      : 'bg-warning/15 text-warning'
                      }`}
                  >
                    {row.status === 'paid' ? (
                      <LuCircleCheck size={13} />
                    ) : (
                      <LuPhoneCall size={13} />
                    )}
                    {row.status === 'paid' ? t('paid') : t('talking')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
