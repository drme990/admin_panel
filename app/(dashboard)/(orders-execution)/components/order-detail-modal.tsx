import { type ReactNode, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Order, OrderPayment } from '@/types/Order';
import { STATUS_COLORS, PAYMENT_STATUS_COLORS } from '../lib/order-status';
import { isImageUrl } from '../lib/order-utils';
import { getPaymentMethodLabel } from '@/lib/order';
import { downloadFile } from '@/lib/download-utils';
import {
  LuCreditCard,
  LuCalendar,
  LuHash,
  LuPackage,
  LuMail,
  LuPhone,
  LuGlobe,
  LuTag,
  LuUserRoundPlus,
  LuFileText,
  LuLink,
  LuCopy,
  LuCheck,
  LuX,
  LuClock,
  LuRotateCw,
  LuDownload,
  LuRefreshCw,
} from 'react-icons/lu';
import Image from 'next/image';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  loadingDetails: boolean;
  formatDate: (date: string) => string;
  locale: string;
  namespace?: 'orders' | 'execution';
  onCreatePaymentLink?: (order: Order) => void;
  isCreatingPaymentLink?: boolean;
}

function isOrderGuest(order: Pick<Order, 'userId' | 'isGuest'>): boolean {
  if (typeof order.isGuest === 'boolean') return order.isGuest;
  const hasUserId =
    typeof order.userId === 'string' && order.userId.trim().length > 0;
  return !hasUserId;
}

const NUMERIC_ONLY_SIZE_VALUE = /^\d+$/;

function normalizeSizeText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return NUMERIC_ONLY_SIZE_VALUE.test(trimmed) ? null : trimmed;
}

type LocalizedText = { ar?: string; en?: string };
type SizeValue = string | LocalizedText;

function resolveLocalizedSizeValue(
  value: SizeValue | undefined,
  locale: string,
): string | null {
  if (typeof value === 'string') return normalizeSizeText(value);
  if (!value) return null;
  if (locale === 'ar')
    return normalizeSizeText(value.ar) ?? normalizeSizeText(value.en);
  return normalizeSizeText(value.en) ?? normalizeSizeText(value.ar);
}

function resolveOrderItemSizeLabel(
  item: Order['items'][number],
  locale: string,
): string | null {
  if (item.customSize) return item.customSize;
  const directSize =
    resolveLocalizedSizeValue(item.sizeName, locale) ??
    resolveLocalizedSizeValue(item.sizeLabel, locale) ??
    resolveLocalizedSizeValue(item.size, locale);
  if (directSize) return directSize;

  const resolvedIndex = item.sizeIndex;
  if (
    typeof resolvedIndex !== 'number' ||
    !Array.isArray(item.sizes) ||
    resolvedIndex < 0 ||
    resolvedIndex >= item.sizes.length
  )
    return null;

  const sizeOption = item.sizes[resolvedIndex];
  return (
    resolveLocalizedSizeValue(sizeOption?.name, locale) ??
    resolveLocalizedSizeValue(sizeOption?.label, locale) ??
    resolveLocalizedSizeValue(sizeOption?.value, locale)
  );
}

function getOrderItemDisplayName(
  item: Order['items'][number],
  locale: string,
): string {
  const productName = locale === 'ar' ? item.productName.ar : item.productName.en;
  const sizeLabel = resolveOrderItemSizeLabel(item, locale);
  return sizeLabel ? `${productName} - ${sizeLabel}` : productName;
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background border border-stroke">
      <span className="text-secondary shrink-0">{icon}</span>
      <div className="flex flex-col min-w-0">
        <span className="text-xs text-secondary">{label}</span>
        <span className="text-sm font-medium truncate">{value}</span>
      </div>
    </div>
  );
}

function getPaymentTimeline(order: Order): OrderPayment[] {
  const payments = Array.isArray(order.payments) ? [...order.payments] : [];
  return payments.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  loadingDetails,
  formatDate,
  locale,
  namespace = 'orders',
  onCreatePaymentLink,
  isCreatingPaymentLink,
}: Props) {
  const t = useTranslations(namespace);
  const [copiedPaymentId, setCopiedPaymentId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [downloadingInvoiceUrl, setDownloadingInvoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOpen, order?._id]);

  const formatMoney = (amount: number | undefined, currency: string) =>
    `${Number(amount ?? 0).toFixed(2)} ${currency}`;

  const canCreatePaymentLink =
    !!order &&
    !!onCreatePaymentLink &&
    (order.status === 'pending' || order.status === 'partial-paid') &&
    (order.remainingAmount ?? 0) > 0.001;

  const handleCopyPaymentLink = async (payment: OrderPayment) => {
    if (!payment.redirectUrl) return;
    try {
      await navigator.clipboard.writeText(payment.redirectUrl);
      setCopiedPaymentId(payment.paymentId);
      setTimeout(() => setCopiedPaymentId(null), 2000);
    } catch {
      // ignore
    }
  };

  const isPaymentLinkExpired = (payment: OrderPayment) => {
    if (!payment.expiresAt || !now) return false;
    return new Date(payment.expiresAt).getTime() < now;
  };

  const hasPaymentLink = (payment: OrderPayment) =>
    !!payment.redirectUrl && !isPaymentLinkExpired(payment);

  const getReservationLabel = (label: { ar: string; en: string }) =>
    locale === 'ar' ? label.ar : label.en;

  const getReservationValues = (value: string) =>
    value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        order
          ? `${t('orderDetails')} - ${order.orderNumber}`
          : t('orderDetails')
      }
      size="lg"
    >
      {order && loadingDetails ? (
        <div className="py-8 text-center text-sm text-secondary">
          {t('loadingOrderDetails')}
        </div>
      ) : order ? (
        <div className="flex flex-col gap-6">
          {(() => {
            const paymentTimeline = getPaymentTimeline(order);
            const latestPaidPayment = [...paymentTimeline]
              .reverse()
              .find((p) => p.status === 'paid');
            const currentTransactionAmount =
              latestPaidPayment?.orderAmount ??
              latestPaidPayment?.amount ??
              order.totalAmount;

            const remaining =
              order.remainingAmount ??
              (order.fullAmount
                ? order.fullAmount - (order.paidAmount ?? 0)
                : 0);
            const hasRemaining = order.isPartialPayment && remaining > 0.001;

            return (
              <>
                {/* Status + date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[order.status] || ''}`}
                    >
                      {t(`status.${order.status}`)}
                    </span>
                    {order.cancellationReason &&
                      order.status === 'cancelled' && (
                        <span className="text-xs text-secondary truncate max-w-50">
                          {order.cancellationReason}
                        </span>
                      )}
                  </div>
                  <span className="text-sm text-secondary">
                    {formatDate(order.statusUpdateTime)}
                  </span>
                </div>

                {/* Total amount hero */}
                <div className="bg-background rounded-site p-4 border border-stroke text-center">
                  <p className="text-3xl font-bold text-success">
                    {order.totalAmount.toFixed(2)} {order.currency}
                  </p>
                  {hasRemaining && (
                    <p className="mt-1 text-sm font-medium text-orange-600 dark:text-orange-400">
                      {t('totals.remainingAmount')}: {remaining.toFixed(2)}{' '}
                      {order.currency}
                    </p>
                  )}
                </div>

                {/* Amount details */}
                <div>
                  <h3 className="font-semibold mb-3">{t('amountDetails')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.totalPaidNow')}
                      value={formatMoney(
                        currentTransactionAmount,
                        order.currency,
                      )}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.fullAmount')}
                      value={formatMoney(
                        order.fullAmount ?? order.totalAmount,
                        order.currency,
                      )}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.paidAmount')}
                      value={formatMoney(
                        order.paidAmount ?? order.totalAmount,
                        order.currency,
                      )}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.remainingAmount')}
                      value={
                        hasRemaining ? (
                          formatMoney(remaining, order.currency)
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            {t('status.paid')}
                          </span>
                        )
                      }
                    />
                    <InfoRow
                      icon={<LuTag size={14} />}
                      label={t('totals.couponCode')}
                      value={order.couponCode || 'N/A'}
                    />
                    <InfoRow
                      icon={<LuTag size={14} />}
                      label={t('totals.couponDiscount')}
                      value={`${(order.couponDiscount ?? 0).toFixed(2)} ${order.currency}`}
                    />
                    {order.isUpgrade && (
                      <>
                        <InfoRow
                          icon={<LuTag size={14} />}
                          label={t('totals.isUpgrade')}
                          value={t('yes')}
                        />
                        <InfoRow
                          icon={<LuTag size={14} />}
                          label={t('totals.upgradeDiscount')}
                          value={`${(order.upgradeDiscount ?? 0).toFixed(0)}%`}
                        />
                        {order.fromProductId && (
                          <InfoRow
                            icon={<LuPackage size={14} />}
                            label={t('totals.originalProduct')}
                            value={order.fromProductId}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Payment timeline */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">
                      {t('paymentTimeline.title')}
                    </h3>
                    {canCreatePaymentLink && (
                      <Tooltip
                        position={locale === 'ar' ? 'right' : 'left'}
                        content={
                          t('paymentTimeline.createLink') ||
                          'Create payment link'
                        }
                      >
                        <Button
                          variant="icon-primary"
                          size="custom"
                          onClick={() => onCreatePaymentLink?.(order)}
                          disabled={isCreatingPaymentLink}
                          aria-label={
                            t('paymentTimeline.createLink') ||
                            'Create payment link'
                          }
                        >
                          {isCreatingPaymentLink ? (
                            <LuRotateCw size={18} className="animate-spin" />
                          ) : (
                            <LuLink size={18} />
                          )}
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                  {paymentTimeline.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {paymentTimeline.map((payment, index) => {
                        const paymentStatus = payment.status || 'pending';
                        const customerReference =
                          typeof payment.easykashResponse?.customerReference ===
                            'string'
                            ? payment.easykashResponse.customerReference
                            : undefined;

                        return (
                          <div
                            key={`${payment.paymentId || 'payment'}-${index}`}
                            className="rounded-lg bg-background border border-stroke p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground">
                                {t('paymentTimeline.paymentLabel', {
                                  index: index + 1,
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                {hasPaymentLink(payment) && (
                                  <Tooltip
                                    position={
                                      locale === 'ar' ? 'right' : 'left'
                                    }
                                    content={
                                      t('paymentTimeline.copyLink') ||
                                      'Copy payment link'
                                    }
                                  >
                                    <Button
                                      variant="icon-primary"
                                      size="custom"
                                      onClick={() =>
                                        handleCopyPaymentLink(payment)
                                      }
                                      aria-label={
                                        t('paymentTimeline.copyLink') ||
                                        'Copy payment link'
                                      }
                                    >
                                      {copiedPaymentId === payment.paymentId ? (
                                        <LuCheck
                                          size={16}
                                          className="text-success"
                                        />
                                      ) : (
                                        <LuCopy size={16} />
                                      )}
                                    </Button>
                                  </Tooltip>
                                )}
                                <span
                                  className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${PAYMENT_STATUS_COLORS[paymentStatus] || ''}`}
                                >
                                  {t(
                                    `paymentTimeline.statuses.${paymentStatus}`,
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <InfoRow
                                icon={<LuCreditCard size={14} />}
                                label={t('paymentTimeline.orderAmount')}
                                value={formatMoney(
                                  payment.orderAmount ?? payment.amount,
                                  payment.currency || order.currency,
                                )}
                              />
                              {typeof payment.gatewayAmount === 'number' && (
                                <InfoRow
                                  icon={<LuCreditCard size={14} />}
                                  label={t('paymentTimeline.gatewayAmount')}
                                  value={formatMoney(
                                    payment.gatewayAmount,
                                    payment.gatewayCurrency || payment.currency,
                                  )}
                                />
                              )}
                              <InfoRow
                                icon={<LuCreditCard size={14} />}
                                label={t('paymentTimeline.method')}
                                value={
                                  getPaymentMethodLabel(
                                    payment.paymentMethod,
                                    locale as 'ar' | 'en',
                                  ) || 'N/A'
                                }
                              />
                              <InfoRow
                                icon={<LuCalendar size={14} />}
                                label={t('paymentTimeline.createdAt')}
                                value={formatDate(payment.createdAt)}
                              />
                              {payment.paidAt && (
                                <InfoRow
                                  icon={<LuCalendar size={14} />}
                                  label={t('paymentTimeline.paidAt')}
                                  value={formatDate(payment.paidAt)}
                                />
                              )}
                              {payment.easykashRef && (
                                <InfoRow
                                  icon={<LuHash size={14} />}
                                  label={t('paymentTimeline.reference')}
                                  value={payment.easykashRef}
                                />
                              )}
                              {payment.easykashProductCode && (
                                <InfoRow
                                  icon={<LuHash size={14} />}
                                  label={t('paymentTimeline.productCode')}
                                  value={payment.easykashProductCode}
                                />
                              )}
                              {customerReference && (
                                <InfoRow
                                  icon={<LuHash size={14} />}
                                  label={t('paymentTimeline.customerReference')}
                                  value={customerReference}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-background border border-stroke p-3 text-sm text-secondary">
                      {t('paymentTimeline.empty')}
                    </div>
                  )}
                </div>

                {/* Order items */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <LuPackage size={16} /> {t('items')}
                  </h3>
                  <div className="mb-3 text-xs text-secondary">
                    {t('table.itemCount', { count: order.items.length })} •{' '}
                    {t('table.quantityTotal', {
                      count: order.items.reduce(
                        (sum, item) => sum + Number(item.quantity || 0),
                        0,
                      ),
                    })}
                  </div>
                  <div className="flex flex-col gap-2">
                    {order.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between gap-3 py-3 px-3 rounded-lg bg-background border border-stroke"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {getOrderItemDisplayName(item, locale)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-secondary">
                            <span>
                              {t('table.quantityTotal', {
                                count: item.quantity,
                              })}
                            </span>
                            <span>
                              {(item.price ?? 0).toFixed(2)} {item.currency}
                            </span>
                          </div>
                          {!item.isCustom && (
                            <div className="text-[11px] text-secondary font-mono">
                              <span>
                                {t('productId')}: {item.productId}
                              </span>
                              {item.productSlug && (
                                <span className="ms-2">
                                  {t('productSlug')}: {item.productSlug}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-end shrink-0">
                          <p className="font-bold text-sm text-success">
                            {((item.price ?? 0) * (item.quantity ?? 0)).toFixed(
                              2,
                            )}{' '}
                            {item.currency}
                          </p>
                          <p className="text-[11px] text-secondary">
                            {item.quantity ?? 0} x{' '}
                            {(item.price ?? 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Customer info */}
                <div>
                  <h3 className="font-semibold mb-3">{t('customerInfo')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('table.orderNumber')}
                      value={order.orderNumber}
                    />
                    <InfoRow
                      icon={<LuPackage size={14} />}
                      label={t('source')}
                      value={order.source || 'manasik'}
                    />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('customerType.label')}
                      value={
                        isOrderGuest(order)
                          ? t('customerType.guest')
                          : t('customerType.registered')
                      }
                    />
                    <InfoRow
                      icon={<LuMail size={14} />}
                      label={t('email')}
                      value={order.billingData.email}
                    />
                    <InfoRow
                      icon={<LuPhone size={14} />}
                      label={t('phone')}
                      value={order.billingData.phone}
                    />
                    <InfoRow
                      icon={<LuGlobe size={14} />}
                      label={t('country')}
                      value={order.billingData.country}
                    />
                    <InfoRow
                      icon={<LuCalendar size={14} />}
                      label={t('table.date')}
                      value={formatDate(order.statusUpdateTime)}
                    />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('locale')}
                      value={order.locale || 'N/A'}
                    />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('termsAgreedAt')}
                      value={
                        order.termsAgreedAt
                          ? formatDate(order.termsAgreedAt)
                          : 'N/A'
                      }
                    />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('updatedAt')}
                      value={formatDate(order.statusUpdateTime)}
                    />
                    {order.referralId && (
                      <InfoRow
                        icon={<LuUserRoundPlus size={14} />}
                        label={t('referral')}
                        value={order.referralId}
                      />
                    )}
                  </div>
                </div>

                {/* Invoice */}
                {(() => {
                  const invoices = order.invoiceUrls || [];
                  if (invoices.length === 0) return null;
                  return (
                    <div>
                      <h3 className="font-semibold mb-3">
                        {invoices.length > 1
                          ? t('table.invoices') || t('table.invoice')
                          : t('table.invoice')}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {invoices.map((invoice) => {
                          const invoiceStatus =
                            invoice.invoiceStatus ?? 'waiting';
                          const statusConfig = {
                            confirmed: {
                              bg: 'bg-success',
                              icon: <LuCheck size={16} />,
                              label: t('table.confirmedInvoice') || 'Confirmed',
                            },
                            rejected: {
                              bg: 'bg-error',
                              icon: <LuX size={16} />,
                              label: t('table.rejectedInvoice') || 'Rejected',
                            },
                            waiting: {
                              bg: 'bg-warning',
                              icon: <LuClock size={16} />,
                              label: t('table.waitingInvoice') || 'Waiting',
                            },
                            pending: {
                              bg: 'bg-info',
                              icon: <LuClock size={16} />,
                              label: t('table.pendingInvoice') || 'Pending',
                            },
                          } as const;
                          const config =
                            statusConfig[
                            invoiceStatus as keyof typeof statusConfig
                            ] || statusConfig.waiting;

                          return (
                            <button
                              key={invoice.url}
                              type="button"
                              disabled={downloadingInvoiceUrl === invoice.url}
                              onClick={async () => {
                                if (downloadingInvoiceUrl) return;
                                setDownloadingInvoiceUrl(invoice.url);
                                try {
                                  await downloadFile(
                                    invoice.url,
                                    `invoice-${order.orderNumber}`,
                                  );
                                } catch {
                                  toast.error(
                                    t('messages.downloadFailed') ||
                                    'Failed to download invoice',
                                  );
                                } finally {
                                  setDownloadingInvoiceUrl(null);
                                }
                              }}
                              className="relative flex flex-col items-center gap-2 p-3 rounded-lg bg-background border border-stroke hover:border-primary transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <span
                                className={`absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full ${config.bg}`}
                                title={config.label}
                              >
                                {config.icon}
                              </span>
                              {isImageUrl(invoice.url) ? (
                                <Image
                                  src={invoice.url}
                                  alt="Invoice"
                                  className="w-full h-24 object-cover rounded-md"
                                  loading="lazy"
                                  width={200}
                                  height={96}
                                />
                              ) : (
                                <span className="inline-flex items-center justify-center p-2 text-primary h-24">
                                  {downloadingInvoiceUrl === invoice.url ? (
                                    <LuRefreshCw size={32} className="animate-spin" />
                                  ) : (
                                    <LuFileText size={32} />
                                  )}
                                </span>
                              )}
                              <span className="text-xs text-primary font-medium truncate max-w-full inline-flex items-center gap-1">
                                {downloadingInvoiceUrl === invoice.url ? (
                                  <LuRefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <LuDownload size={12} />
                                )}
                                {t('table.downloadInvoice')}
                              </span>
                              {invoiceStatus === 'rejected' &&
                                invoice.rejectionReason && (
                                  <span className="text-xs text-error text-center line-clamp-2">
                                    {invoice.rejectionReason}
                                  </span>
                                )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Reservation data */}
                {order.reservationData?.length ? (
                  <div>
                    <h3 className="font-semibold mb-3">
                      {t('reservationData.title')}
                    </h3>
                    <div className="flex flex-col gap-2">
                      {order.reservationData.map((field, index) => {
                        const values = getReservationValues(field.value);

                        if (field.key === 'photo') {
                          const photoUrls = (() => {
                            try {
                              const parsed = JSON.parse(field.value);
                              if (Array.isArray(parsed)) {
                                return parsed.filter(
                                  (v): v is string =>
                                    typeof v === 'string' && v.length > 0,
                                );
                              }
                            } catch {
                              // Not JSON — treat as a single URL (legacy)
                            }
                            return field.value ? [field.value] : [];
                          })();

                          if (photoUrls.length === 0) return null;

                          return (
                            <div
                              key={`${field.key}-${index}`}
                              className="flex flex-col gap-3 p-4 rounded-lg bg-background border border-stroke"
                            >
                              <div className="flex flex-wrap gap-3">
                                {photoUrls.map((url, photoIndex) => (
                                  <div
                                    key={`${field.key}-${index}-${photoIndex}`}
                                    className="flex flex-col items-center gap-2"
                                  >
                                    <div className="overflow-hidden">
                                      <Image
                                        src={url}
                                        alt={`${getReservationLabel(field.label)} ${photoIndex + 1}`}
                                        className="w-full max-w-50 h-auto object-cover rounded"
                                        width={200}
                                        height={96}
                                      />
                                    </div>
                                    <a
                                      href={url}
                                      download
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                    >
                                      Download Image
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${field.key}-${index}`}
                            className="py-2 px-3 rounded-lg bg-background border border-stroke"
                          >
                            <p className="text-xs text-secondary mb-1">
                              {getReservationLabel(field.label)}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {values.length > 0 ? (
                                values.map((entry, valueIndex) => (
                                  <span
                                    key={`${field.key}-${index}-${valueIndex}`}
                                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary"
                                  >
                                    {entry}
                                  </span>
                                ))
                              ) : (
                                <span className="text-sm text-secondary">
                                  -
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Design images */}
                {order.designUrls && order.designUrls.length > 0 ? (
                  <div>
                    <h3 className="font-semibold mb-3">
                      {t('reservationData.designs') || 'Designs'}
                    </h3>
                    <div className="flex flex-col gap-3 p-4 rounded-lg bg-background border border-stroke">
                      <div className="flex flex-wrap gap-3">
                        {order.designUrls.map((design, designIndex) => {
                          const variantLabel =
                            design.templateType === 'image'
                              ? t('reservationData.designImageVariant') || 'Image'
                              : t('reservationData.designTextVariant') || 'Text';
                          return (
                            <div
                              key={`design-${designIndex}`}
                              className="flex flex-col items-center gap-2"
                            >
                              <div className="overflow-hidden">
                                <Image
                                  src={`${design.url}${design.url.includes('?') ? '&' : '?'}v=${now}`}
                                  alt={`Design ${designIndex + 1} (${variantLabel})`}
                                  className="w-full max-w-50 h-auto object-cover rounded"
                                  width={200}
                                  height={96}
                                  unoptimized
                                />
                              </div>
                              <span className="text-xs text-secondary">
                                {variantLabel}
                              </span>
                              <a
                                href={`${design.url}${design.url.includes('?') ? '&' : '?'}v=${now}`}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                Download Design
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </Modal>
  );
}
