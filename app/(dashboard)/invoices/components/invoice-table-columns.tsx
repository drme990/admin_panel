'use client';

import { type ReactNode } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';

import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Checkbox from '@/components/ui/checkbox';
import { Order, InvoiceStatus } from '@/types/Order';
import { getPaymentMethodLabel } from '@/lib/order';

import type { InvoiceRow } from '../lib/invoice-utils';
import { isImageUrl, copyToClipboard, getNameLines, getReservationValue } from '../lib/invoice-utils';
import type { UploadFileType } from './invoice-upload-type-menu';
import InvoiceStatusCell, { STATUS_TEXT_COLORS } from './invoice-status-cell';
import { InvoiceUploadTypeMenu } from './invoice-upload-type-menu';

import {
  LuEye,
  LuPhone,
  LuCopy,
  LuRefreshCw,
  LuPencilLine,
  LuPenLine,
  LuBan,
  LuHistory,
  LuFileText,
  LuDownload,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';


interface ColumnCallbacks {
  onEdit: (invoice: InvoiceRow) => void;
  onPreview: (invoice: InvoiceRow) => void;
  onViewOrder: (order: Order) => void;
  onWhatsapp: (order: Order) => void;
  onCopyPhone: (order: Order) => void;
  onCopyMessage: (order: Order) => void;
  onChangeStatus: (order: Order) => void;
  onViewHistory: (order: Order) => void;
  onBlock: (order: Order) => void;
  onToggleSelect: (invoiceId: string) => void;
  onToggleSelectAll: () => void;
  selectedInvoiceIds: string[];
  allVisibleSelected: boolean;
  onEditPaymentMethod: (invoice: InvoiceRow) => void;
  onStatusChange: (invoice: InvoiceRow, status: InvoiceStatus) => void;
  onDownloadInvoice: (invoice: InvoiceRow) => void;
  onUploadInvoice: (invoice: InvoiceRow, type: UploadFileType) => void;
  uploadingInvoiceId: string | null;
  tooltipPos: 'left' | 'right';
  formatDate: (dateStr: string) => string;
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
  blockingOrderId: string | null;
  blockedUserIds: Set<string>;
}

export function useInvoiceColumns(callbacks: ColumnCallbacks) {
  const t = useTranslations('admin.invoices');
  const locale = useLocale();
  const {
    onEdit,
    onPreview,
    onViewOrder,
    onWhatsapp,
    onCopyPhone,
    onCopyMessage,
    onChangeStatus,
    onViewHistory,
    onBlock,
    onToggleSelect,
    onToggleSelectAll,
    selectedInvoiceIds,
    allVisibleSelected,
    onEditPaymentMethod,
    onStatusChange,
    onDownloadInvoice,
    onUploadInvoice,
    uploadingInvoiceId,
    tooltipPos,
    whatsappOrderId,
    copyingPhoneOrderId,
    copyingMessageOrderId,
    blockingOrderId,
    blockedUserIds,
  } = callbacks;

  const handleCopy = (text: string, successMsg: string) => {
    void copyToClipboard(text)
      .then(() => toast.success(successMsg))
      .catch(() => toast.error(t('copyFailed')));
  };

  return [
    // 1. Checkbox
    {
      header: (
        <Checkbox
          checked={allVisibleSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all visible invoices"
        />
      ) as ReactNode,
      accessor: (row: InvoiceRow) => (
        <Checkbox
          checked={selectedInvoiceIds.includes(row._id)}
          onChange={() => onToggleSelect(row._id)}
          onClick={(e) => e?.stopPropagation()}
          aria-label={`Select ${row.orderNumber}`}
        />
      ),
      className: 'w-12',
    },
    // 2. Counter
    {
      header: '#' as ReactNode,
      accessor: (_row: InvoiceRow, index?: number) => (
        <span className="text-sm font-semibold text-foreground">
          {(index ?? 0) + 1}
        </span>
      ),
      className: 'w-12',
    },
    // 3. Invoice status
    {
      header: t('colStatus'),
      accessor: (row: InvoiceRow) => (
        <InvoiceStatusCell invoice={row} onStatusChange={onStatusChange} />
      ),
      className: 'w-24',
    },
    // 4. Invoice preview
    {
      header: t('colPreview'),
      accessor: (row: InvoiceRow) => {
        const isUploading = uploadingInvoiceId === row._id;
        return (
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(row);
              }}
              className="flex items-center justify-center w-10 h-10 rounded-lg border border-stroke bg-background cursor-pointer hover:border-primary transition-colors"
              aria-label={t('preview')}
            >
              {isImageUrl(row.url) ? (
                // eslint-disable-next-line @next/next/no-img-element -- dynamic URL with onError hide fallback
                <img
                  src={row.url}
                  alt="Invoice"
                  className="w-8 h-8 object-cover rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <LuFileText size={18} className="text-secondary" />
              )}
            </button>
            <div className="flex items-center gap-1">
              <Tooltip position={tooltipPos} content={t('download')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-6 w-6 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadInvoice(row);
                  }}
                  aria-label={t('download')}
                >
                  <LuDownload size={14} />
                </Button>
              </Tooltip>
              {isUploading ? (
                <span className="inline-flex h-6 w-6 items-center justify-center">
                  <LuRefreshCw size={14} className="animate-spin text-secondary" />
                </span>
              ) : (
                <InvoiceUploadTypeMenu
                  onUpload={(type) => onUploadInvoice(row, type)}
                  disabled={isUploading}
                  tooltipPos={tooltipPos}
                  labels={{
                    tooltip: t('upload'),
                    uploadImage: t('uploadImage'),
                    uploadFile: t('uploadFile'),
                  }}
                />
              )}
            </div>
          </div>
        );
      },
      className: 'w-20',
    },
    // 5. Invoice value + payment method
    {
      header: t('colValue'),
      accessor: (row: InvoiceRow) => {
        const pmLabel = getPaymentMethodLabel(row.paymentMethod, locale as 'ar' | 'en');
        const statusColor = STATUS_TEXT_COLORS[row.invoiceStatus as InvoiceStatus] ?? 'text-foreground';
        return (
          <div className="flex flex-col gap-0.5 whitespace-nowrap">
            <div className="flex items-center gap-1">
              <span className={`text-lg font-bold ${statusColor}`}>
                {row.value.toFixed(2)} {row.invoiceCurrency}
              </span>
              <Tooltip position={tooltipPos} content={t('edit')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                  }}
                  aria-label={t('edit')}
                >
                  <LuPencilLine size={12} />
                </Button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1 border border-stroke rounded-xl px-2 py-1 w-fit">
              <span className={`text-xs ${statusColor}`}>
                {pmLabel || t('noPaymentMethod')}
              </span>
              <Tooltip position={tooltipPos} content={t('editPaymentMethod')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPaymentMethod(row);
                  }}
                  aria-label={t('editPaymentMethod')}
                >
                  <LuPencilLine size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
      className: 'min-w-28',
    },
    // 6. sacrificeFor + order number with copy buttons
    {
      header: t('colSacrificeFor'),
      accessor: (row: InvoiceRow) => {
        const names = getNameLines(getReservationValue(row.reservationData, 'sacrificeFor'));
        return (
          <div className="flex flex-col gap-1 min-w-48">
            <div className="flex items-center gap-1.5">
              <span className="font-medium leading-snug text-foreground">
                {names.length > 0 ? names[0] : '-'}
              </span>
              {names.length > 0 && (
                <Tooltip position={tooltipPos} content={t('copyName')}>
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(names.join(', '), t('copied'));
                    }}
                    aria-label={t('copyName')}
                  >
                    <LuCopy size={12} />
                  </Button>
                </Tooltip>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold whitespace-nowrap text-sm text-foreground">
                {row.orderNumber}
              </span>
              <Tooltip position={tooltipPos} content={t('copyOrderNumber')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(row.orderNumber, t('copied'));
                  }}
                  aria-label={t('copyOrderNumber')}
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
    // 7. Items with count
    {
      header: t('colItems'),
      accessor: (row: InvoiceRow) => {
        const items = row.items || [];
        if (items.length === 0) return <span className="text-secondary">-</span>;
        return (
          <div className="flex flex-col gap-1 min-w-52">
            {items.map((item, i) => {
              const qty = item.quantity || 1;
              const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
              return (
                <span key={i} className="text-sm font-medium text-foreground">
                  {qty > 1 ? `${qty} ${name}` : name}
                </span>
              );
            })}
            <div className="">
              <Tooltip position={tooltipPos} content={t('copyItems')}>
                <Button
                  variant="ghost"
                  size="custom"
                  className="h-5 w-5 p-0 text-secondary hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    const itemTexts = items.map((item) => {
                      const qty = item.quantity || 1;
                      const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
                      return qty > 1 ? `${qty} ${name}` : (name || '');
                    });
                    handleCopy(itemTexts.join('\n'), t('copied'));
                  }}
                  aria-label={t('copyItems')}
                >
                  <LuCopy size={12} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    // 8. Order actions (same as orders/execution page)
    {
      header: t('colActions'),
      accessor: (row: InvoiceRow) => {
        const order: Order = {
          _id: row.orderId,
          orderNumber: row.orderNumber,
          items: row.items,
          totalAmount: row.value,
          currency: row.currency,
          status: row.orderStatus as Order['status'],
          billingData: {
            fullName: row.customerName,
            email: row.customerEmail,
            phone: row.customerPhone,
            country: '',
          },
          userId: row.userId,
          isGuest: row.isGuest,
          statusUpdateTime: row.createdAt,
          source: row.source as Order['source'],
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        const isBlocked = !!order.userId && blockedUserIds.has(order.userId);
        return (
          <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2">
              <Tooltip position={tooltipPos} content={t('copyPhone')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); void onCopyPhone(order); }}
                  disabled={copyingPhoneOrderId === order._id}
                  aria-label={t('copyPhone')}
                >
                  {copyingPhoneOrderId === order._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuPhone size={16} />}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('copyMessage')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); void onCopyMessage(order); }}
                  disabled={copyingMessageOrderId === order._id}
                  aria-label={t('copyMessage')}
                >
                  {copyingMessageOrderId === order._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuCopy size={16} />}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('whatsapp')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onWhatsapp(order); }}
                  disabled={whatsappOrderId === order._id}
                  aria-label={t('whatsapp')}
                >
                  {whatsappOrderId === order._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <FaWhatsapp size={16} />}
                </Button>
              </Tooltip>

              {order.userId && isBlocked ? (
                <Tooltip position={tooltipPos} content={t('unblockCustomer')}>
                  <Button
                    variant="icon-danger"
                    size="custom"
                    onClick={(e) => { e.stopPropagation(); onBlock(order); }}
                    disabled={blockingOrderId === order._id}
                    aria-label={t('unblockCustomer')}
                  >
                    {blockingOrderId === order._id
                      ? <LuRefreshCw size={16} className="animate-spin" />
                      : <LuBan size={16} />}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip position={tooltipPos} content={t('blockCustomer')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => { e.stopPropagation(); onBlock(order); }}
                    disabled={blockingOrderId === order._id || order.isGuest || !order.userId}
                    aria-label={t('blockCustomer')}
                  >
                    {blockingOrderId === order._id
                      ? <LuRefreshCw size={16} className="animate-spin" />
                      : <LuBan size={16} />}
                  </Button>
                </Tooltip>
              )}
            </div>

            <div className="flex flex-row gap-2">
              <Tooltip position={tooltipPos} content={t('viewDetails')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onViewOrder(order); }}
                  aria-label={t('viewDetails')}
                >
                  <LuEye size={16} />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('changeStatus')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onChangeStatus(order); }}
                  aria-label={t('changeStatus')}
                >
                  <LuPenLine size={16} />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('orderHistory')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onViewHistory(order); }}
                  aria-label={t('orderHistory')}
                >
                  <LuHistory size={16} />
                </Button>
              </Tooltip>

            </div>
          </div>
        );
      },
      className: 'min-w-56',
    },
  ];
}
