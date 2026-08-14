import { useMemo } from 'react';

import Button from '@/components/ui/button';
import Loading from '@/components/ui/loading';
import Modal from '@/components/ui/modal';
import { useTranslations } from 'next-intl';

import { Order } from '@/types/Order';
import { stripDesignMarkers } from '@/lib/product-name';

const ORDER_STATUS_COLORS: Record<Order['status'], string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',

  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',

  'partial-paid':
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',

  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',

  completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',

  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',

  refunded:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',

  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function getSizeLabel(size: Order['items'][number]['size']) {
  if (!size) return null;

  if (typeof size === 'string') {
    return size;
  }

  return size.en || size.ar || null;
}

function formatStatus(status: Order['status']) {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

interface CustomerOrdersModalProps {
  isOrdersModalOpen: boolean;
  setIsOrdersModalOpen: (open: boolean) => void;
  loadingOrders: boolean;

  selectedCustomer: {
    _id: string;
    name: string;
  } | null;

  customerOrders: Order[];
}

export default function CustomerOrdersModal({
  isOrdersModalOpen,
  setIsOrdersModalOpen,
  selectedCustomer,
  customerOrders,
  loadingOrders,
}: CustomerOrdersModalProps) {
  const t = useTranslations('admin.customers.ordersModal');

  const { lifetimeSpending, totalOrders, currency } = useMemo(() => {
    const total = customerOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const firstCurrency = customerOrders[0]?.currency ?? '';
    return {
      lifetimeSpending: total,
      totalOrders: customerOrders.length,
      currency: firstCurrency,
    };
  }, [customerOrders]);

  return (
    <Modal
      isOpen={isOrdersModalOpen}
      onClose={() => setIsOrdersModalOpen(false)}
      title={`${selectedCustomer?.name || ''} - ${t('title')}`}
      size="xl"
      footer={
        <div className="flex justify-end">
          <Button variant="danger" onClick={() => setIsOrdersModalOpen(false)}>
            {t('close')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-4 min-h-96">
        {loadingOrders ? (
          <Loading />
        ) : customerOrders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-secondary">{t('emptyMessage')}</p>
          </div>
        ) : (
          <>
            {/* Lifetime spending summary */}
            <div className="grid grid-cols-2 gap-4 mb-2">
              <div className="border border-stroke rounded-lg p-4 bg-card-bg">
                <p className="text-xs uppercase text-secondary">{t('totalOrders')}</p>
                <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
              </div>
              <div className="border border-stroke rounded-lg p-4 bg-card-bg">
                <p className="text-xs uppercase text-secondary">{t('lifetimeSpending')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {lifetimeSpending.toFixed(2)} {currency}
                </p>
              </div>
            </div>

            {customerOrders.map((order) => (
              <div
                key={order._id}
                className="border border-stroke rounded-lg p-4 bg-card-bg hover:border-primary/50 transition-colors"
              >
                {/* Header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs uppercase text-secondary">
                      {t('orderNumber')}
                    </p>

                    <p className="font-mono text-sm text-foreground">
                      {order.orderNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-secondary">
                      {t('totalAmount')}
                    </p>

                    <p className="font-medium text-foreground">
                      {order.totalAmount.toFixed(2)} {order.currency}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-secondary">
                      {t('status')}
                    </p>

                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${ORDER_STATUS_COLORS[order.status]
                        }`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-secondary">
                      {t('created')}
                    </p>

                    <p className="text-sm text-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Payment section */}
                {(order.paidAmount !== undefined ||
                  order.remainingAmount !== undefined) && (
                    <div className="grid grid-cols-2 gap-4 py-3 mb-4 border-y border-stroke">
                      {order.paidAmount !== undefined && (
                        <div>
                          <p className="text-xs text-secondary">
                            {t('paidAmount')}
                          </p>

                          <p className="font-medium text-green-600">
                            {order.paidAmount.toFixed(2)} {order.currency}
                          </p>
                        </div>
                      )}

                      {order.remainingAmount !== undefined && (
                        <div>
                          <p className="text-xs text-secondary">
                            {t('remainingAmount')}
                          </p>

                          <p className="font-medium text-orange-600">
                            {order.remainingAmount.toFixed(2)} {order.currency}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                {/* Items */}
                {order.items.length > 0 && (
                  <div>
                    <p className="text-xs uppercase font-medium text-secondary mb-2">
                      {t('itemsLabel', { count: order.items.length })}
                    </p>

                    <div className="space-y-2">
                      {order.items.map((item, index) => {
                        const sizeLabel = getSizeLabel(item.size);

                        return (
                          <div
                            key={`${item.productId || item.productName.en || index}-${index}`}
                            className="flex justify-between items-start bg-stroke/30 rounded p-3 text-sm"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-foreground">
                                {stripDesignMarkers(item.productName.en || item.productName.ar)}
                              </p>

                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-secondary">
                                <span>
                                  Price: {item.price.toFixed(2)} {item.currency}
                                </span>

                                <span>Qty: {item.quantity}</span>

                                {sizeLabel && <span>Size: {sizeLabel}</span>}
                              </div>
                            </div>

                            <p className="font-medium text-foreground whitespace-nowrap ml-3">
                              {(item.price * item.quantity).toFixed(2)}{' '}
                              {item.currency}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}
