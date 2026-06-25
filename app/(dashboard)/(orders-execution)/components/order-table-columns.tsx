import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import Tooltip from '@/components/ui/tooltip';
import { Order, OrderStatus } from '@/types/Order';
import { FaWhatsapp } from 'react-icons/fa6';
import {
  LuEye,
  LuRefreshCw,
  LuCopy,
  LuPhone,
  LuPenLine,
  LuBan,
  LuLink,
  LuRotateCw,
} from 'react-icons/lu';

import {
  STATUS_COLORS,
  WHATSAPP_STATE_CLASSES,
  getDefaultReferralCode,
} from '../lib/order-status';

interface ColumnCallbacks {
  onView: (order: Order) => void;
  onWhatsapp: (order: Order) => void;
  onCopyPhone: (order: Order) => void;
  onCopyMessage: (order: Order) => void;
  onChangeStatus: (order: Order) => void;
  onBlock: (order: Order) => void;
  onCopyPaymentLink: (order: Order) => void;
  onRegeneratePaymentLink: (order: Order) => void;
  onToggleSelect: (orderId: string) => void;
  onToggleSelectAll: () => void;
  selectedOrderIds: string[];
  allVisibleSelected: boolean;
  whatsappOrderId: string | null;
  copyingPhoneOrderId: string | null;
  copyingMessageOrderId: string | null;
  copyingPaymentLinkOrderId: string | null;
  regeneratingPaymentLinkOrderId: string | null;
  blockingOrderId: string | null;
  blockedUserIds: Set<string>;
  tooltipPos: 'left' | 'right';
  formatDate: (date: string) => string;
}

export function useOrderColumns(callbacks: ColumnCallbacks) {
  const t = useTranslations('orders');
  const {
    onView, onWhatsapp, onCopyPhone, onCopyMessage, onChangeStatus, onBlock,
    onCopyPaymentLink, onRegeneratePaymentLink,
    onToggleSelect, onToggleSelectAll,
    selectedOrderIds, allVisibleSelected,
    whatsappOrderId, copyingPhoneOrderId, copyingMessageOrderId, copyingPaymentLinkOrderId,
    regeneratingPaymentLinkOrderId, blockingOrderId, blockedUserIds,
    tooltipPos, formatDate,
  } = callbacks;

  return [
    {
      header: (
        <Checkbox
          checked={allVisibleSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all visible orders"
        />
      ) as ReactNode,
      accessor: (row: Order) => (
        <Checkbox
          checked={selectedOrderIds.includes(row._id)}
          onChange={() => onToggleSelect(row._id)}
          onClick={(e) => e?.stopPropagation()}
          aria-label={`Select ${row.orderNumber}`}
        />
      ),
      className: 'w-12',
    },
    {
      header: t('table.orderNumber'),
      accessor: (row: Order) => (
        <div className="flex items-center gap-2 min-w-32">
          <span
            className={`h-2.5 w-2.5 rounded-full shrink-0 ${WHATSAPP_STATE_CLASSES[row.isWhatsappButtonClicked || 'no-need-to-click']}`}
            title={
              row.isWhatsappButtonClicked === 'clicked'
                ? t('filters.whatsappStateClicked')
                : row.isWhatsappButtonClicked === 'not-clicked'
                  ? t('filters.whatsappStateNotClicked')
                  : t('filters.whatsappStateNoNeedToClick')
            }
          />
          <span
            className={`font-mono text-sm ${row.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : ''}`}
          >
            {row.orderNumber}
          </span>
        </div>
      ),
    },
    {
      header: t('table.customer'),
      accessor: (row: Order) => (
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${row.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : ''}`}>
            {row.billingData.fullName}
          </span>
          <span className={`text-xs text-secondary ${row.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : ''}`}>
            {row.billingData.email}
          </span>
        </div>
      ),
    },
    {
      header: t('table.amount'),
      accessor: (row: Order) => {
        const displayedAmount =
          typeof row.paidAmount === 'number' ? row.paidAmount : row.totalAmount;
        return (
          <span
            className={`font-bold ${row.status === 'partial-paid' ? 'text-orange-600 dark:text-orange-400' : 'text-success'}`}
          >
            {displayedAmount.toFixed(2)} {row.currency}
          </span>
        );
      },
    },
    {
      header: t('table.remainingAmount'),
      accessor: (row: Order) => {
        const remaining = row.remainingAmount

        if (row.status === 'processing') {
          return (
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status]}`}>
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
            {remaining.toFixed(2)} {row.currency}
          </span>
        );
      },
    },
    {
      header: t('table.status'),
      accessor: (row: Order) => (
        <div className="flex flex-col gap-1">
          <span className={`inline-block w-fit px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status] || ''}`}>
            {t(`status.${row.status}`)}
          </span>
          <span className={`inline-block w-fit px-2 py-0.5 text-[11px] rounded-full ${STATUS_COLORS[row.status] || ''}`}>
            {row.referralId || getDefaultReferralCode(row.source)}
          </span>
        </div>
      ),
    },
    {
      header: t('table.date'),
      accessor: (row: Order) => (
        <span className="text-sm text-secondary">{formatDate(row.statusUpdateTime)}</span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (row: Order) => (
        <div className="flex flex-col gap-2">
          <div className="flex flex-row gap-2">
            <Tooltip position={tooltipPos} content={t('copyWhatsapp.copyNumber')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); void onCopyPhone(row); }}
                disabled={copyingPhoneOrderId === row._id}
                aria-label={t('copyWhatsapp.copyNumber')}
              >
                {copyingPhoneOrderId === row._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <LuPhone size={16} />}
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('copyWhatsapp.copyMessage')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); void onCopyMessage(row); }}
                disabled={copyingMessageOrderId === row._id}
                aria-label={t('copyWhatsapp.copyMessage')}
              >
                {copyingMessageOrderId === row._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <LuCopy size={16} />}
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('copyWhatsapp.button')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onWhatsapp(row); }}
                disabled={whatsappOrderId === row._id}
                aria-label={t('copyWhatsapp.button')}
              >
                {whatsappOrderId === row._id
                  ? <LuRefreshCw size={16} className="animate-spin" />
                  : <FaWhatsapp size={16} />}
              </Button>
            </Tooltip>
          </div>

          <div className="flex flex-row gap-2">
            <Tooltip position={tooltipPos} content={t('viewDetails')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onView(row); }}
                aria-label={t('viewDetails')}
              >
                <LuEye size={16} />
              </Button>
            </Tooltip>

            <Tooltip position={tooltipPos} content={t('changeStatus')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => { e.stopPropagation(); onChangeStatus(row); }}
                aria-label={t('changeStatus')}
              >
                <LuPenLine size={16} />
              </Button>
            </Tooltip>

            {row.status === 'pending' && row.payments && row.payments.length > 0 && (() => {
              const latestPayment = [...row.payments].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              )[0];
              const isExpired = latestPayment.expiresAt
                ? new Date(latestPayment.expiresAt).getTime() < Date.now()
                : false;
              const hasRedirectUrl = !!latestPayment.redirectUrl;

              if (!isExpired && hasRedirectUrl) {
                return (
                  <Tooltip position={tooltipPos} content={t('table.copyPaymentLink')}>
                    <Button
                      variant="icon-primary"
                      size="custom"
                      onClick={(e) => { e.stopPropagation(); void onCopyPaymentLink(row); }}
                      disabled={copyingPaymentLinkOrderId === row._id}
                      aria-label={t('table.copyPaymentLink')}
                    >
                      {copyingPaymentLinkOrderId === row._id
                        ? <LuRefreshCw size={16} className="animate-spin" />
                        : <LuLink size={16} />}
                    </Button>
                  </Tooltip>
                );
              }

              return (
                <Tooltip position={tooltipPos} content={t('table.regeneratePaymentLink')}>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={(e) => { e.stopPropagation(); onRegeneratePaymentLink(row); }}
                    disabled={regeneratingPaymentLinkOrderId === row._id}
                    aria-label={t('table.regeneratePaymentLink')}
                  >
                    {regeneratingPaymentLinkOrderId === row._id
                      ? <LuRefreshCw size={16} className="animate-spin" />
                      : <LuRotateCw size={16} />}
                  </Button>
                </Tooltip>
              );
            })()}

            {row.userId && blockedUserIds.has(row.userId) ? (
              <Tooltip position={tooltipPos} content={t('unblockCustomer')}>
                <Button
                  variant="icon-danger"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onBlock(row); }}
                  disabled={blockingOrderId === row._id}
                  aria-label={t('unblockCustomer')}
                >
                  {blockingOrderId === row._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuBan size={16} />}
                </Button>
              </Tooltip>
            ) : (
              <Tooltip position={tooltipPos} content={t('blockCustomer')}>
                <Button
                  variant="icon-primary"
                  size="custom"
                  onClick={(e) => { e.stopPropagation(); onBlock(row); }}
                  disabled={blockingOrderId === row._id || row.isGuest || !row.userId}
                  aria-label={t('blockCustomer')}
                >
                  {blockingOrderId === row._id
                    ? <LuRefreshCw size={16} className="animate-spin" />
                    : <LuBan size={16} />}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
      ),
    },
  ];
}
