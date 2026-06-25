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
  LuPalette,
  LuUpload,
  LuPencil,
  LuHistory,
  LuShare2,
  LuPenLine,
  LuBan,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Tooltip from '@/components/ui/tooltip';
import { Order, OrderStatus } from '@/types/Order';
import { STATUS_COLORS } from '../lib/order-status';

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

async function downloadImageDirectly(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

interface ColumnCallbacks {
  onView: (order: Order) => void;
  onWhatsapp: (order: Order) => void;
  onCopyPhone: (order: Order) => void;
  onCopyMessage: (order: Order) => void;
  onChangeExecutionDate: (order: Order) => void;
  onEditField: (order: Order, field: 'name' | 'items' | 'duaa' | 'photo') => void;
  onUploadPhoto: (order: Order) => void;
  onCopyPhotoUrl: (order: Order) => void;
  onChangeStatus: (order: Order) => void;
  onViewHistory: (order: Order) => void;
  onBlock: (order: Order) => void;
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  selectedOrderIds: string[];
  allVisibleSelected: boolean;
  tooltipPos: 'left' | 'right';
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
  uploadingPhotoOrderId: string | null;
  blockingOrderId: string | null;
  blockedUserIds: Set<string>;
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
    onEditField,
    onUploadPhoto,
    onCopyPhotoUrl,
    onChangeStatus,
    onViewHistory,
    onBlock,
    onToggleSelect,
    onToggleSelectAll,
    selectedOrderIds,
    allVisibleSelected,
    tooltipPos,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    uploadingPhotoOrderId,
    blockingOrderId,
    blockedUserIds,
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
      header: '#' as ReactNode,
      accessor: (_order: Order, index?: number) => (
        <span className="text-sm font-semibold text-foreground">
          {(index ?? 0) + 1}
        </span>
      ),
      className: 'w-12',
    },
    {
      header: t('table.sacrificeFor'),
      accessor: (order: Order) => {
        const names = getNameLines(getReservationValue(order, 'sacrificeFor'));
        if (names.length === 0) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        return (
          <div className='flex flex-col gap-1 min-w-48'>
            <div className="flex items-center gap-1.5">
              <span className={`font-medium leading-snug ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                {names[0]}
              </span>
              <Tooltip position={tooltipPos} content={t('table.copyName')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyToClipboard(names.join(', ')).then(() => toast.success(t('table.copied'))).catch(() => toast.error('Copy failed'));
                  }}
                  aria-label={t('table.copyName')}
                >
                  <LuCopy size={12} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.editName')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onEditField(order, 'name'); }}
                  aria-label={t('table.editName')}
                >
                  <LuPencil size={12} />
                </Button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold whitespace-nowrap text-sm ${order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                {order.orderNumber}
              </span>
              <Tooltip position={tooltipPos} content={t('table.copyOrderNumber')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyToClipboard(order.orderNumber).then(() => toast.success(t('table.copied'))).catch(() => toast.error('Copy failed'));
                  }}
                  aria-label={t('table.copyOrderNumber')}
                >
                  <LuCopy size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
      className: 'min-w-48',
    },
    {
      header: t('table.items'),
      accessor: (order: Order) => {
        const items = order.items || [];
        if (items.length === 0) return <span className={order.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-secondary'}>-</span>;
        const itemTexts = items.map((item) => {
          const qty = item.quantity || 1;
          const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
          return qty > 1 ? `${qty} ${name}` : (name || '');
        });
        return (
          <div className="flex flex-col gap-1 min-w-52">
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
            <div className="flex flex-row gap-1 self-start">
              <Tooltip position={tooltipPos} content={t('table.copyItems')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    void copyToClipboard(itemTexts.join('\n')).then(() => toast.success(t('table.copied'))).catch(() => toast.error('Copy failed'));
                  }}
                  aria-label={t('table.copyItems')}
                >
                  <LuCopy size={12} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.editItems')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onEditField(order, 'items'); }}
                  aria-label={t('table.editItems')}
                >
                  <LuPencil size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      header: t('table.photo'),
      accessor: (order: Order) => {
        const photoUrl = getReservationValue(order, 'photo');
        const hasPhoto = Boolean(photoUrl);
        const partialPaid = order.status === 'partial-paid';
        const iconColor = hasPhoto
          ? (partialPaid ? 'text-orange-600 dark:text-orange-400' : 'text-primary')
          : 'text-secondary/50';

        return (
          <div className="flex flex-col items-center gap-1">
            {hasPhoto ? (
              <Tooltip position={tooltipPos} content={t('table.viewPhoto')}>
                <a
                  href={photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className={`inline-flex items-center justify-center p-2 ${iconColor}`}
                >
                  <LuImage size={24} />
                </a>
              </Tooltip>
            ) : (
              <span className={`inline-flex items-center justify-center p-2 ${iconColor}`}>
                <LuImage size={24} />
              </span>
            )}
            <div className="flex flex-row gap-1">
              <Tooltip position={tooltipPos} content={t('table.uploadPhoto')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onUploadPhoto(order); }}
                  disabled={uploadingPhotoOrderId === order._id}
                  aria-label={t('table.uploadPhoto')}
                >
                  {uploadingPhotoOrderId === order._id ? (
                    <LuRefreshCw size={12} className="animate-spin" />
                  ) : (
                    <LuUpload size={12} />
                  )}
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.downloadPhoto')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (photoUrl) {
                      void downloadImageDirectly(photoUrl, `photo-${order.orderNumber}`)
                        .then(() => toast.success(t('table.downloaded')))
                        .catch(() => toast.error(t('messages.downloadFailed')));
                    }
                  }}
                  disabled={!hasPhoto}
                  aria-label={t('table.downloadPhoto')}
                >
                  <LuDownload size={12} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.sharePhoto')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onCopyPhotoUrl(order); }}
                  disabled={!hasPhoto}
                  aria-label={t('table.sharePhoto')}
                >
                  <LuShare2 size={12} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.editPhoto')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onEditField(order, 'photo'); }}
                  aria-label={t('table.editPhoto')}
                >
                  <LuPencil size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
      className: 'min-w-20',
    },
    {
      header: t('table.design'),
      accessor: () => (
        <div className="flex flex-col items-center gap-1">
          <span className="inline-flex items-center justify-center p-2 text-primary">
            <LuPalette size={24} />
          </span>
          <div className="flex flex-row gap-1">
            <Tooltip position={tooltipPos} content={t('table.uploadDesign')}>
              <Button
                variant="ghost"
                size="custom"
                className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                disabled
                aria-label={t('table.uploadDesign')}
              >
                <LuUpload size={12} />
              </Button>
            </Tooltip>
            <Tooltip position={tooltipPos} content={t('table.downloadDesign')}>
              <Button
                variant="ghost"
                size="custom"
                className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                disabled
                aria-label={t('table.downloadDesign')}
              >
                <LuDownload size={12} />
              </Button>
            </Tooltip>
            <Tooltip position={tooltipPos} content={t('table.editDesign')}>
              <Button
                variant="ghost"
                size="custom"
                className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                disabled
                aria-label={t('table.editDesign')}
              >
                <LuPencil size={12} />
              </Button>
            </Tooltip>
          </div>
        </div>
      ),
      className: 'min-w-16',
    },
    {
      header: t('table.shortDuaa'),
      accessor: (order: Order) => {
        const duaa = getReservationValue(order, 'shortDuaa');
        const hasDuaa = Boolean(duaa);
        const iconColor = hasDuaa ? 'text-primary' : 'text-secondary';
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`inline-flex items-center justify-center p-2 ${iconColor}`}>
              <LuHandHelping size={24} />
            </span>
            <div className="flex flex-row gap-1">
              <Tooltip position={tooltipPos} content={t('table.copyDuaa')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (duaa) {
                      void copyToClipboard(duaa).then(() => toast.success(t('table.copied'))).catch(() => toast.error('Copy failed'));
                    }
                  }}
                  disabled={!hasDuaa}
                  aria-label={t('table.copyDuaa')}
                >
                  <LuCopy size={12} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('table.editDuaa')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onEditField(order, 'duaa'); }}
                  aria-label={t('table.editDuaa')}
                >
                  <LuPencil size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
      className: 'min-w-16',
    },
    {
      header: t('table.paidAmount'),
      accessor: (order: Order) => {
        const displayedAmount =
          typeof order.paidAmount === 'number' ? order.paidAmount : order.totalAmount;
        const remaining = order.remainingAmount ?? 0;
        const hasRemaining = remaining > 0.001;
        return (
          <span
            className={`font-bold ${hasRemaining ? 'text-orange-600 dark:text-orange-400' : 'text-success'}`}
          >
            {displayedAmount.toFixed(2)} {order.currency}
          </span>
        );
      },
      className: 'min-w-24',
    },
    {
      header: t('table.remainingAmount'),
      accessor: (order: Order) => {
        const remaining = order.remainingAmount;

        if (order.status === 'processing') {
          return (
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[order.status]}`}>
              {t('status.processing')}
            </span>
          );
        }

        if (!remaining || remaining <= 0) {
          return (
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              {t('status.paid')}
            </span>
          );
        }

        return (
          <span className="font-bold text-orange-600 dark:text-orange-400">
            {remaining.toFixed(2)} {order.currency}
          </span>
        );
      },
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

            {order.userId && blockedUserIds.has(order.userId) ? (
              <Tooltip position={tooltipPos} content={t('table.unblockCustomer')}>
                <Button
                  variant="icon-danger"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onBlock(order); }}
                  disabled={blockingOrderId === order._id}
                  aria-label={t('table.unblockCustomer')}
                >
                  {blockingOrderId === order._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuBan size={16} />}
                </Button>
              </Tooltip>
            ) : (
              <Tooltip position={tooltipPos} content={t('table.blockCustomer')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onBlock(order); }}
                  disabled={blockingOrderId === order._id || order.isGuest || !order.userId}
                  aria-label={t('table.blockCustomer')}
                >
                  {blockingOrderId === order._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuBan size={16} />}
                </Button>
              </Tooltip>
            )}
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

            <Tooltip position={tooltipPos} content={t('table.changeStatus')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onChangeStatus(order); }}
                aria-label={t('table.changeStatus')}
              >
                <LuPenLine size={16} />
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('table.orderHistory')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onViewHistory(order); }}
                aria-label={t('table.orderHistory')}
              >
                <LuHistory size={16} />
              </Button>
            </Tooltip>
          </div>
        </div>
      ),
      className: 'min-w-64',
    },
  ];

  return columns;
}
