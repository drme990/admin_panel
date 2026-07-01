'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Product, getPrimaryProductImageUrl } from '@/types/Product';
import Image from 'next/image';
import Table from '@/components/ui/table';
import Tabs from '@/components/ui/tabs';
import Modal from '@/components/ui/modal';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Button from '@/components/ui/button';
import Switch from '@/components/ui/switch';
import ManualPricesTab from './components/manual-prices-tab';

import { toast } from 'react-toastify';

import {
  LuPlus as Plus,
  LuPencil as Pencil,
  LuCopy as Copy,
  LuLoaderCircle as LoaderCircle,
  LuTrash2 as Trash2,
  LuArrowUp as ArrowUp,
  LuArrowDown as ArrowDown,
  LuListOrdered as ListOrdered,
  LuSettings2 as Settings2,
} from 'react-icons/lu';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'normal' | 'manual'>('normal');
  const [duplicatingProductId, setDuplicatingProductId] = useState<
    string | null
  >(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Product[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations('admin.products');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const { confirm, modalProps } = useConfirmModal();
  const ToolTipPositions = isRTL ? 'right' : 'left';

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-product-settings]')) return;
      setSettingsOpenId(null);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  // Collect unique labels from products
  const uniqueLabels = useMemo(() => {
    const labelMap = new Map<string, { ar: string; en: string }>();
    for (const product of products) {
      if (product.label) {
        const key = product.label.en;
        if (!labelMap.has(key)) {
          labelMap.set(key, product.label);
        }
      }
    }
    return Array.from(labelMap.values());
  }, [products]);

  // Filter products by selected label
  const filteredProducts = useMemo(() => {
    if (labelFilter === 'all') return products;
    if (labelFilter === 'none') {
      return products.filter((p) => !p.label);
    }
    return products.filter(
      (p) => p.label && (p.label.en === labelFilter || p.label.ar === labelFilter),
    );
  }, [products, labelFilter]);

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('deleteConfirmTitle', { defaultValue: 'Delete Product' }),
      message: t('deleteConfirm'),
      type: 'danger',
      confirmText: t('deleteConfirmButton', { defaultValue: 'Delete' }),
      cancelText: t('deleteCancelButton', { defaultValue: 'Cancel' }),
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('messages.deleteSuccess'));
        fetchProducts();
      } else {
        const data = await res.json();
        toast.error(data.error || t('messages.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      setDuplicatingProductId(id);
      const res = await fetch(`/api/products/${id}/duplicate`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || t('messages.duplicateFailed'));
      }

      toast.success(t('messages.duplicateSuccess'));
      fetchProducts();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('messages.duplicateFailed');
      toast.error(message);
    } finally {
      setDuplicatingProductId(null);
    }
  };

  const openReorderModal = () => {
    setReorderList([...products]);
    setReorderOpen(true);
  };

  const moveInModal = (index: number, direction: 'up' | 'down') => {
    const newList = [...reorderList];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    setReorderList(newList);
  };

  const saveReorder = async () => {
    setReorderSaving(true);
    try {
      const orderedIds = reorderList.map((p) => p._id);
      const res = await fetch('/api/products/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds }),
      });
      if (res.ok) {
        setProducts(reorderList);
        setReorderOpen(false);
        toast.success(t('messages.reorderSuccess'));
      } else {
        toast.error(t('messages.reorderFailed'));
      }
    } catch {
      toast.error(t('messages.reorderFailed'));
    } finally {
      setReorderSaving(false);
    }
  };

  const updateProductFlags = async (
    productId: string,
    updates: Partial<Pick<Product, 'inStock' | 'isActive'>>,
  ) => {
    try {
      setUpdatingId(productId);
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data?.error || t('messages.saveFailed'));
      }

      setProducts((prev) =>
        prev.map((product) =>
          product._id === productId ? { ...product, ...updates } : product,
        ),
      );
      toast.success(t('messages.updateSuccess'));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('messages.saveFailed');
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const columns = [
    {
      header: t('table.order'),
      accessor: (_product: Product, index?: number) => (
        <span className="text-sm font-medium text-secondary">
          {(index ?? 0) + 1}
        </span>
      ),
    },
    {
      header: t('table.image'),
      accessor: (product: Product) => {
        const img = getPrimaryProductImageUrl(product);
        return img ? (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden">
            <Image
              src={img}
              alt={product.name.ar}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-lg bg-stroke/10" />
        );
      },
    },
    {
      header: t('table.nameAr'),
      accessor: (product: Product) => (
        <span className="font-medium">{product.name.ar}</span>
      ),
    },
    {
      header: t('table.price'),
      accessor: (product: Product) => (
        <span>
          {product.sizes?.[0]?.price ?? 0} {product.baseCurrency}
        </span>
      ),
    },
    {
      header: t('table.inStock'),
      accessor: (product: Product) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${product.inStock
            ? 'bg-success/10 text-success'
            : 'bg-error/10 text-error'
            }`}
        >
          {product.inStock ? t('status.inStock') : t('status.outOfStock')}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (product: Product) => (
        <div className="flex items-center gap-2">
          <div className="relative" data-product-settings>
            <Tooltip position={ToolTipPositions} content={t('settings.title')}>
              <Button
                variant="icon-primary"
                size="custom"
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsOpenId((current) =>
                    current === product._id ? null : product._id,
                  );
                }}
                aria-label={t('settings.title')}
              >
                <Settings2 size={16} />
              </Button>
            </Tooltip>

            {settingsOpenId === product._id && (
              <div className="absolute z-20 bottom-full mb-2 w-56 rounded-lg border border-stroke bg-card-bg shadow-lg p-3 inset-e-0">
                <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-3">
                  {t('settings.title')}
                </p>
                <div className="space-y-3">
                  <Switch
                    checked={product.inStock}
                    onChange={(checked) =>
                      updateProductFlags(product._id, { inStock: checked })
                    }
                    disabled={updatingId === product._id}
                    label={t('settings.inStock')}
                  />
                  <Switch
                    checked={product.isActive}
                    onChange={(checked) =>
                      updateProductFlags(product._id, { isActive: checked })
                    }
                    disabled={updatingId === product._id}
                    label={t('settings.active')}
                  />
                </div>
              </div>
            )}
          </div>
          <Tooltip position={ToolTipPositions} content={t('editProduct')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/products/edit?id=${product._id}`);
              }}
              aria-label={t('editProduct')}
            >
              <Pencil size={16} />
            </Button>
          </Tooltip>
          <Tooltip position={ToolTipPositions} content={t('duplicateProduct')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                void handleDuplicate(product._id);
              }}
              disabled={duplicatingProductId === product._id}
              aria-label={t('duplicateProduct')}
            >
              {duplicatingProductId === product._id ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </Tooltip>
          <Tooltip position={ToolTipPositions} content={t('deleteProduct')}>
            <Button
              variant="icon-danger"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(product._id);
              }}
              aria-label={t('deleteProduct')}
            >
              <Trash2 size={16} />
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={openReorderModal}>
            <ListOrdered size={20} />
            {t('reorderButton')}
          </Button>
          <Button onClick={() => router.push('/products/new')}>
            <Plus size={20} />
            {t('addProduct')}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(val) => setActiveTab(val as 'normal' | 'manual')}
        options={[
          { value: 'normal', label: t('tabs.normal', { defaultValue: 'Products' }) },
          { value: 'manual', label: t('tabs.manual', { defaultValue: 'Manual Prices' }) },
        ]}
        size="md"
      />

      {activeTab === 'normal' && (
        <>
          {/* Label filter */}
          {uniqueLabels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setLabelFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${labelFilter === 'all'
                  ? 'bg-primary text-primary-text'
                  : 'bg-muted/50 text-secondary hover:bg-muted hover:text-foreground border border-stroke'
                  }`}
              >
                {t('filterAll', { defaultValue: 'All' })}
              </button>
              <button
                type="button"
                onClick={() => setLabelFilter('none')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${labelFilter === 'none'
                  ? 'bg-primary text-primary-text'
                  : 'bg-muted/50 text-secondary hover:bg-muted hover:text-foreground border border-stroke'
                  }`}
              >
                {t('filterNoLabel', { defaultValue: 'No label' })}
              </button>
              {uniqueLabels.map((label) => {
                const key = label.en;
                const isActive = labelFilter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLabelFilter(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isActive
                      ? 'bg-primary text-primary-text'
                      : 'bg-muted/50 text-secondary hover:bg-muted hover:text-foreground border border-stroke'
                      }`}
                  >
                    {isRTL ? label.ar : label.en}
                  </button>
                );
              })}
            </div>
          )}

          <Table
            columns={columns}
            data={filteredProducts}
            loading={loading}
            emptyMessage={t('emptyMessage')}
          />
        </>
      )}

      {activeTab === 'manual' && (
        <ManualPricesTab
          products={products}
          onProductsChange={setProducts}
        />
      )}

      <Modal
        isOpen={reorderOpen}
        onClose={() => {
          if (!reorderSaving) setReorderOpen(false);
        }}
        title={t('reorderModal.title')}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setReorderOpen(false)}
              disabled={reorderSaving}
            >
              {t('reorderModal.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={saveReorder}
              disabled={reorderSaving}
            >
              {reorderSaving ? '...' : t('reorderModal.save')}
            </Button>
          </div>
        }
      >
        <p className="text-secondary text-sm mb-4">
          {t('reorderModal.description')}
        </p>
        <div className="space-y-2 max-h-105 overflow-y-auto pe-1">
          {reorderList.map((product, index) => {
            const img = getPrimaryProductImageUrl(product);
            return (
              <div
                key={product._id}
                className="flex items-center gap-3 p-3 bg-muted/30 border border-stroke rounded-lg"
              >
                <span className="text-sm font-semibold text-secondary w-6 text-center shrink-0">
                  {index + 1}
                </span>
                {img ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <Image
                      src={img}
                      alt={product.name.ar}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-stroke/20 shrink-0" />
                )}
                <span className="flex-1 font-medium text-foreground text-sm">
                  {product.name.ar}
                </span>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={() => moveInModal(index, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    variant="icon-primary"
                    size="custom"
                    onClick={() => moveInModal(index, 'down')}
                    disabled={index === reorderList.length - 1}
                  >
                    <ArrowDown size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
