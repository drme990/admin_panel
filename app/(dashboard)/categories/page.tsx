'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Category } from '@/types/Category';
import { Product } from '@/types/Product';
import { stripDesignMarkers } from '@/lib/product-name';
import Table from '@/components/ui/table';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

import {
  LuPlus,
  LuPencil,
  LuTrash2,
  LuPackage,
} from 'react-icons/lu';

const EMPTY_FORM = { name: '', categoryNumber: '', color: '#3B82F6' };

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);

  const [showProductsModal, setShowProductsModal] = useState(false);
  const [managingCategory, setManagingCategory] = useState<Category | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productsSaving, setProductsSaving] = useState(false);

  const t = useTranslations('admin.categories');
  const { confirm, modalProps } = useConfirmModal();
  const tooltipPos = useLocale() === 'ar' ? 'right' : 'left';

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to load categories');
        return;
      }
      setCategories(data.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products?limit=100');
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to load products');
        return;
      }
      setAllProducts(data.data.products);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, [fetchCategories, fetchProducts]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setShowFormModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      categoryNumber: String(category.categoryNumber),
      color: category.color,
    });
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (formSaving) return;
    setShowFormModal(false);
    setEditingCategory(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = formData.name.trim();
    const categoryNumber = formData.categoryNumber.trim();
    const color = formData.color.trim();

    if (!name || !categoryNumber || !color) {
      toast.error('Please fill all required fields');
      return;
    }

    setFormSaving(true);

    try {
      const payload = {
        name,
        categoryNumber: Number(categoryNumber),
        color,
      };

      const url = editingCategory
        ? `/api/categories/${editingCategory._id}`
        : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(
          data.error || (editingCategory ? t('messages.updateFailed') : t('messages.createFailed')),
        );
        return;
      }

      toast.success(editingCategory ? t('messages.updateSuccess') : t('messages.createSuccess'));
      closeFormModal();
      fetchCategories();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error(editingCategory ? t('messages.updateFailed') : t('messages.createFailed'));
    } finally {
      setFormSaving(false);
    }
  };
  const handleDelete = async (category: Category) => {
    const confirmed = await confirm({
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirm'),
      type: 'danger',
      confirmText: t('deleteCategory'),
      cancelText: t('buttons.cancel'),
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/categories/${category._id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t('messages.deleteFailed'));
        return;
      }
      toast.success(t('messages.deleteSuccess'));
      fetchCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(t('messages.deleteFailed'));
    }
  };

  const openProductsModal = (category: Category) => {
    setManagingCategory(category);
    setSelectedProductIds(new Set(category.products.map((p) => p._id)));
    setShowProductsModal(true);
  };

  const closeProductsModal = () => {
    if (productsSaving) return;
    setShowProductsModal(false);
    setManagingCategory(null);
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSaveProducts = async () => {
    if (!managingCategory) return;
    setProductsSaving(true);
    try {
      const res = await fetch(`/api/categories/${managingCategory._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: Array.from(selectedProductIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t('messages.updateFailed'));
        return;
      }
      toast.success(t('messages.updateSuccess'));
      closeProductsModal();
      fetchCategories();
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error(t('messages.updateFailed'));
    } finally {
      setProductsSaving(false);
    }
  };

  const productsInOtherCategories = useMemo(() => {
    const otherCategories = managingCategory
      ? categories.filter((c) => c._id !== managingCategory._id)
      : categories;
    return new Set(otherCategories.flatMap((c) => c.products.map((p) => p._id)));
  }, [categories, managingCategory]);

  const assignedProducts = allProducts.filter((p) => selectedProductIds.has(p._id));
  const availableProducts = allProducts.filter(
    (p) => !selectedProductIds.has(p._id) && !productsInOtherCategories.has(p._id),
  );

  const columns = [
    {
      header: t('table.name'),
      accessor: (category: Category) => (
        <span className="font-medium text-foreground">{category.name}</span>
      ),
    },
    {
      header: t('table.categoryNumber'),
      accessor: (category: Category) => (
        <span className="font-mono font-semibold text-primary">
          #{category.categoryNumber}
        </span>
      ),
    },
    {
      header: t('table.color'),
      accessor: (category: Category) => (
        <div className="flex items-center gap-2">
          <span
            className="w-6 h-6 rounded-md border border-stroke shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span className="font-mono text-sm text-secondary">{category.color}</span>
        </div>
      ),
    },
    {
      header: t('table.products'),
      accessor: (category: Category) => (
        <span className="text-sm text-secondary">
          {category.products.length}
        </span>
      ),
    },
    {
      header: t('table.actions'),
      accessor: (category: Category) => (
        <div className="flex items-center gap-2">
          <Tooltip position={tooltipPos} content={t('buttons.manageProducts')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                openProductsModal(category);
              }}
              aria-label={t('buttons.manageProducts')}
            >
              <LuPackage size={16} />
            </Button>
          </Tooltip>
          <Tooltip position={tooltipPos} content={t('editCategory')}>
            <Button
              variant="icon-primary"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(category);
              }}
              aria-label={t('editCategory')}
            >
              <LuPencil size={16} />
            </Button>
          </Tooltip>
          <Tooltip position={tooltipPos} content={t('deleteCategory')}>
            <Button
              variant="icon-danger"
              size="custom"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete(category);
              }}
              aria-label={t('deleteCategory')}
            >
              <LuTrash2 size={16} />
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
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-sm text-secondary">{t('description')}</p>
        </div>
        <Button type="button" onClick={openCreateModal} className="shrink-0">
          <LuPlus size={16} />
          {t('addCategory')}
        </Button>
      </div>

      <Table
        columns={columns}
        data={categories}
        loading={loading}
        emptyMessage={t('emptyMessage')}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showFormModal}
        onClose={closeFormModal}
        title={editingCategory ? t('editCategory') : t('addCategory')}
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeFormModal} disabled={formSaving}>
              {t('buttons.cancel')}
            </Button>
            <Button
              type="submit"
              form="category-form"
              disabled={formSaving}
            >
              {formSaving ? t('buttons.saving') : t('buttons.save')}
            </Button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label={t('form.name')}
            placeholder={t('form.namePlaceholder')}
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            disabled={formSaving}
          />
          <Input
            label={t('form.categoryNumber')}
            placeholder={t('form.categoryNumberPlaceholder')}
            type="number"
            min={1}
            value={formData.categoryNumber}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, categoryNumber: e.target.value }))
            }
            required
            disabled={formSaving}
          />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('form.color')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, color: e.target.value }))
                }
                disabled={formSaving}
                className="w-10 h-10 rounded-lg border border-stroke cursor-pointer bg-background disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Input
                placeholder={t('form.colorPlaceholder')}
                value={formData.color}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, color: e.target.value }))
                }
                required
                disabled={formSaving}
                className="font-mono"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Manage Products Modal */}
      <Modal
        isOpen={showProductsModal}
        onClose={closeProductsModal}
        title={`${t('productsModal.title')}${managingCategory ? ` — ${managingCategory.name}` : ''}`}
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={closeProductsModal}
              disabled={productsSaving}
            >
              {t('productsModal.cancel')}
            </Button>
            <Button onClick={handleSaveProducts} disabled={productsSaving}>
              {productsSaving ? t('productsModal.saving') : t('productsModal.save')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-secondary mb-4">{t('productsModal.description')}</p>
        <div className="grid grid-cols-2 gap-4">
          {/* Available */}
          <div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
              {t('productsModal.available')}
            </p>
            <div className="space-y-1 max-h-80 overflow-y-auto border border-stroke rounded-lg p-2">
              {availableProducts.length === 0 ? (
                <p className="text-sm text-secondary text-center py-4">
                  {t('productsModal.noAvailable')}
                </p>
              ) : (
                availableProducts.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => toggleProduct(product._id)}
                    className="w-full text-start px-3 py-2 rounded-md text-sm hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <LuPlus size={14} className="shrink-0 text-primary" />
                    <span>{stripDesignMarkers(product.name.ar)}</span>
                    {product.name.en && (
                      <span className="text-secondary text-xs truncate">
                        {stripDesignMarkers(product.name.en)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
          {/* Assigned */}
          <div>
            <p className="text-xs font-semibold text-secondary uppercase tracking-wide mb-2">
              {t('productsModal.assigned')}
            </p>
            <div className="space-y-1 max-h-80 overflow-y-auto border border-stroke rounded-lg p-2">
              {assignedProducts.length === 0 ? (
                <p className="text-sm text-secondary text-center py-4">
                  {t('productsModal.noAssigned')}
                </p>
              ) : (
                assignedProducts.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => toggleProduct(product._id)}
                    className="w-full text-start px-3 py-2 rounded-md text-sm hover:bg-error/10 hover:text-error transition-colors flex items-center gap-2"
                  >
                    <LuTrash2 size={14} className="shrink-0 text-error" />
                    <span>{stripDesignMarkers(product.name.ar)}</span>
                    {product.name.en && (
                      <span className="text-secondary text-xs truncate">
                        {stripDesignMarkers(product.name.en)}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
