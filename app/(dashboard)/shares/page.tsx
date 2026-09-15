'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import { toast } from 'react-toastify';

import {
  LuPlus,
  LuPen,
  LuTrash2,
  LuEye,
  LuChartPie,
  LuCircleCheck,
  LuClock,
} from 'react-icons/lu';

interface CampaignSize {
  sizeIndex: number;
  sharesPerPurchase: number;
}

interface ShareCampaign {
  _id: string;
  productId: string;
  productName: { ar: string; en: string } | null;
  productSlug: string | null;
  productSizes: Array<{
    sizeIndex: number;
    name: { ar: string; en: string };
    basePrice: number;
  }>;
  baseCurrency: string | null;
  totalShares: number;
  soldShares: number;
  status: 'active' | 'inactive' | 'completed';
  campaignNumber: number;
  sizes: CampaignSize[];
  createdAt: string;
  completedAt: string | null;
}

interface Product {
  _id: string;
  name: { ar: string; en: string };
  slug: string;
  sizes: Array<{
    _id?: string;
    name: { ar: string; en: string };
    basePrice: number;
    isAvailable?: boolean;
  }>;
  baseCurrency: string;
}

function extractApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const error = (data as Record<string, unknown>).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    const details = typeof errObj.details === 'string' ? errObj.details : null;
    const message = typeof errObj.message === 'string' ? errObj.message : null;
    if (details) return details;
    if (message) return message;
  }
  return fallback;
}

function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

export default function SharesPage() {
  const [campaigns, setCampaigns] = useState<ShareCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<ShareCampaign | null>(
    null,
  );
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersForCampaign, setOrdersForCampaign] =
    useState<ShareCampaign | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductCampaigns, setSelectedProductCampaigns] = useState<
    ShareCampaign[]
  >([]);
  const [selectedProductName, setSelectedProductName] = useState<{
    ar: string;
    en: string;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Create form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [campaignNumberInput, setCampaignNumberInput] = useState('1');
  const [totalSharesInput, setTotalSharesInput] = useState('10');
  const [sizeShares, setSizeShares] = useState<Record<number, string>>({});

  // Edit form state
  const [editTotalSharesInput, setEditTotalSharesInput] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const t = useTranslations('admin.shares');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const { confirm, modalProps } = useConfirmModal();

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '200' });
      const res = await fetch(`/api/shares?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success) {
        setCampaigns(data.data.campaigns);
      }
    } catch {
      toast.error(t('fetchError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?limit=200', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.data.products) {
        setProducts(data.data.products);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    if (showCreateModal && products.length === 0) {
      void fetchProducts();
    }
  }, [showCreateModal, products.length, fetchProducts]);

  const selectedProduct = products.find((p) => p._id === selectedProductId);

  // Group campaigns by product
  const productGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        productId: string;
        productName: { ar: string; en: string } | null;
        productSizes: ShareCampaign['productSizes'];
        baseCurrency: string | null;
        campaigns: ShareCampaign[];
      }
    > = {};

    for (const c of campaigns) {
      const key = String(c.productId);
      if (!groups[key]) {
        groups[key] = {
          productId: key,
          productName: c.productName,
          productSizes: c.productSizes,
          baseCurrency: c.baseCurrency,
          campaigns: [],
        };
      }
      groups[key].campaigns.push(c);
    }

    // Sort each group's campaigns by campaignNumber descending (current first)
    for (const key of Object.keys(groups)) {
      groups[key].campaigns.sort((a, b) => b.campaignNumber - a.campaignNumber);
    }

    return Object.values(groups);
  }, [campaigns]);

  const openCreateModal = () => {
    setSelectedProductId('');
    setCampaignNumberInput('1');
    setTotalSharesInput('10');
    setSizeShares({});
    setShowCreateModal(true);
  };

  const openEditModal = (campaign: ShareCampaign) => {
    setEditingCampaign(campaign);
    setEditTotalSharesInput(String(campaign.totalShares));
    setShowEditModal(true);
  };

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p._id === productId);
    if (product?.sizes) {
      const initial: Record<number, string> = {};
      product.sizes.forEach((_, i) => {
        initial[i] = '1';
      });
      setSizeShares(initial);
    } else {
      setSizeShares({});
    }
  };

  const handleSizeSharesChange = (sizeIndex: number, value: string) => {
    setSizeShares((prev) => ({ ...prev, [sizeIndex]: onlyDigits(value) }));
  };

  const handleCreate = async () => {
    if (!selectedProductId) {
      toast.error(t('selectProduct'));
      return;
    }
    const campaignNumber = parseInt(campaignNumberInput) || 0;
    if (campaignNumber < 1) {
      toast.error(t('invalidCampaignNumber'));
      return;
    }
    const totalShares = parseInt(totalSharesInput) || 0;
    if (totalShares < 2) {
      toast.error(t('minShares'));
      return;
    }

    const sizes: Array<{ sizeIndex: number; sharesPerPurchase: number }> = [];
    if (selectedProduct?.sizes) {
      selectedProduct.sizes.forEach((_, i) => {
        const raw = sizeShares[i] || '';
        const count = parseInt(raw) || 0;
        if (count >= 1) {
          sizes.push({ sizeIndex: i, sharesPerPurchase: count });
        }
      });
    }

    if (sizes.length === 0) {
      toast.error(t('minOneSharePerSize'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProductId,
          campaignNumber,
          totalShares,
          sizes,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(extractApiError(data, t('saveError')));
        return;
      }

      toast.success(t('created'));
      setShowCreateModal(false);
      void fetchCampaigns();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingCampaign) return;
    const totalShares = parseInt(editTotalSharesInput) || 0;
    if (totalShares < 2 && editingCampaign.soldShares === 0) {
      toast.error(t('minShares'));
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {};
      if (editingCampaign.soldShares === 0 && totalShares >= 2) {
        body.totalShares = totalShares;
      }

      const res = await fetch(`/api/shares/${editingCampaign._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(extractApiError(data, t('saveError')));
        return;
      }

      toast.success(t('updated'));
      setShowEditModal(false);
      void fetchCampaigns();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (campaign: ShareCampaign) => {
    const confirmed = await confirm({
      title: t('confirmDelete'),
      message: t('confirmDeleteMessage'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/shares/${campaign._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(extractApiError(data, t('deleteError')));
        return;
      }
      toast.success(t('deleted'));
      void fetchCampaigns();
    } catch {
      toast.error(t('deleteError'));
    }
  };

  const openOrdersModal = (campaign: ShareCampaign) => {
    setOrdersForCampaign(campaign);
    setShowOrdersModal(true);
  };

  const openProductModal = (group: (typeof productGroups)[number]) => {
    setSelectedProductCampaigns(group.campaigns);
    setSelectedProductName(group.productName);
    setShowProductModal(true);
  };

  const progressPercent = (campaign: ShareCampaign) => {
    if (campaign.totalShares === 0) return 0;
    return Math.round((campaign.soldShares / campaign.totalShares) * 100);
  };

  const localizedName = (name: { ar: string; en: string } | null) => {
    if (!name) return '-';
    return isRTL ? name.ar : name.en;
  };

  const getSizeName = (campaign: ShareCampaign, sizeIndex: number) => {
    const size = campaign.productSizes?.find((s) => s.sizeIndex === sizeIndex);
    return size ? localizedName(size.name) : `#${sizeIndex}`;
  };

  const sizesSummary = (campaign: ShareCampaign) => {
    if (!campaign.sizes || campaign.sizes.length === 0) return '-';
    return campaign.sizes
      .map((s) => `${getSizeName(campaign, s.sizeIndex)}: ${s.sharesPerPurchase}`)
      .join(' • ');
  };

  // Render a campaign card (used in both product modal and main view)
  const CampaignCard = ({
    campaign,
    showActions = true,
  }: {
    campaign: ShareCampaign;
    showActions?: boolean;
  }) => {
    const remaining = Math.max(0, campaign.totalShares - campaign.soldShares);
    const isActive = campaign.status === 'active';
    const isCompleted = campaign.status === 'completed';

    return (
      <div
        className={`rounded-xl border p-4 ${isActive
          ? 'border-primary/30 bg-primary/5'
          : 'border-stroke bg-background'
          }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isActive ? (
              <LuClock size={18} className="text-primary" />
            ) : (
              <LuCircleCheck size={18} className="text-blue-500" />
            )}
            <span className="font-medium text-foreground">
              {t('campaignNumber')}: #{campaign.campaignNumber}
            </span>
          </div>
          {isActive ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              {t('status.active')}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              {t('status.completed')}
            </span>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {campaign.soldShares}/{campaign.totalShares}
            </span>
            <div className="flex-1 h-2 bg-secondary/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isActive ? 'bg-primary' : 'bg-blue-500'
                  }`}
                style={{ width: `${progressPercent(campaign)}%` }}
              />
            </div>
            <span className="text-xs text-secondary">
              {progressPercent(campaign)}%
            </span>
          </div>
          {isActive && remaining > 0 && (
            <div className="text-xs text-secondary">
              {t('remaining', { count: remaining })}
            </div>
          )}
        </div>

        {/* Sizes configuration */}
        <div className="text-xs text-secondary mb-3">
          {sizesSummary(campaign)}
        </div>

        {/* Dates */}
        <div className="flex items-center gap-4 text-xs text-secondary/70 mb-3">
          <span>
            {t('createdLabel')}: {new Date(campaign.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
          </span>
          {isCompleted && campaign.completedAt && (
            <span>
              {t('completedAt')}: {new Date(campaign.completedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
            </span>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 pt-2 border-t border-stroke">
            <Tooltip content={t('viewOrders')} position="top">
              <button
                onClick={() => openOrdersModal(campaign)}
                className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary"
              >
                <LuEye size={16} />
              </button>
            </Tooltip>
            {isActive && (
              <Tooltip content={t('editCampaign')} position="top">
                <button
                  onClick={() => openEditModal(campaign)}
                  className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary"
                >
                  <LuPen size={16} />
                </button>
              </Tooltip>
            )}
            {campaign.soldShares === 0 && (
              <Tooltip content={t('delete')} position="top">
                <button
                  onClick={() => handleDelete(campaign)}
                  className="p-1.5 rounded-lg hover:bg-error/10 text-error"
                >
                  <LuTrash2 size={16} />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LuChartPie size={28} className="text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        </div>
        <Button onClick={openCreateModal} size="md">
          <LuPlus size={18} className={isRTL ? 'ml-2' : 'mr-2'} />
          {t('createCampaign')}
        </Button>
      </div>

      {/* Product cards grid */}
      {loading ? (
        <div className="text-center py-12 text-secondary">{t('loading')}</div>
      ) : productGroups.length === 0 ? (
        <div className="text-center py-12">
          <LuChartPie size={48} className="mx-auto text-secondary/40 mb-4" />
          <p className="text-secondary">{t('noCampaigns')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {productGroups.map((group) => {
            const activeCampaign = group.campaigns.find(
              (c) => c.status === 'active',
            );
            const completedCount = group.campaigns.filter(
              (c) => c.status === 'completed',
            ).length;

            return (
              <button
                key={group.productId}
                onClick={() => openProductModal(group)}
                className="text-left rounded-xl border border-stroke bg-card-bg p-4 hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* Product name */}
                <div className="font-medium text-foreground mb-2">
                  {localizedName(group.productName)}
                </div>

                {/* Active campaign progress */}
                {activeCampaign ? (
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {activeCampaign.soldShares}/
                        {activeCampaign.totalShares}
                      </span>
                      <div className="flex-1 h-2 bg-secondary/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${progressPercent(activeCampaign)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-secondary">
                        {progressPercent(activeCampaign)}%
                      </span>
                    </div>
                    <div className="text-xs text-secondary">
                      {t('remaining', {
                        count: Math.max(
                          0,
                          activeCampaign.totalShares -
                          activeCampaign.soldShares,
                        ),
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-secondary mb-3">
                    {t('noActiveCampaign')}
                  </div>
                )}

                {/* Campaign count */}
                <div className="flex items-center gap-3 text-xs text-secondary">
                  <span>
                    {t('campaignCount', { count: group.campaigns.length })}
                  </span>
                  {completedCount > 0 && (
                    <span className="text-blue-500">
                      {t('completedCount', { count: completedCount })}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Product campaigns modal */}
      {showProductModal && (
        <Modal
          isOpen
          onClose={() => {
            setShowProductModal(false);
            setSelectedProductCampaigns([]);
            setSelectedProductName(null);
          }}
          title={localizedName(selectedProductName)}
          size="xl"
        >
          <div className="space-y-4">
            {selectedProductCampaigns.map((campaign) => (
              <CampaignCard key={campaign._id} campaign={campaign} />
            ))}
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('createCampaign')}
        size="lg"
      >
        <div className="space-y-5">
          {/* Step 1: Select product */}
          <div>
            <Dropdown
              label={t('product')}
              value={selectedProductId}
              onChange={handleProductChange}
              options={[
                { label: t('selectProduct'), value: '' },
                ...products.map((p) => ({
                  label: isRTL ? p.name.ar : p.name.en,
                  value: p._id,
                })),
              ]}
              searchable
              searchPlaceholder={t('selectProduct')}
              required
            />
          </div>

          {/* Step 2: Campaign number */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('campaignNumberLabel')} *
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={campaignNumberInput}
              onChange={(e) => setCampaignNumberInput(onlyDigits(e.target.value))}
              onBlur={() => {
                const parsed = parseInt(campaignNumberInput) || 0;
                if (parsed < 1) setCampaignNumberInput('1');
              }}
              placeholder="1"
              helperText={t('campaignNumberHint')}
            />
          </div>

          {/* Step 3: Total shares needed to complete */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t('totalSharesLabel')} *
            </label>
            <Input
              type="text"
              inputMode="numeric"
              value={totalSharesInput}
              onChange={(e) => setTotalSharesInput(onlyDigits(e.target.value))}
              onBlur={() => {
                const parsed = parseInt(totalSharesInput) || 0;
                if (parsed < 2) setTotalSharesInput('2');
              }}
              placeholder="10"
              helperText={t('totalSharesHint')}
            />
          </div>

          {/* Step 4: Per-size shares-per-purchase */}
          {selectedProduct && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t('sizesSharesLabel')} *
              </label>
              <p className="text-xs text-secondary mb-3">
                {t('sizesSharesHint')}
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {selectedProduct.sizes?.map((size, i) => {
                  const shares = parseInt(sizeShares[i] || '') || 0;
                  const isValid = shares >= 1;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-stroke bg-background"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground text-sm">
                          {isRTL ? size.name.ar : size.name.en}
                        </div>
                        <div className="text-xs text-secondary">
                          {size.basePrice} {selectedProduct.baseCurrency}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={sizeShares[i] || ''}
                          onChange={(e) =>
                            handleSizeSharesChange(i, e.target.value)
                          }
                          placeholder="1"
                          className="w-20"
                          error={
                            !isValid && sizeShares[i] !== ''
                              ? t('minOneSharePerSize')
                              : undefined
                          }
                        />
                        <span className="text-xs text-secondary whitespace-nowrap">
                          {t('sharesPerOrder')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
              {t('cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !selectedProductId}
            >
              {submitting ? t('saving') : t('create')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('editCampaign')}
        size="md"
      >
        {editingCampaign && (
          <div className="space-y-4">
            {/* Campaign info */}
            <div className="text-sm text-secondary bg-secondary/5 rounded-lg p-3 space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  {localizedName(editingCampaign.productName)}
                </span>
              </p>
              <p>
                {t('campaignNumber')}: #{editingCampaign.campaignNumber}
              </p>
              <p>
                {t('shares')}: {editingCampaign.soldShares}/
                {editingCampaign.totalShares}
              </p>
              <div className="text-xs mt-1">
                {editingCampaign.sizes.map((s) => (
                  <div key={s.sizeIndex}>
                    {getSizeName(editingCampaign, s.sizeIndex)}:{' '}
                    {s.sharesPerPurchase} {t('sharesPerOrder')}
                  </div>
                ))}
              </div>
            </div>

            {/* Edit total shares (only if no shares sold) */}
            {editingCampaign.soldShares === 0 ? (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('totalSharesLabel')} *
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editTotalSharesInput}
                  onChange={(e) =>
                    setEditTotalSharesInput(onlyDigits(e.target.value))
                  }
                  onBlur={() => {
                    const parsed = parseInt(editTotalSharesInput) || 0;
                    if (parsed < 2) setEditTotalSharesInput('2');
                  }}
                />
              </div>
            ) : (
              <p className="text-xs text-warning bg-warning/5 rounded-lg p-3">
                {t('cannotEditShares')}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleEdit} disabled={submitting}>
                {submitting ? t('saving') : t('save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Orders Modal */}
      {showOrdersModal && ordersForCampaign && (
        <CampaignOrdersModal
          campaign={ordersForCampaign}
          onClose={() => {
            setShowOrdersModal(false);
            setOrdersForCampaign(null);
          }}
          t={t}
          isRTL={isRTL}
        />
      )}

      <ConfirmModal {...modalProps} />
    </div>
  );
}

function CampaignOrdersModal({
  campaign,
  onClose,
  t,
  isRTL,
}: {
  campaign: ShareCampaign;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  isRTL: boolean;
}) {
  const [orders, setOrders] = useState<
    Array<{
      _id: string;
      orderNumber: string;
      billingData: { fullName: string };
      status: string;
      totalAmount: number;
      currency: string;
      createdAt: string;
      items: Array<{ shareQuantity?: number }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`/api/shares/${campaign._id}/orders?limit=200`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.success) {
          setOrders(data.data.orders);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    void fetchOrders();
  }, [campaign._id]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`${t('campaignOrders')} #${campaign.campaignNumber}`}
      size="xl"
    >
      {loading ? (
        <div className="text-center py-8 text-secondary">{t('loading')}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8 text-secondary">{t('noOrders')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-secondary text-left">
                <th className="px-3 py-2">{t('orderNumber')}</th>
                <th className="px-3 py-2">{t('customer')}</th>
                <th className="px-3 py-2">{t('shares')}</th>
                <th className="px-3 py-2">{t('amount')}</th>
                <th className="px-3 py-2">{t('orderStatus')}</th>
                <th className="px-3 py-2">{t('date')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id} className="border-b border-border/50">
                  <td className="px-3 py-2 font-mono text-xs">
                    {order.orderNumber}
                  </td>
                  <td className="px-3 py-2">{order.billingData?.fullName}</td>
                  <td className="px-3 py-2">
                    {order.items?.[0]?.shareQuantity || 0}
                  </td>
                  <td className="px-3 py-2">
                    {order.totalAmount} {order.currency}
                  </td>
                  <td className="px-3 py-2">{order.status}</td>
                  <td className="px-3 py-2 text-secondary text-xs">
                    {new Date(order.createdAt).toLocaleDateString(
                      isRTL ? 'ar-SA' : 'en-US',
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
