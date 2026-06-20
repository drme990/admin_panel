import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuHandHelping,
  LuImage,
  LuEye,
  LuPhone,
  LuCopy,
  LuCalendar,
  LuRefreshCw,
  LuDownload,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Tooltip from '@/components/ui/tooltip';
import { Order, OrderStatus } from '@/types/Order';

function getReservationValue(order: Order, key: string): string | undefined {
  return order.reservationData?.find((f) => f.key === key)?.value;
}

function getNameLines(value?: string): string[] {
  if (!value) return [];
  const normalized = value
    .replace(/\n/g, ',')
    .replace(/;/g, ',')
    .replace(/\r/g, ',');
  return normalized
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'partial-paid': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    ok ? resolve() : reject(new Error('Copy failed'));
  });
}

interface ColumnCallbacks {
  onView: (order: Order) => void;
  onWhatsapp: (order: Order) => void;
  onCopyPhone: (order: Order) => void;
  onCopyMessage: (order: Order) => void;
  onChangeExecutionDate: (order: Order) => void;
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  selectedOrderIds: string[];
  allVisibleSelected: boolean;
  tooltipPos: 'left' | 'right';
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
}

export function useExecutionColumns(callbacks: ColumnCallbacks) {
  const t = useTranslations('execution');
  const locale = useLocale();
  const {
    onView,
    onWhatsapp,
    onCopyPhone,
    onCopyMessage,
    onChangeExecutionDate,
    onToggleSelect,
    onToggleSelectAll,
    selectedOrderIds,
    allVisibleSelected,
    tooltipPos,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
  } = callbacks;

  const columns = [
    {
      header: (
        <Checkbox
          checked={allVisibleSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all visible orders"
        />
      ) as ReactNode,
      accessor: (order: Order) => (
        <Checkbox
          checked={selectedOrderIds.includes(order._id)}
          onChange={() => onToggleSelect(order._id)}
          onClick={(e) => e?.stopPropagation()}
          aria-label={`Select ${order.orderNumber}`}
        />
      ),
      className: 'w-12',
    },
    {
      header: t('table.orderNumber'),
      accessor: (order: Order) => (
        <span className={`font-semibold whitespace-nowrap ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {order.orderNumber}
        </span>
      ),
      className: 'min-w-32',
    },
    {
      header: t('table.sacrificeFor'),
      accessor: (order: Order) => {
        const names = getNameLines(getReservationValue(order, 'sacrificeFor'));
        if (names.length === 0) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        return (
          <span className={`font-medium leading-snug min-w-48 ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
            {names[0]}
          </span>
        );
      },
      className: 'min-w-48',
    },
    {
      header: t('table.items'),
      accessor: (order: Order) => {
        const items = order.items || [];
        if (items.length === 0) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        return (
          <div className="flex flex-col gap-1 min-w-64">
            {items.map((item, i) => {
              const qty = item.quantity || 1;
              const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
              return (
                <span
                  key={i}
                  className={`text-sm font-medium ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}
                >
                  {qty > 1 ? `${qty} ${name}` : name}
                </span>
              );
            })}
          </div>
        );
      },
    },
    {
      header: t('table.intention'),
      accessor: (order: Order) => (
        <span className={`text-sm ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {getReservationValue(order, 'intention') || '-'}
        </span>
      ),
      className: 'min-w-28',
    },
    {
      header: t('table.gender'),
      accessor: (order: Order) => (
        <span className={`text-sm ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {getReservationValue(order, 'gender') || '-'}
        </span>
      ),
      className: 'min-w-20',
    },
    {
      header: t('table.isAlive'),
      accessor: (order: Order) => (
        <span className={`text-sm ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {getReservationValue(order, 'isAlive') || '-'}
        </span>
      ),
      className: 'min-w-20',
    },
    {
      header: t('table.shortDuaa'),
      accessor: (order: Order) => {
        const duaa = getReservationValue(order, 'shortDuaa');
        if (!duaa) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        return (
          <Tooltip position={tooltipPos} content={t('table.copyDuaa')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                void copyToClipboard(duaa).then(() => toast.success(t('table.copied'))).catch(() => toast.error('Copy failed'));
              }}
              aria-label={t('table.copyDuaa')}
            >
              <LuHandHelping size={16} />
            </Button>
          </Tooltip>
        );
      },
      className: 'min-w-16',
    },
    {
      header: t('table.photo'),
      accessor: (order: Order) => {
        const photoUrl = getReservationValue(order, 'photo');
        if (!photoUrl) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        return (
          <Tooltip position={tooltipPos} content="View Photo">
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-500'}`}
            >
              <LuImage size={16} />
            </a>
          </Tooltip>
        );
      },
      className: 'min-w-16',
    },
    {
      header: t('table.total'),
      accessor: (order: Order) => (
        <span className={`font-semibold whitespace-nowrap ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
          {order.totalAmount?.toLocaleString()} {order.currency}
        </span>
      ),
      className: 'min-w-24',
    },
    {
      header: t('table.actions'),
      accessor: (order: Order) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            <Tooltip position={tooltipPos} content={t('table.copyPhone')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); void onCopyPhone(order); }}
                disabled={copyingPhoneOrderId === order._id}
                aria-label={t('table.copyPhone')}
              >
                {copyingPhoneOrderId === order._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <LuPhone size={16} />}
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('table.copyMessage')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); void onCopyMessage(order); }}
                disabled={copyingMessageOrderId === order._id}
                aria-label={t('table.copyMessage')}
              >
                {copyingMessageOrderId === order._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <LuCopy size={16} />}
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('table.whatsapp')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onWhatsapp(order); }}
                disabled={whatsappOrderId === order._id}
                aria-label={t('table.whatsapp')}
              >
                {whatsappOrderId === order._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <FaWhatsapp size={16} />}
              </Button>
            </Tooltip>
          </div>

          <div className="flex flex-row gap-2">
            <Tooltip position={tooltipPos} content={t('table.viewDetails')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onView(order); }}
                aria-label={t('table.viewDetails')}
              >
                <LuEye size={16} />
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('table.changeExecutionDate')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onChangeExecutionDate(order); }}
                aria-label={t('table.changeExecutionDate')}
              >
                <LuCalendar size={16} />
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content="Download Design (Coming Soon)">
              <Button
                variant="icon-primary"
                size="custom"
                disabled
                aria-label="Download Design"
              >
                <LuDownload size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>
      ),
      className: 'min-w-56',
    },
  ];

  return columns;
}
