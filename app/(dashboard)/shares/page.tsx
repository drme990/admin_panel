'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Modal from '@/components/ui/modal';
import Input from '@/components/ui/input';
import Checkbox from '@/components/ui/checkbox';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import OrderDetailModal from '@/components/order/order-detail-modal';
import { type Order } from '@/types/Order';
import { toast } from 'react-toastify';

import {
  LuPlus,
  LuPen,
  LuTrash2,
  LuEye,
  LuChartPie,
  LuCircleCheck,
  LuClock,
  LuImage as ImageIcon,
} from 'react-icons/lu';

interface CampaignSize {
  sizeIndex: number;
  sharesPerPurchase: number;
}

interface ProductMediaItem {
  url: string;
  platform: string;
}

interface ShareCampaign {
  _id: string;
  productId: string;
  productName: { ar: string; en: string } | null;
  productSlug: string | null;
  productMedia: ProductMediaItem[];
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
  displayOnProductPage?: boolean;
  minDisplayPercent?: number;
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

interface CampaignOrder extends Order {
  _id: string;
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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
}

function getPrimaryImageUrl(media: ProductMediaItem[]): string | null {
  if (!media || media.length === 0) return null;
  const firstImage = media.find((m) => !isVideoUrl(m.url));
  return firstImage?.url || media[0]?.url || null;
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
  const [showAddSharesModal, setShowAddSharesModal] = useState(false);
  const [addSharesForCampaign, setAddSharesForCampaign] =
    useState<ShareCampaign | null>(null);
  const [addSharesInput, setAddSharesInput] = useState('1');
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProductCampaigns, setSelectedProductCampaigns] = useState<
    ShareCampaign[]
  >([]);
  const [selectedProductName, setSelectedProductName] = useState<{
    ar: string;
    en: string;
  } | null>(null);
  const [selectedProductMedia, setSelectedProductMedia] = useState<
    ProductMediaItem[]
  >([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Create form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [campaignNumberInput, setCampaignNumberInput] = useState('1');
  const [totalSharesInput, setTotalSharesInput] = useState('10');
  const [sizeShares, setSizeShares] = useState<Record<number, string>>({});
  const [displayOnProductPageInput, setDisplayOnProductPageInput] =
    useState(false);
  const [minDisplayPercentInput, setMinDisplayPercentInput] = useState('0');

  // Edit form state
  const [editTotalSharesInput, setEditTotalSharesInput] = useState('');
  const [editDisplayOnProductPage, setEditDisplayOnProductPage] =
    useState(false);
  const [editMinDisplayPercent, setEditMinDisplayPercent] = useState('0');
  const [editCampaignNumberInput, setEditCampaignNumberInput] = useState('');

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

  // All products are selectable — multiple campaigns per product are
  // allowed, and admins can delete the current campaign at any time.
  const availableProducts = products;

  // Group campaigns by product
  const productGroups = useMemo(() => {
    const groups: Record<
      string,
      {
        productId: string;
        productName: { ar: string; en: string } | null;
        productMedia: ProductMediaItem[];
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
          productMedia: c.productMedia || [],
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
    setDisplayOnProductPageInput(false);
    setMinDisplayPercentInput('0');
    setShowCreateModal(true);
  };

  const openEditModal = (campaign: ShareCampaign) => {
    setEditingCampaign(campaign);
    setEditTotalSharesInput(String(campaign.totalShares));
    setEditDisplayOnProductPage(campaign.displayOnProductPage ?? false);
    setEditMinDisplayPercent(String(campaign.minDisplayPercent ?? 0));
    setEditCampaignNumberInput(String(campaign.campaignNumber));
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
          displayOnProductPage: displayOnProductPageInput,
          minDisplayPercent: Math.min(
            100,
            parseInt(minDisplayPercentInput) || 0,
          ),
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
    if (totalShares < 2) {
      toast.error(t('minShares'));
      return;
    }
    const campaignNumber = parseInt(editCampaignNumberInput) || 0;
    if (campaignNumber < 1) {
      toast.error(t('invalidCampaignNumber'));
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        campaignNumber,
        totalShares,
        displayOnProductPage: editDisplayOnProductPage,
        minDisplayPercent: Math.min(
          100,
          parseInt(editMinDisplayPercent) || 0,
        ),
      };

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

  const openAddSharesModal = (campaign: ShareCampaign) => {
    setAddSharesForCampaign(campaign);
    setAddSharesInput('1');
    setShowAddSharesModal(true);
  };

  const handleAddShares = async () => {
    if (!addSharesForCampaign) return;
    const count = parseInt(addSharesInput) || 0;
    if (count < 1) {
      toast.error(t('invalidSharesCount'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/shares/${addSharesForCampaign._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addSoldShares: count }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(extractApiError(data, t('saveError')));
        return;
      }

      toast.success(t('sharesAdded'));
      setShowAddSharesModal(false);
      void fetchCampaigns();
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const openProductModal = (group: (typeof productGroups)[number]) => {
    setSelectedProductCampaigns(group.campaigns);
    setSelectedProductName(group.productName);
    setSelectedProductMedia(group.productMedia);
    setShowProductModal(true);
  };

  const progressPercent = (campaign: ShareCampaign) => {
    if (campaign.totalShares <= 0) return 0;
    return Math.min(
      100,
      Math.max(
        0,
        Math.round((campaign.soldShares / campaign.totalShares) * 100),
      ),
    );
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

  // ── Product Thumbnail ──
  const ProductThumb = ({
    media,
    name,
    size = 'md',
  }: {
    media: ProductMediaItem[];
    name: string;
    size?: 'sm' | 'md' | 'lg';
  }) => {
    const img = getPrimaryImageUrl(media);
    const dims =
      size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
    if (!img) {
      return (
        <div
          className={`${dims} rounded-lg bg-stroke/10 flex items-center justify-center text-secondary/40`}
        >
          <ImageIcon size={size === 'sm' ? 16 : 20} />
        </div>
      );
    }
    return (
      <div className={`relative ${dims} rounded-lg overflow-hidden shrink-0`}>
        <Image
          src={img}
          alt={name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>
    );
  };

  // ── Campaign Card ──
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
        {/* Header — campaign number, status badge, and actions on one row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {isActive ? (
              <LuClock size={18} className="text-primary shrink-0" />
            ) : (
              <LuCircleCheck size={18} className="text-blue-500 shrink-0" />
            )}
            <span className="font-medium text-foreground truncate">
              {t('campaignNumber')} #{campaign.campaignNumber}
            </span>
            {isActive ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 shrink-0">
                {t('status.active')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 shrink-0">
                {t('status.completed')}
              </span>
            )}
          </div>

          {/* Actions — inline on the header row */}
          {showActions && (
            <div className="flex items-center gap-1 shrink-0">
              <Tooltip content={t('viewOrders')} position="top">
                <button
                  onClick={() => openOrdersModal(campaign)}
                  className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary"
                >
                  <LuEye size={16} />
                </button>
              </Tooltip>
              {isActive && (
                <Tooltip content={t('addReservedShares')} position="top">
                  <button
                    onClick={() => openAddSharesModal(campaign)}
                    className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary"
                  >
                    <LuPlus size={16} />
                  </button>
                </Tooltip>
              )}
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
              {!isCompleted && (
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

        {/* Progress */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground tabular-nums">
              {campaign.soldShares}/{campaign.totalShares}
            </span>
            <div className="flex-1 h-2 bg-secondary/20 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isActive ? 'bg-primary' : 'bg-blue-500'
                  }`}
                style={{ width: `${progressPercent(campaign)}%` }}
              />
            </div>
            <span className="text-xs text-secondary tabular-nums">
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
        <div className="flex items-center gap-4 text-xs text-secondary/70">
          <span>
            {t('createdLabel')}: {new Date(campaign.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
          </span>
          {isCompleted && campaign.completedAt && (
            <span>
              {t('completedAt')}: {new Date(campaign.completedAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
            </span>
          )}
        </div>
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
            const imgUrl = getPrimaryImageUrl(group.productMedia);

            return (
              <button
                key={group.productId}
                onClick={() => openProductModal(group)}
                className="text-left rounded-xl border border-stroke bg-card-bg p-4 hover:border-primary/30 hover:shadow-md transition-all"
              >
                {/* Product thumbnail + name */}
                <div className="flex items-center gap-3 mb-3">
                  {imgUrl ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                      <Image
                        src={imgUrl}
                        alt={localizedName(group.productName)}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-stroke/10 flex items-center justify-center text-secondary/40 shrink-0">
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <div className="font-medium text-foreground line-clamp-2">
                    {localizedName(group.productName)}
                  </div>
                </div>

                {/* Active campaign progress */}
                {activeCampaign ? (
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground tabular-nums">
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
                      <span className="text-xs text-secondary tabular-nums">
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
            setSelectedProductMedia([]);
          }}
          title={localizedName(selectedProductName)}
          size="xl"
        >
          <div className="space-y-4">
            {/* Product header with thumbnail */}
            <div className="flex items-center gap-3 pb-3 border-b border-stroke">
              <ProductThumb
                media={selectedProductMedia}
                name={localizedName(selectedProductName)}
                size="lg"
              />
              <div className="font-medium text-foreground text-lg">
                {localizedName(selectedProductName)}
              </div>
            </div>

            {/* Current campaign */}
            {selectedProductCampaigns.filter((c) => c.status === 'active').map((campaign) => (
              <CampaignCard key={campaign._id} campaign={campaign} />
            ))}

            {/* Divider — only if there are completed campaigns */}
            {selectedProductCampaigns.some((c) => c.status === 'completed') && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-stroke" />
                <span className="text-xs font-medium text-secondary uppercase tracking-wide">
                  {t('status.completed')}
                </span>
                <div className="flex-1 h-px bg-stroke" />
              </div>
            )}

            {/* Completed campaigns */}
            {selectedProductCampaigns
              .filter((c) => c.status === 'completed')
              .map((campaign) => (
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
          {availableProducts.length === 0 ? (
            <p className="text-sm text-secondary text-center py-8">
              {t('allProductsHaveCampaigns')}
            </p>
          ) : (
            <div>
              <Dropdown
                label={t('product')}
                value={selectedProductId}
                onChange={handleProductChange}
                options={[
                  { label: t('selectProduct'), value: '' },
                  ...availableProducts.map((p) => ({
                    label: isRTL ? p.name.ar : p.name.en,
                    value: p._id,
                  })),
                ]}
                searchable
                searchPlaceholder={t('selectProduct')}
                required
              />
            </div>
          )}

          {/* Step 2: Campaign number */}
          {availableProducts.length > 0 && (
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
          )}

          {/* Step 3: Total shares needed to complete */}
          {availableProducts.length > 0 && (
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
          )}

          {/* Step 4: Show on product page */}
          {availableProducts.length > 0 && (
            <div className="space-y-3">
              <Checkbox
                checked={displayOnProductPageInput}
                onChange={setDisplayOnProductPageInput}
                label={t('displayOnProductPage')}
                description={t('displayOnProductPageHint')}
              />
              {displayOnProductPageInput && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('minDisplayPercent')}
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={minDisplayPercentInput}
                    onChange={(e) =>
                      setMinDisplayPercentInput(onlyDigits(e.target.value))
                    }
                    onBlur={() => {
                      const parsed = parseInt(minDisplayPercentInput) || 0;
                      setMinDisplayPercentInput(
                        String(Math.min(100, Math.max(0, parsed))),
                      );
                    }}
                    placeholder="0"
                    helperText={t('minDisplayPercentHint')}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 5: Per-size shares-per-purchase */}
          {availableProducts.length > 0 && selectedProduct && (
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
          {availableProducts.length > 0 && (
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
          )}
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

            {/* Campaign code */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('campaignNumberLabel')} *
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={editCampaignNumberInput}
                onChange={(e) =>
                  setEditCampaignNumberInput(onlyDigits(e.target.value))
                }
                onBlur={() => {
                  const parsed = parseInt(editCampaignNumberInput) || 0;
                  if (parsed < 1) {
                    setEditCampaignNumberInput(
                      String(editingCampaign.campaignNumber),
                    );
                  }
                }}
              />
            </div>

            {/* Edit total shares — applies to all active campaigns
                for this product, and future ones inherit it */}
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
                helperText={t('totalSharesEditHint')}
              />
            </div>

            {/* Show on product page */}
            <div className="space-y-3">
              <Checkbox
                checked={editDisplayOnProductPage}
                onChange={setEditDisplayOnProductPage}
                label={t('displayOnProductPage')}
                description={t('displayOnProductPageHint')}
              />
              {editDisplayOnProductPage && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('minDisplayPercent')}
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={editMinDisplayPercent}
                    onChange={(e) =>
                      setEditMinDisplayPercent(onlyDigits(e.target.value))
                    }
                    onBlur={() => {
                      const parsed = parseInt(editMinDisplayPercent) || 0;
                      setEditMinDisplayPercent(
                        String(Math.min(100, Math.max(0, parsed))),
                      );
                    }}
                    placeholder="0"
                    helperText={t('minDisplayPercentHint')}
                  />
                </div>
              )}
            </div>

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

      {/* Add Reserved Shares Modal */}
      {showAddSharesModal && addSharesForCampaign && (
        <Modal
          isOpen
          onClose={() => setShowAddSharesModal(false)}
          title={t('addReservedShares')}
          size="md"
        >
          <div className="space-y-4">
            <div className="text-sm text-secondary bg-secondary/5 rounded-lg p-3 space-y-1">
              <p>
                <span className="font-medium text-foreground">
                  {localizedName(addSharesForCampaign.productName)}
                </span>
              </p>
              <p>
                {t('campaignNumber')}: #
                {addSharesForCampaign.campaignNumber}
              </p>
              <p>
                {t('shares')}: {addSharesForCampaign.soldShares}/
                {addSharesForCampaign.totalShares}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t('reservedSharesLabel')} *
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={addSharesInput}
                onChange={(e) =>
                  setAddSharesInput(onlyDigits(e.target.value))
                }
                onBlur={() => {
                  const parsed = parseInt(addSharesInput) || 0;
                  if (parsed < 1) setAddSharesInput('1');
                }}
                placeholder="1"
                helperText={t('reservedSharesHint')}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={() => setShowAddSharesModal(false)}
              >
                {t('cancel')}
              </Button>
              <Button onClick={handleAddShares} disabled={submitting}>
                {submitting ? t('saving') : t('add')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
          locale={locale}
        />
      )}

      <ConfirmModal {...modalProps} />
    </div>
  );
}

// ── Campaign Orders Modal ──
function CampaignOrdersModal({
  campaign,
  onClose,
  t,
  isRTL,
  locale,
}: {
  campaign: ShareCampaign;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  isRTL: boolean;
  locale: string;
}) {
  const [orders, setOrders] = useState<CampaignOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<CampaignOrder | null>(null);

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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(
      isRTL ? 'ar-SA' : 'en-US',
      {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-emerald-100 text-emerald-700';
      case 'partial-paid':
        return 'bg-amber-100 text-amber-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-stroke/20 text-secondary';
    }
  };

  return (
    <>
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
                  <th className="px-3 py-2 font-medium">{t('orderNumber')}</th>
                  <th className="px-3 py-2 font-medium">{t('customer')}</th>
                  <th className="px-3 py-2 font-medium">{t('shares')}</th>
                  <th className="px-3 py-2 font-medium">{t('amount')}</th>
                  <th className="px-3 py-2 font-medium">{t('orderStatus')}</th>
                  <th className="px-3 py-2 font-medium">{t('date')}</th>
                  <th className="px-3 py-2 font-medium text-right">
                    {t('viewOrder')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const shareQty =
                    order.items?.find((i) => i.isShare)?.shareQuantity || 0;
                  return (
                    <tr
                      key={order._id}
                      className="border-b border-border/50 hover:bg-secondary/5"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {order.orderNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        {order.billingData?.fullName || '-'}
                      </td>
                      <td className="px-3 py-2.5">
                        {shareQty > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                            {shareQty}
                          </span>
                        ) : (
                          <span className="text-secondary">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">
                        {order.totalAmount} {order.currency}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-secondary text-xs">
                        {new Date(order.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US')}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Tooltip content={t('viewOrder')} position="top">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg hover:bg-secondary/10 text-secondary hover:text-primary transition-colors"
                          >
                            <LuEye size={16} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* Order detail modal — uses the same shared OrderDetailModal */}
      <OrderDetailModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        loadingDetails={false}
        formatDate={formatDate}
        locale={locale}
        namespace="orders"
      />
    </>
  );
}
