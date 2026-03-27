'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types/Product';
import {
  LuPlus as Plus,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuArrowUp as ArrowUp,
  LuArrowDown as ArrowDown,
  LuListOrdered as ListOrdered,
} from 'react-icons/lu';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Button from '@/components/ui/button';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [reorderList, setReorderList] = useState<Product[]>([]);
  const [reorderSaving, setReorderSaving] = useState(false);
  const router = useRouter();
  const t = useTranslations('admin.products');
  const { confirm, modalProps } = useConfirmModal();
  const ToolTipPositions = useLocale() === 'ar' ? 'right' : 'left';

  useEffect(() => {
    fetchProducts();
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
        const img = product.images?.[0];
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
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            product.inStock
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

      <Table
        columns={columns}
        data={products}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

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
            const img = product.images?.[0];
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
