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
  LuUpload,
  LuFileArchive,
} from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa6';

import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Checkbox from '@/components/ui/checkbox';
import { Order, InvoiceStatus } from '@/types/Order';
import { getPaymentMethodLabel } from '@/lib/order';

import type { InvoiceRow } from '../lib/invoice-utils';
import {
  isImageUrl,
  copyToClipboard,
  getNameLines,
  getReservationValue,
} from '../lib/invoice-utils';
import InvoiceStatusCell, { STATUS_TEXT_COLORS } from './invoice-status-cell';
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
  onUploadInvoice: (invoice: InvoiceRow) => void;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-full flex flex-col"
          >
            <div className="rounded-lg border-2 border-stroke bg-card-bg animate-pulse flex flex-col overflow-hidden h-full">
              <div className="relative aspect-square rounded-t-lg bg-foreground/10 shrink-0">
                <div className="absolute top-2 inset-s-2 flex flex-row gap-1">
                  <div className="w-7 h-7 rounded-md bg-foreground/10" />
                  <div className="w-7 h-7 rounded-md bg-foreground/10" />
                  <div className="w-7 h-7 rounded-md bg-foreground/10" />
                </div>
                <div className="absolute top-2 inset-e-2 w-7 h-7 rounded bg-foreground/10" />
              </div>
              <div className="px-2 py-2 sm:py-3 h-12 sm:h-14 border-y-2 border-stroke bg-foreground/5 shrink-0" />
              <div className="px-2 py-2 sm:py-3 flex flex-col gap-2 flex-1">
                <div className="h-4 w-24 rounded bg-foreground/10" />
                <div className="h-4 w-32 rounded bg-foreground/10" />
              </div>
            </div>
            <div className="w-full grid grid-cols-4 gap-2 p-2 sm:p-3">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="h-8 sm:h-9 rounded bg-foreground/10" />
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
    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {invoices.map((row) => {
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
            <div className="relative rounded-lg border-2 border-stroke bg-card-bg flex flex-col h-full">
              {/* Preview with absolute icons and checkbox */}
              <div className="overflow-hidden aspect-square rounded-t-lg shrink-0">
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
                  <LuFileText size={48} className="text-secondary" />
                )}

                {/* 3 icons on the leading side of the image */}
                <div className="absolute top-2 inset-s-2 flex flex-row gap-1">
                  <Tooltip position={tooltipPos} content={t('download')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadInvoice(row);
                      }}
                      aria-label={t('download')}
                    >
                      <LuDownload size={14} />
                    </Button>
                  </Tooltip>
                  <Tooltip position={tooltipPos} content={t('upload')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUploadInvoice(row);
                      }}
                      aria-label={t('upload')}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <LuRefreshCw size={14} className="animate-spin" />
                      ) : (
                        <LuUpload size={14} />
                      )}
                    </Button>
                  </Tooltip>
                  <Tooltip position={tooltipPos} content={t('preview')}>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-6 w-6 sm:h-7 sm:w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(row);
                      }}
                      aria-label={t('preview')}
                    >
                      <LuEye size={14} />
                    </Button>
                  </Tooltip>
                </div>

                {/* Checkbox on the trailing side of the image */}
                <div
                  className="absolute top-2 inset-e-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rounded-md bg-background/80 backdrop-blur-sm border border-stroke p-1">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => onToggleSelect(row._id)}
                      aria-label={`Select ${row.orderNumber}`}
                    />
                  </div>
                </div>
              </div>

              {/* Value + payment method */}
              <div className="px-2 py-2 sm:py-3 flex items-center justify-between gap-2 border-y-2 rounded-b-xl border-stroke shrink-0">
                <span className={`text-sm sm:text-base font-bold whitespace-nowrap ${statusColor}`}>
                  {row.value.toFixed(2)} {row.invoiceCurrency}
                </span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className={`text-xs sm:text-sm truncate ${statusColor}`}>
                    {pmLabel || t('noPaymentMethod')}
                  </span>
                  <Tooltip
                    position={tooltipPos}
                    content={t('editPaymentMethod')}
                  >
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 p-0 text-foreground hover:text-success shrink-0"
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

              {/* Status + name + order number */}
              <div className="flex items-center justify-between gap-2 px-2 py-2 sm:py-3 flex-1">
                <InvoiceStatusCell
                  invoice={row}
                  onStatusChange={onStatusChange}
                />
                <div className="flex flex-col gap-0.5 sm:gap-1 min-w-0 items-end">
                  <div className="flex items-center gap-1.5 max-w-full">
                    <span className="font-medium leading-snug text-foreground text-xs sm:text-sm line-clamp-2">
                      {firstName}
                    </span>
                    {names.length > 0 && (
                      <Tooltip position={tooltipPos} content={t('copyName')}>
                        <Button
                          variant="ghost"
                          size="custom"
                          className="h-5 w-5 p-0 text-secondary hover:text-foreground shrink-0"
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
                    <span className="font-semibold whitespace-nowrap text-xs sm:text-sm text-foreground">
                      {row.orderNumber}
                    </span>
                    <Tooltip
                      position={tooltipPos}
                      content={t('copyOrderNumber')}
                    >
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-5 w-5 p-0 text-secondary hover:text-foreground shrink-0"
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
              </div>
            </div>

            {/* Actions footer: down the card, separated from the body */}
            <div className="w-full grid grid-cols-4 gap-2 p-2 sm:p-3">
              <Tooltip position={tooltipPos} content={t('copyPhone')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCopyPhone(order);
                  }}
                  disabled={copyingPhoneOrderId === order._id}
                  aria-label={t('copyPhone')}
                >
                  {copyingPhoneOrderId === order._id ? (
                    <LuRefreshCw size={16} className="animate-spin" />
                  ) : (
                    <LuPhone size={16} />
                  )}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('copyMessage')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onCopyMessage(order);
                  }}
                  disabled={copyingMessageOrderId === order._id}
                  aria-label={t('copyMessage')}
                >
                  {copyingMessageOrderId === order._id ? (
                    <LuRefreshCw size={16} className="animate-spin" />
                  ) : (
                    <LuCopy size={16} />
                  )}
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('whatsapp')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWhatsapp(order);
                  }}
                  disabled={whatsappOrderId === order._id}
                  aria-label={t('whatsapp')}
                >
                  {whatsappOrderId === order._id ? (
                    <LuRefreshCw size={16} className="animate-spin" />
                  ) : (
                    <FaWhatsapp size={16} />
                  )}
                </Button>
              </Tooltip>

              {order.userId && isBlocked ? (
                <Tooltip position={tooltipPos} content={t('unblockCustomer')}>
                  <Button
                    variant="icon-danger"
                    size="custom"
                    className="h-8 w-full sm:h-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBlock(order);
                    }}
                    disabled={blockingOrderId === order._id}
                    aria-label={t('unblockCustomer')}
                  >
                    {blockingOrderId === order._id ? (
                      <LuRefreshCw size={16} className="animate-spin" />
                    ) : (
                      <LuBan size={16} />
                    )}
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip position={tooltipPos} content={t('blockCustomer')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    className="h-8 w-full sm:h-9"
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
                      <LuRefreshCw size={16} className="animate-spin" />
                    ) : (
                      <LuBan size={16} />
                    )}
                  </Button>
                </Tooltip>
              )}

              <Tooltip position={tooltipPos} content={t('viewDetails')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOrder(order);
                  }}
                  aria-label={t('viewDetails')}
                >
                  <LuEye size={16} />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('changeStatus')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus(order);
                  }}
                  aria-label={t('changeStatus')}
                >
                  <LuPenLine size={16} />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('orderHistory')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewHistory(order);
                  }}
                  aria-label={t('orderHistory')}
                >
                  <LuHistory size={16} />
                </Button>
              </Tooltip>

              <Tooltip position={tooltipPos} content={t('edit')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  className="h-8 w-full sm:h-9"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                  }}
                  aria-label={t('edit')}
                >
                  <LuFileArchive size={16} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
