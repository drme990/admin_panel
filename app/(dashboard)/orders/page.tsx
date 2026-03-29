'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Table from '@/components/ui/table';
import Pagination from '@/components/ui/pagination';
import Button from '@/components/ui/button';
import BulkAction from '@/components/ui/bulk-action';
import Modal from '@/components/ui/modal';
import Dropdown from '@/components/ui/dropdown';
import { toast } from 'react-toastify';
import { useTranslations, useLocale } from 'next-intl';
import { Order, OrderStatus } from '@/types/Order';
import {
  LuSearch as Search,
  LuEye as Eye,
  LuRefreshCw as RefreshCw,
  LuPackage as Package,
  LuMail as Mail,
  LuPhone as Phone,
  LuGlobe as Globe,
  LuCalendar as Calendar,
  LuHash as Hash,
  LuCreditCard as CreditCard,
  LuUserRoundPlus as UserRoundPlus,
  LuTag as Tag,
} from 'react-icons/lu';
import { Referral } from '@/types/Referral';
import Checkbox from '@/components/ui/checkbox';
import { Tooltip } from '@/components/ui/tooltip';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  processing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'partially-paid':
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  completed:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
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

function isOrderGuest(order: Pick<Order, 'userId' | 'isGuest'>): boolean {
  if (typeof order.isGuest === 'boolean') {
    return order.isGuest;
  }

  const hasUserId =
    typeof order.userId === 'string' && order.userId.trim().length > 0;
  return !hasUserId;
}

export default function OrderHistoryPage() {
  const t = useTranslations('orders');
  const locale = useLocale();
  const ToolTipPositions = locale === 'ar' ? 'right' : 'left';
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialStatus = searchParams.get('s') || '';
  const initialReferral = searchParams.get('r') || '';
  const initialSource = searchParams.get('source') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [referralFilter, setReferralFilter] = useState<string>(initialReferral);
  const [sourceFilter, setSourceFilter] = useState<string>(initialSource);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<OrderStatus>('pending');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);

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
      if (sourceFilter) params.set('source', sourceFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const result: OrdersResponse = data.data;
        setOrders(result.orders);
        setTotalPages(result.pagination.totalPages);
        setTotalOrders(result.pagination.totalOrders);
        setSelectedOrderIds([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, referralFilter, sourceFilter, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const viewOrder = (order: Order) => {
    setSelectedOrder(order);
    setModalStatus(order.status);
    setIsModalOpen(true);
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleOrderIds = orders.map((order) => order._id);
    const allSelected =
      visibleOrderIds.length > 0 &&
      visibleOrderIds.every((id) => selectedOrderIds.includes(id));

    setSelectedOrderIds(allSelected ? [] : visibleOrderIds);
  };

  const applyBulkStatus = async () => {
    if (selectedOrderIds.length === 0 || !bulkStatus) return;

    try {
      setBulkUpdating(true);
      const res = await fetch('/api/orders/bulk-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: bulkStatus,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to bulk update orders');
      }

      const nextStatus = bulkStatus as OrderStatus;

      setOrders((prev) =>
        prev.map((order) =>
          selectedOrderIds.includes(order._id)
            ? { ...order, status: nextStatus }
            : order,
        ),
      );

      setSelectedOrder((prev) =>
        prev && selectedOrderIds.includes(prev._id)
          ? { ...prev, status: nextStatus }
          : prev,
      );

      toast.success(`Updated ${data.data.updatedCount} orders`);
      setSelectedOrderIds([]);
      setBulkStatus('');
    } catch (error) {
      console.error('Error bulk updating order statuses:', error);
      toast.error('Failed to bulk update orders');
    } finally {
      setBulkUpdating(false);
    }
  };

  const updateOrderStatus = async () => {
    if (!selectedOrder || modalStatus === selectedOrder.status) return;

    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/orders/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: modalStatus }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update order status');
      }

      setSelectedOrder(data.data as Order);
      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrder._id
            ? { ...order, status: modalStatus }
            : order,
        ),
      );
    } catch (error) {
      console.error('Error updating order status:', error);
    } finally {
      setUpdatingStatus(false);
    }
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

  const getReservationLabel = (label: { ar: string; en: string }) =>
    locale === 'ar' ? label.ar : label.en;

  const getReservationValues = (value: string) =>
    value
      .split('\n')
      .map((entry) => entry.trim())
      .filter(Boolean);

  const statusOptions = [
    { label: t('filters.all'), value: '' },
    { label: t('status.pending'), value: 'pending' },
    { label: t('status.processing'), value: 'processing' },
    { label: t('status.partially-paid'), value: 'partially-paid' },
    { label: t('status.paid'), value: 'paid' },
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.failed'), value: 'failed' },
    { label: t('status.refunded'), value: 'refunded' },
    { label: t('status.cancelled'), value: 'cancelled' },
  ];

  const modalStatusOptions = [
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.refunded'), value: 'refunded' },
    { label: t('status.cancelled'), value: 'cancelled' },
  ];

  const bulkStatusOptions = [
    { label: t('status.completed'), value: 'completed' },
    { label: t('status.cancelled'), value: 'cancelled' },
    { label: t('status.refunded'), value: 'refunded' },
  ];

  const sourceOptions = [
    { label: t('filters.allSources'), value: '' },
    { label: t('filters.manasikSource'), value: 'manasik' },
    { label: t('filters.ghadaqSource'), value: 'ghadaq' },
  ];

  const allVisibleSelected =
    orders.length > 0 &&
    orders.every((order) => selectedOrderIds.includes(order._id));

  const columns = [
    {
      header: (
        <Checkbox
          checked={allVisibleSelected}
          onChange={toggleSelectAllVisible}
          aria-label="Select all visible orders"
        />
      ),
      accessor: (row: Order) => (
        <Checkbox
          checked={selectedOrderIds.includes(row._id)}
          onChange={() => {
            toggleOrderSelection(row._id);
          }}
          onClick={(e) => e?.stopPropagation()}
          aria-label={`Select ${row.orderNumber}`}
        />
      ),
      className: 'w-12',
    },
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
      header: t('table.customerType'),
      accessor: (row: Order) => (
        <span className="text-sm font-medium">
          {isOrderGuest(row)
            ? t('customerType.guest')
            : t('customerType.registered')}
        </span>
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
        <Tooltip position={ToolTipPositions} content={t('viewDetails')}>
          <Button
            variant="icon-primary"
            size="custom"
            onClick={(e) => {
              e.stopPropagation();
              viewOrder(row);
            }}
            aria-label={t('viewDetails')}
          >
            <Eye size={16} />
          </Button>
        </Tooltip>
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

        <Dropdown
          value={sourceFilter}
          options={sourceOptions}
          onChange={(val) => {
            setSourceFilter(val);
            setPage(1);
          }}
          placeholder={t('filters.source')}
          className="w-full sm:w-40"
        />

        <Button
          variant="icon-primary"
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

      <BulkAction
        selectedCount={selectedOrderIds.length}
        value={bulkStatus}
        options={bulkStatusOptions}
        onValueChange={setBulkStatus}
        onApply={applyBulkStatus}
        onClear={() => {
          setSelectedOrderIds([]);
          setBulkStatus('');
        }}
        applyLabel={t('bulkAction.apply')}
        applyingLabel={t('bulkAction.applying')}
        clearLabel={t('bulkAction.clear')}
        selectionLabel={t('bulkAction.selectedCount', {
          count: selectedOrderIds.length,
        })}
        dropdownLabel={t('bulkAction.statusLabel')}
        disabled={!bulkStatus}
        loading={bulkUpdating}
      />

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

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
              <Dropdown
                label={t('statusEditor.label')}
                value={modalStatus}
                options={modalStatusOptions}
                onChange={(value) => setModalStatus(value as OrderStatus)}
              />
              <Button
                type="button"
                variant="primary"
                onClick={updateOrderStatus}
                disabled={
                  updatingStatus ||
                  !selectedOrder ||
                  modalStatus === selectedOrder.status
                }
              >
                {updatingStatus
                  ? t('statusEditor.saving')
                  : t('statusEditor.save')}
              </Button>
            </div>

            <div className="bg-background rounded-site p-4 border border-stroke text-center">
              <p className="text-3xl font-bold text-success">
                {selectedOrder.totalAmount.toFixed(2)} {selectedOrder.currency}
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-3">{t('amountDetails')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <InfoRow
                  icon={<CreditCard size={14} />}
                  label={t('totals.totalPaidNow')}
                  value={`${selectedOrder.totalAmount.toFixed(2)} ${selectedOrder.currency}`}
                />
                <InfoRow
                  icon={<CreditCard size={14} />}
                  label={t('totals.fullAmount')}
                  value={`${(selectedOrder.fullAmount ?? selectedOrder.totalAmount).toFixed(2)} ${selectedOrder.currency}`}
                />
                <InfoRow
                  icon={<CreditCard size={14} />}
                  label={t('totals.paidAmount')}
                  value={`${(selectedOrder.paidAmount ?? selectedOrder.totalAmount).toFixed(2)} ${selectedOrder.currency}`}
                />
                <InfoRow
                  icon={<CreditCard size={14} />}
                  label={t('totals.remainingAmount')}
                  value={`${(selectedOrder.remainingAmount ?? 0).toFixed(2)} ${selectedOrder.currency}`}
                />
                <InfoRow
                  icon={<Tag size={14} />}
                  label={t('totals.couponCode')}
                  value={selectedOrder.couponCode || 'N/A'}
                />
                <InfoRow
                  icon={<Tag size={14} />}
                  label={t('totals.couponDiscount')}
                  value={`${(selectedOrder.couponDiscount ?? 0).toFixed(2)} ${selectedOrder.currency}`}
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package size={16} /> {t('items')}
              </h3>
              <div className="flex flex-col gap-2">
                {selectedOrder.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-background border border-stroke"
                  >
                    <div className="space-y-1">
                      <span className="font-medium text-sm">
                        {locale === 'ar'
                          ? item.productName.ar
                          : item.productName.en}
                      </span>
                      <span className="text-xs text-secondary mx-2">
                        x{item.quantity}
                      </span>
                      <div className="text-[11px] text-secondary font-mono">
                        <span>
                          {t('productId')}: {item.productId}
                        </span>
                        {item.productSlug ? (
                          <span className="ms-2">
                            {t('productSlug')}: {item.productSlug}
                          </span>
                        ) : null}
                      </div>
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
                  icon={<Package size={14} />}
                  label={t('source')}
                  value={selectedOrder.source || 'manasik'}
                />
                <InfoRow
                  icon={<Hash size={14} />}
                  label={t('customerType.label')}
                  value={
                    isOrderGuest(selectedOrder)
                      ? t('customerType.guest')
                      : t('customerType.registered')
                  }
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
                <InfoRow
                  icon={<Hash size={14} />}
                  label={t('locale')}
                  value={selectedOrder.locale || 'N/A'}
                />
                <InfoRow
                  icon={<Hash size={14} />}
                  label={t('termsAgreedAt')}
                  value={
                    selectedOrder.termsAgreedAt
                      ? formatDate(selectedOrder.termsAgreedAt)
                      : 'N/A'
                  }
                />
                <InfoRow
                  icon={<Hash size={14} />}
                  label={t('updatedAt')}
                  value={formatDate(selectedOrder.updatedAt)}
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

            {(selectedOrder.easykashRef ||
              selectedOrder.easykashProductCode ||
              selectedOrder.easykashResponse) && (
              <div>
                <h3 className="font-semibold mb-3">{t('easykashInfo')}</h3>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  {selectedOrder.easykashRef && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">EasyKash Ref</span>
                      <span>{selectedOrder.easykashRef}</span>
                    </div>
                  )}
                  {selectedOrder.easykashProductCode && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">Product Code</span>
                      <span>{selectedOrder.easykashProductCode}</span>
                    </div>
                  )}
                  {selectedOrder.easykashVoucher && (
                    <div className="flex justify-between py-1 px-3 rounded bg-background border border-stroke">
                      <span className="text-secondary">Voucher</span>
                      <span className="truncate max-w-50">
                        {selectedOrder.easykashVoucher}
                      </span>
                    </div>
                  )}
                  {selectedOrder.easykashResponse && (
                    <div className="py-2 px-3 rounded bg-background border border-stroke">
                      <p className="text-secondary mb-1">
                        EasyKash Raw Response
                      </p>
                      <pre className="whitespace-pre-wrap break-all text-[11px]">
                        {JSON.stringify(
                          selectedOrder.easykashResponse,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedOrder.reservationData?.length ? (
              <div>
                <h3 className="font-semibold mb-3">
                  {t('reservationData.title')}
                </h3>
                <div className="flex flex-col gap-2">
                  {selectedOrder.reservationData.map((field, index) => {
                    const values = getReservationValues(field.value);

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
                            <span className="text-sm text-secondary">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
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
  icon: ReactNode;
  label: string;
  value: ReactNode;
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
