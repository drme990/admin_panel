'use client';

import { useState, useEffect, useCallback } from 'react';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Button from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';
import { useTranslations, useLocale } from 'next-intl';
import { Order, OrderStatus } from '@/types/Order';
import {
  Search,
  Eye,
  RefreshCw,
  Package,
  Mail,
  Phone,
  Globe,
  Calendar,
  Hash,
  CreditCard,
  UserRoundPlus,
} from 'lucide-react';
import { Referral } from '@/types/Referral';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded:
    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

interface OrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default function OrderHistoryPage() {
  const t = useTranslations('orders');
  const locale = useLocale();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [referralFilter, setReferralFilter] = useState<string>('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const res = await fetch('/api/referrals?limit=100');
        const data = await res.json();
        if (data.success) {
          setReferrals(data.data.referrals);
        }
      } catch (error) {
        console.error('Error fetching referrals:', error);
      }
    };
    fetchReferrals();
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
      });
      if (statusFilter) params.set('status', statusFilter);
      if (referralFilter) params.set('referralId', referralFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const result: OrdersResponse = data.data;
        setOrders(result.orders);
        setTotalPages(result.pagination.totalPages);
        setTotalOrders(result.pagination.totalOrders);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, referralFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const viewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(
      locale === 'ar' ? 'ar-SA' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );
  };

  const statusOptions = [
    { label: t('filters.all'), value: '' },
    { label: t('status.pending'), value: 'pending' },
    { label: t('status.processing'), value: 'processing' },
    { label: t('status.paid'), value: 'paid' },
    { label: t('status.failed'), value: 'failed' },
    { label: t('status.refunded'), value: 'refunded' },
    { label: t('status.cancelled'), value: 'cancelled' },
  ];

  const columns = [
    {
      header: t('table.orderNumber'),
      accessor: (row: Order) => (
        <span className="font-mono text-sm">{row.orderNumber}</span>
      ),
    },
    {
      header: t('table.customer'),
      accessor: (row: Order) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {row.billingData.fullName}
          </span>
          <span className="text-xs text-secondary">
            {row.billingData.email}
          </span>
        </div>
      ),
    },
    {
      header: t('table.amount'),
      accessor: (row: Order) => (
        <span className="font-bold text-success">
          {row.totalAmount.toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      header: t('table.status'),
      accessor: (row: Order) => (
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_COLORS[row.status as OrderStatus] || ''}`}
        >
          {t(`status.${row.status}`)}
        </span>
      ),
    },
    {
      header: t('table.date'),
      accessor: (row: Order) => (
        <span className="text-sm text-secondary">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (row: Order) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            viewOrder(row);
          }}
          className="p-2 hover:bg-background rounded-lg transition-colors text-primary"
          title={t('viewDetails')}
        >
          <Eye size={16} />
        </button>
      ),
      className: 'w-16',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('pageTitle')}</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute top-1/2 -translate-y-1/2 inset-s-3 text-secondary"
          />
          <input
            type="text"
            placeholder={t('filters.search')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-stroke bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-sm"
          />
        </div>

        <Dropdown
          value={statusFilter}
          options={statusOptions}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          placeholder={t('filters.status')}
          className="w-full sm:w-48"
        />

        <Dropdown
          value={referralFilter}
          options={[
            { label: t('filters.allReferrals'), value: '' },
            ...referrals.map((r) => ({
              label: `${r.name} (${r.referralId})`,
              value: r.referralId,
            })),
          ]}
          onChange={(val) => {
            setReferralFilter(val);
            setPage(1);
          }}
          placeholder={t('filters.referral')}
          className="w-full sm:w-48"
        />

        <Button
          variant="icon"
          size="custom"
          onClick={() => fetchOrders()}
          className="shrink-0"
        >
          <RefreshCw size={18} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-sm text-secondary">
        <span>
          {t('total')}: {totalOrders}
        </span>
      </div>

      <Table
        columns={columns}
        data={orders}
        loading={loading}
        emptyMessage={t('noOrders')}
        onRowClick={viewOrder}
      />

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          selectedOrder
            ? `${t('orderDetails')} - ${selectedOrder.orderNumber}`
            : t('orderDetails')
        }
        size="lg"
      >
        {selectedOrder && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${STATUS_COLORS[selectedOrder.status as OrderStatus] || ''}`}
              >
                {t(`status.${selectedOrder.status}`)}
              </span>
              <span className="text-sm text-secondary">
                {formatDate(selectedOrder.createdAt)}
              </span>
            </div>

            <div className="bg-background rounded-site p-4 border border-stroke text-center">
              <p className="text-3xl font-bold text-success">
                {selectedOrder.totalAmount.toFixed(2)} {selectedOrder.currency}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package size={16} /> {t('items')}
              </h3>
              <div className="flex flex-col gap-2">
                {selectedOrder.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-background border border-stroke"
                  >
                    <div>
                      <span className="font-medium text-sm">
                        {locale === 'ar'
                          ? item.productName.ar
                          : item.productName.en}
                      </span>
                      <span className="text-xs text-secondary mx-2">
                        x{item.quantity}
                      </span>
                    </div>
                    <span className="font-bold text-sm">
                      {item.price.toFixed(2)} {item.currency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">{t('customerInfo')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow
                  icon={<Hash size={14} />}
                  label={t('table.orderNumber')}
                  value={selectedOrder.orderNumber}
                />
                <InfoRow
                  icon={<Mail size={14} />}
                  label={t('email')}
                  value={selectedOrder.billingData.email}
                />
                <InfoRow
                  icon={<Phone size={14} />}
                  label={t('phone')}
                  value={selectedOrder.billingData.phone}
                />
                <InfoRow
                  icon={<Globe size={14} />}
                  label={t('country')}
                  value={selectedOrder.billingData.country}
                />
                <InfoRow
                  icon={<Calendar size={14} />}
                  label={t('table.date')}
                  value={formatDate(selectedOrder.createdAt)}
                />
                <InfoRow
                  icon={<CreditCard size={14} />}
                  label={t('paymentMethod')}
                  value={selectedOrder.paymentMethod || 'N/A'}
                />
                {selectedOrder.referralId && (
                  <InfoRow
                    icon={<UserRoundPlus size={14} />}
                    label={t('referral')}
                    value={selectedOrder.referralId}
                  />
                )}
              </div>
            </div>

            {(selectedOrder.paymobOrderId ||
              selectedOrder.paymobTransactionId) && (
              <div>
                <h3 className="font-semibold mb-3">{t('paymobInfo')}</h3>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {selectedOrder.paymobOrderId && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">Paymob Order</span>
                      <span>{selectedOrder.paymobOrderId}</span>
                    </div>
                  )}
                  {selectedOrder.paymobTransactionId && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">Transaction</span>
                      <span>{selectedOrder.paymobTransactionId}</span>
                    </div>
                  )}
                  {selectedOrder.paymobIntentionId && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">Intention</span>
                      <span className="truncate max-w-50">
                        {selectedOrder.paymobIntentionId}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-background border border-stroke">
      <span className="text-secondary">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-secondary">{label}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}
