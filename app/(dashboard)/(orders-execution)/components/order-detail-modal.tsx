import { type ReactNode, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import { Order, OrderPayment } from '@/types/Order';
import { STATUS_COLORS, PAYMENT_STATUS_COLORS } from '../lib/order-status';
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
  LuRotateCw,
} from 'react-icons/lu';

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
  const hasUserId = typeof order.userId === 'string' && order.userId.trim().length > 0;
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

function resolveLocalizedSizeValue(value: SizeValue | undefined, locale: string): string | null {
  if (typeof value === 'string') return normalizeSizeText(value);
  if (!value) return null;
  if (locale === 'ar') return normalizeSizeText(value.ar) ?? normalizeSizeText(value.en);
  return normalizeSizeText(value.en) ?? normalizeSizeText(value.ar);
}

function resolveOrderItemSizeLabel(item: Order['items'][number], locale: string): string | null {
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
  ) return null;

  const sizeOption = item.sizes[resolvedIndex];
  return (
    resolveLocalizedSizeValue(sizeOption?.name, locale) ??
    resolveLocalizedSizeValue(sizeOption?.label, locale) ??
    resolveLocalizedSizeValue(sizeOption?.value, locale)
  );
}

function getOrderItemDisplayName(item: Order['items'][number], locale: string): string {
  const productName = locale === 'ar' ? item.productName.ar : item.productName.en;
  const sizeLabel = resolveOrderItemSizeLabel(item, locale);
  return sizeLabel ? `${productName} - ${sizeLabel}` : productName;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
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
    if (!payment.expiresAt) return false;
    return new Date(payment.expiresAt).getTime() < Date.now();
  };

  const hasPaymentLink = (payment: OrderPayment) =>
    !!payment.redirectUrl && !isPaymentLinkExpired(payment);

  const getReservationLabel = (label: { ar: string; en: string }) =>
    locale === 'ar' ? label.ar : label.en;

  const getReservationValues = (value: string) =>
    value.split('\n').map((entry) => entry.trim()).filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `${t('orderDetails')} - ${order.orderNumber}` : t('orderDetails')}
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
            const latestPaidPayment = [...paymentTimeline].reverse().find((p) => p.status === 'paid');
            const currentTransactionAmount =
              latestPaidPayment?.orderAmount ?? latestPaidPayment?.amount ?? order.totalAmount;

            const remaining = order.remainingAmount ?? (order.fullAmount ? order.fullAmount - (order.paidAmount ?? 0) : 0);
            const hasRemaining = order.isPartialPayment && remaining > 0.001;

            return (
              <>
                {/* Status + date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[order.status] || ''}`}>
                      {t(`status.${order.status}`)}
                    </span>
                    {order.cancellationReason && order.status === 'cancelled' && (
                      <span className="text-xs text-secondary truncate max-w-50">
                        {order.cancellationReason}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-secondary">{formatDate(order.statusUpdateTime)}</span>
                </div>

                {/* Total amount hero */}
                <div className="bg-background rounded-site p-4 border border-stroke text-center">
                  <p className="text-3xl font-bold text-success">
                    {order.totalAmount.toFixed(2)} {order.currency}
                  </p>
                  {hasRemaining && (
                    <p className="mt-1 text-sm font-medium text-orange-600 dark:text-orange-400">
                      {t('totals.remainingAmount')}: {remaining.toFixed(2)} {order.currency}
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
                      value={formatMoney(currentTransactionAmount, order.currency)}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.fullAmount')}
                      value={formatMoney(order.fullAmount ?? order.totalAmount, order.currency)}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.paidAmount')}
                      value={formatMoney(order.paidAmount ?? order.totalAmount, order.currency)}
                    />
                    <InfoRow
                      icon={<LuCreditCard size={14} />}
                      label={t('totals.remainingAmount')}
                      value={
                        hasRemaining
                          ? formatMoney(remaining, order.currency)
                          : <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{t('status.paid')}</span>
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
                        <InfoRow icon={<LuTag size={14} />} label={t('totals.isUpgrade')} value={t('yes')} />
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
                    <h3 className="font-semibold">{t('paymentTimeline.title')}</h3>
                    {canCreatePaymentLink && (
                      <Tooltip position={locale === 'ar' ? 'right' : 'left'} content={t('paymentTimeline.createLink') || 'Create payment link'}>
                        <Button
                          variant="icon-primary"
                          size="custom"
                          onClick={() => onCreatePaymentLink?.(order)}
                          disabled={isCreatingPaymentLink}
                          aria-label={t('paymentTimeline.createLink') || 'Create payment link'}
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
                          typeof payment.easykashResponse?.customerReference === 'string'
                            ? payment.easykashResponse.customerReference
                            : undefined;

                        return (
                          <div
                            key={`${payment.paymentId || 'payment'}-${index}`}
                            className="rounded-lg bg-background border border-stroke p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-semibold text-foreground">
                                {t('paymentTimeline.paymentLabel', { index: index + 1 })}
                              </span>
                              <div className="flex items-center gap-2">
                                {hasPaymentLink(payment) && (
                                  <Tooltip position={locale === 'ar' ? 'right' : 'left'} content={t('paymentTimeline.copyLink') || 'Copy payment link'}>
                                    <Button
                                      variant="icon-primary"
                                      size="custom"
                                      onClick={() => handleCopyPaymentLink(payment)}
                                      aria-label={t('paymentTimeline.copyLink') || 'Copy payment link'}
                                    >
                                      {copiedPaymentId === payment.paymentId ? (
                                        <LuCheck size={16} className="text-success" />
                                      ) : (
                                        <LuCopy size={16} />
                                      )}
                                    </Button>
                                  </Tooltip>
                                )}
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${PAYMENT_STATUS_COLORS[paymentStatus] || ''}`}>
                                  {t(`paymentTimeline.statuses.${paymentStatus}`)}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <InfoRow
                                icon={<LuCreditCard size={14} />}
                                label={t('paymentTimeline.orderAmount')}
                                value={formatMoney(payment.orderAmount ?? payment.amount, payment.currency || order.currency)}
                              />
                              {typeof payment.gatewayAmount === 'number' && (
                                <InfoRow
                                  icon={<LuCreditCard size={14} />}
                                  label={t('paymentTimeline.gatewayAmount')}
                                  value={formatMoney(payment.gatewayAmount, payment.gatewayCurrency || payment.currency)}
                                />
                              )}
                              <InfoRow
                                icon={<LuCreditCard size={14} />}
                                label={t('paymentTimeline.method')}
                                value={payment.paymentMethod || 'N/A'}
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
                    {t('table.quantityTotal', { count: order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) })}
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
                            <span>{t('table.quantityTotal', { count: item.quantity })}</span>
                            <span>{(item.price ?? 0).toFixed(2)} {item.currency}</span>
                          </div>
                          <div className="text-[11px] text-secondary font-mono">
                            <span>{t('productId')}: {item.productId}</span>
                            {item.productSlug && (
                              <span className="ms-2">{t('productSlug')}: {item.productSlug}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="font-bold text-sm text-success">
                            {((item.price ?? 0) * (item.quantity ?? 0)).toFixed(2)} {item.currency}
                          </p>
                          <p className="text-[11px] text-secondary">
                            {item.quantity ?? 0} x {(item.price ?? 0).toFixed(2)}
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
                    <InfoRow icon={<LuHash size={14} />} label={t('table.orderNumber')} value={order.orderNumber} />
                    <InfoRow icon={<LuPackage size={14} />} label={t('source')} value={order.source || 'manasik'} />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('customerType.label')}
                      value={isOrderGuest(order) ? t('customerType.guest') : t('customerType.registered')}
                    />
                    <InfoRow icon={<LuMail size={14} />} label={t('email')} value={order.billingData.email} />
                    <InfoRow icon={<LuPhone size={14} />} label={t('phone')} value={order.billingData.phone} />
                    <InfoRow icon={<LuGlobe size={14} />} label={t('country')} value={order.billingData.country} />
                    <InfoRow icon={<LuCalendar size={14} />} label={t('table.date')} value={formatDate(order.statusUpdateTime)} />
                    <InfoRow icon={<LuHash size={14} />} label={t('locale')} value={order.locale || 'N/A'} />
                    <InfoRow
                      icon={<LuHash size={14} />}
                      label={t('termsAgreedAt')}
                      value={order.termsAgreedAt ? formatDate(order.termsAgreedAt) : 'N/A'}
                    />
                    <InfoRow icon={<LuHash size={14} />} label={t('updatedAt')} value={formatDate(order.statusUpdateTime)} />
                    {order.referralId && (
                      <InfoRow icon={<LuUserRoundPlus size={14} />} label={t('referral')} value={order.referralId} />
                    )}
                  </div>
                </div>

                {/* Invoice */}
                {order.invoiceUrl ? (
                  <div>
                    <h3 className="font-semibold mb-3">{t('table.invoice')}</h3>
                    <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-background border border-stroke">
                      <span className="inline-flex items-center justify-center p-2 text-primary">
                        <LuFileText size={32} />
                      </span>
                      <a
                        href={order.invoiceUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        {t('table.downloadInvoice')}
                      </a>
                    </div>
                  </div>
                ) : null}

                {/* Reservation data */}
                {order.reservationData?.length ? (
                  <div>
                    <h3 className="font-semibold mb-3">{t('reservationData.title')}</h3>
                    <div className="flex flex-col gap-2">
                      {order.reservationData.map((field, index) => {
                        const values = getReservationValues(field.value);

                        if (field.key === 'photo') {
                          return (
                            <div
                              key={`${field.key}-${index}`}
                              className="flex flex-col items-center gap-3 p-4 rounded-lg bg-background border border-stroke"
                            >
                              <div className="overflow-hidden">
                                <Image
                                  src={field.value}
                                  alt={getReservationLabel(field.label)}
                                  width={200}
                                  height={200}
                                  className="object-cover"
                                />
                              </div>
                              <a
                                href={field.value}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                              >
                                Download Image
                              </a>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${field.key}-${index}`}
                            className="py-2 px-3 rounded-lg bg-background border border-stroke"
                          >
                            <p className="text-xs text-secondary mb-1">{getReservationLabel(field.label)}</p>
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
                                <span className="text-sm text-secondary">-</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
