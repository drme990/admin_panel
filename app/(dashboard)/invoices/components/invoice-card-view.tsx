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
import InvoiceStatusCell from './invoice-status-cell';
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-stroke bg-background p-4 animate-pulse"
          >
            <div className="relative aspect-video rounded-lg bg-foreground/10">
              <div className="absolute top-2 inset-s-2 flex flex-col gap-1">
                <div className="w-7 h-7 rounded-md bg-foreground/10" />
                <div className="w-7 h-7 rounded-md bg-foreground/10" />
                <div className="w-7 h-7 rounded-md bg-foreground/10" />
              </div>
              <div className="absolute top-2 inset-s-2 w-5 h-5 rounded bg-foreground/10" />
            </div>
            <div className="mt-3 h-4 w-24 rounded bg-foreground/10" />
            <div className="mt-2 h-4 w-32 rounded bg-foreground/10" />
            <div className="mt-3 h-8 rounded bg-foreground/10" />
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

        return (
          <div key={row._id} className="flex flex-col">
            {/* Card body */}
            <div className="relative rounded-lg border-2 border-success bg-card-bg flex flex-col">
              {/* Preview with absolute icons and checkbox */}
              <div className="overflow-hidden aspect-2/2 rounded-t-lg">
                {isImageUrl(row.url) ? (
                  <Image
                    src={row.url}
                    alt="Invoice"
                    className="object-cover object-center aspect-2/2"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    width={400}
                    height={600}
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
                      className="h-7 w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
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
                      className="h-7 w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
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
                      className="h-7 w-7 p-0 rounded-md bg-background/80 backdrop-blur-sm text-secondary hover:text-foreground border border-stroke"
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
              <div className="px-2 py-3 flex items-center justify-between gap-2 border-y-2 rounded-b-xl border-success">
                <span className="text-base font-bold text-foreground whitespace-nowrap">
                  {row.value.toFixed(2)} {row.invoiceCurrency}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-foreground">
                    {pmLabel || t('noPaymentMethod')}
                  </span>
                  <Tooltip
                    position={tooltipPos}
                    content={t('editPaymentMethod')}
                  >
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-5 w-5 p-0 text-foreground hover:text-success"
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
              <div className="flex items-center justify-between gap-2 px-2 py-3">
                <InvoiceStatusCell
                  invoice={row}
                  onStatusChange={onStatusChange}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium leading-snug text-foreground text-sm truncate">
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
                    <span className="font-semibold whitespace-nowrap text-sm text-foreground">
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
            <div className="w-52 grid grid-cols-4 self-center gap-2 p-3">
              <Tooltip position={tooltipPos} content={t('copyPhone')}>
                <Button
                  variant="icon-primary"
                  size="custom"
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(row);
                  }}
                  aria-label={t('edit')}
                >
                  <LuPencilLine size={16} />
                </Button>
              </Tooltip>
            </div>
          </div>
        );
      })}
    </div>
  );
}
