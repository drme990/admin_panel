'use client';

import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
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
  LuTrash2,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Checkbox from '@/components/ui/checkbox';
import { Order, InvoiceStatus } from '@/types/Order';
import { getPaymentMethodLabel } from '@/lib/order';
import { cn } from '@/lib/utils';

import type { InvoiceRow } from '../lib/invoice-utils';
import {
  isImageUrl,
  copyToClipboard,
  getNameLines,
  getReservationValue,
} from '../lib/invoice-utils';
import InvoiceStatusCell, { STATUS_TEXT_COLORS } from './invoice-status-cell';
import { InvoiceUploadTypeMenu, type UploadFileType } from './invoice-upload-type-menu';
import Image from 'next/image';

interface InvoiceCardViewProps {
  invoices: InvoiceRow[];
  loading: boolean;
  emptyMessage: string;
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
  selectedInvoiceIds: string[];
  onEditPaymentMethod: (invoice: InvoiceRow) => void;
  onStatusChange: (invoice: InvoiceRow, status: InvoiceStatus) => void;
  onDownloadInvoice: (invoice: InvoiceRow) => void;
  onUploadInvoice: (invoice: InvoiceRow, type: UploadFileType) => void;
  onDelete: (invoice: InvoiceRow) => void;
  uploadingInvoiceId: string | null;
  tooltipPos: 'left' | 'right';
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
  blockingOrderId: string | null;
  blockedUserIds: Set<string>;
}

function buildOrderFromInvoice(row: InvoiceRow): Order {
  return {
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
}

export default function InvoiceCardView({
  invoices,
  loading,
  emptyMessage,
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
  selectedInvoiceIds,
  onEditPaymentMethod,
  onStatusChange,
  onDownloadInvoice,
  onUploadInvoice,
  onDelete,
  uploadingInvoiceId,
  tooltipPos,
  whatsappOrderId,
  copyingPhoneOrderId,
  copyingMessageOrderId,
  blockingOrderId,
  blockedUserIds,
}: InvoiceCardViewProps) {
  const t = useTranslations('admin.invoices');
  const locale = useLocale();

  const handleCopy = (text: string, successMsg: string) => {
    void copyToClipboard(text)
      .then(() => toast.success(successMsg))
      .catch(() => toast.error(t('copyFailed')));
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-full flex flex-col"
          >
            <div className="rounded-lg border-2 border-stroke bg-card-bg animate-pulse flex flex-col overflow-hidden h-full">
              <div className="relative aspect-square rounded-t-lg bg-foreground/10 shrink-0">
                <div className="absolute top-2 inset-s-2 flex flex-row gap-1">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-foreground/10" />
                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-foreground/10" />
                </div>
                <div className="absolute top-2 inset-e-2 w-5 h-5 sm:w-6 sm:h-6 rounded bg-foreground/10" />
                <div className="absolute bottom-2 right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-foreground/10" />
              </div>
              <div className="px-2 py-2 h-10 sm:h-12 border-y border-stroke bg-foreground/5 shrink-0" />
              <div className="px-2 py-1.5 sm:py-2 flex flex-col gap-1 flex-1">
                <div className="h-3 sm:h-4 w-24 rounded bg-foreground/10" />
                <div className="h-3 sm:h-4 w-32 rounded bg-foreground/10" />
              </div>
            </div>
            <div className="w-full flex flex-col gap-1 p-2 sm:p-3">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-7 sm:h-8 rounded bg-foreground/10" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!loading && invoices.length === 0) {
    return (
      <div className="rounded-lg border border-stroke bg-background p-8 text-center text-secondary">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {invoices.map((row, index) => {
        const order = buildOrderFromInvoice(row);
        const isUploading = uploadingInvoiceId === row._id;
        const isSelected = selectedInvoiceIds.includes(row._id);
        const isBlocked = !!order.userId && blockedUserIds.has(order.userId);
        const names = getNameLines(
          getReservationValue(row.reservationData, 'sacrificeFor'),
        );
        const firstName = names.length > 0 ? names[0] : '-';

        const pmLabel = getPaymentMethodLabel(
          row.paymentMethod,
          locale as 'ar' | 'en',
        );
        const statusColor = STATUS_TEXT_COLORS[row.invoiceStatus as InvoiceStatus] ?? 'text-foreground';

        return (
          <div key={row._id} className="flex flex-col h-full">
            {/* Card body */}
            <div className="rounded-lg border-2 border-stroke bg-card-bg flex flex-col h-full">
              {/* Preview with absolute icons and checkbox */}
              <div className='relative'>
                <div className="overflow-hidden aspect-square rounded-t-lg shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(row);
                    }}
                    className="w-full h-full cursor-pointer"
                    aria-label={t('preview')}
                  >
                    {isImageUrl(row.url) ? (
                      <Image
                        src={row.url}
                        alt="Invoice"
                        className="object-cover object-center w-full h-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        width={400}
                        height={400}
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <LuFileText size={48} className="text-secondary" />
                      </div>
                    )}
                  </button>
                </div>

                {/* 2 icons on the leading side of the image */}
                <div className="absolute top-2 inset-s-2 flex flex-row gap-1">
                  <Tooltip position={tooltipPos} content={t('download')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 sm:h-6 sm:w-6 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadInvoice(row);
                      }}
                      aria-label={t('download')}
                    >
                      <LuDownload className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </Tooltip>
                  {isUploading ? (
                    <span className="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md bg-background/80 backdrop-blur-sm border border-stroke">
                      <LuRefreshCw className="animate-spin text-secondary w-3 h-3 sm:w-3.5 sm:h-3.5" />
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
                      className="h-5 w-5 sm:h-6 sm:w-6 rounded-md bg-background/80 backdrop-blur-sm border border-stroke"
                    />
                  )}
                  {row.invoiceStatus !== 'deleted' && (
                    <Tooltip position={tooltipPos} content={t('delete')}>
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-5 w-5 sm:h-6 sm:w-6 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-error border border-stroke"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(row);
                        }}
                        aria-label={t('delete')}
                      >
                        <LuTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </Button>
                    </Tooltip>
                  )}
                </div>

                {/* Checkbox on the trailing side of the image */}
                <div
                  className="absolute top-2 inset-e-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onChange={() => onToggleSelect(row._id)}
                    aria-label={`Select ${row.orderNumber}`}
                  />
                </div>

                {/* Counter */}
                <div className="absolute bottom-2 left-2 z-10 flex h-5 min-w-5 sm:h-6 sm:min-w-6 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-stroke px-1 sm:px-1.5 text-[10px] sm:text-xs font-bold text-foreground">
                  {index + 1}
                </div>

                {/* Status */}
                <div className='absolute bottom-2 right-2 z-10'>
                  <InvoiceStatusCell
                    invoice={row}
                    onStatusChange={onStatusChange}
                  />
                </div>
              </div>

              {/* Value + payment method */}
              <div className="px-2 py-2 flex flex-col gap-1 border-y border-stroke bg-background/50 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-sm sm:text-base md:text-lg font-bold whitespace-nowrap', statusColor)}>
                    {row.value.toFixed(2)} {row.invoiceCurrency}
                  </span>
                  <Tooltip position={tooltipPos} content={t('edit')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-secondary hover:text-success shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(row);
                      }}
                      aria-label={t('edit')}
                    >
                      <LuPencilLine className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border border-stroke bg-card-bg truncate',
                      statusColor,
                    )}
                  >
                    {pmLabel || t('noPaymentMethod')}
                  </span>
                  <Tooltip position={tooltipPos} content={t('editPaymentMethod')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 sm:h-6 sm:w-6 p-0 text-secondary hover:text-success shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditPaymentMethod(row);
                      }}
                      aria-label={t('editPaymentMethod')}
                    >
                      <LuPencilLine className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* name + order number */}
              <div className="flex flex-col gap-1 px-2 py-1.5 sm:py-2 flex-1 overflow-hidden">
                <div className="flex items-center gap-1 max-w-full">
                  <span className="font-medium leading-snug text-foreground text-xs sm:text-sm line-clamp-2">
                    {firstName}
                  </span>
                  {names.length > 0 && (
                    <Tooltip position={tooltipPos} content={t('copyName')}>
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-4 w-4 sm:h-5 sm:w-5 p-0 text-secondary hover:text-foreground shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(names.join(', '), t('copied'));
                        }}
                        aria-label={t('copyName')}
                      >
                        <LuCopy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </Button>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-semibold whitespace-nowrap text-[8px] xs:text-[10px] sm:text-sm text-foreground">
                    {row.orderNumber}
                  </span>
                  <Tooltip position={tooltipPos} content={t('copyOrderNumber')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-4 w-4 sm:h-5 sm:w-5 p-0 text-secondary hover:text-foreground shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(row.orderNumber, t('copied'));
                      }}
                      aria-label={t('copyOrderNumber')}
                    >
                      <LuCopy className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>

            {/* Actions footer: down the card, separated from the body */}
            <div className="w-full grid grid-cols-4 gap-2 p-2 sm:p-3">
              <Tooltip position={tooltipPos} content={t('copyPhone')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCopyPhone(order);
                  }}
                  disabled={copyingPhoneOrderId === order._id}
                  aria-label={t('copyPhone')}
                >
                  {copyingPhoneOrderId === order._id ? (
                    <LuRefreshCw className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <LuPhone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('copyMessage')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCopyMessage(order);
                  }}
                  disabled={copyingMessageOrderId === order._id}
                  aria-label={t('copyMessage')}
                >
                  {copyingMessageOrderId === order._id ? (
                    <LuRefreshCw className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <LuCopy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('whatsapp')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWhatsapp(order);
                  }}
                  disabled={whatsappOrderId === order._id}
                  aria-label={t('whatsapp')}
                >
                  {whatsappOrderId === order._id ? (
                    <LuRefreshCw className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <FaWhatsapp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                </Button>
              </Tooltip>

              {order.userId && isBlocked ? (
                <Tooltip position={tooltipPos} content={t('unblockCustomer')}>
                  <Button
                    variant="icon-danger"
                    size="custom"
                    className="h-7 w-full sm:h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock(order);
                    }}
                    disabled={blockingOrderId === order._id}
                    aria-label={t('unblockCustomer')}
                  >
                    {blockingOrderId === order._id ? (
                      <LuRefreshCw className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <LuBan className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip position={tooltipPos} content={t('blockCustomer')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    className="h-7 w-full sm:h-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock(order);
                    }}
                    disabled={
                      blockingOrderId === order._id ||
                      order.isGuest ||
                      !order.userId
                    }
                    aria-label={t('blockCustomer')}
                  >
                    {blockingOrderId === order._id ? (
                      <LuRefreshCw className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                      <LuBan className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                </Tooltip>
              )}

              <Tooltip position={tooltipPos} content={t('viewDetails')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOrder(order);
                  }}
                  aria-label={t('viewDetails')}
                >
                  <LuEye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('changeStatus')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus(order);
                  }}
                  aria-label={t('changeStatus')}
                >
                  <LuPenLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('orderHistory')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-7 w-full sm:h-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewHistory(order);
                  }}
                  aria-label={t('orderHistory')}
                >
                  <LuHistory className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </Tooltip>

            </div>
          </div>
        );
      })}
    </div>
  );
}
