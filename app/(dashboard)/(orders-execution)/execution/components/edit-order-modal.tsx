'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuUpload,
  LuDownload,
  LuShare2,
  LuMinus,
  LuPlus,
  LuX,
} from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Tooltip from '@/components/ui/tooltip';
import Dropdown from '@/components/ui/dropdown';
import { Order, OrderItem } from '@/types/Order';
import { Product } from '@/types/Product';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  field: 'name' | 'items' | 'duaa' | 'photo' | null;
  onUpdate: (orderId: string, fields: {
    sacrificeFor?: string;
    shortDuaa?: string;
    photo?: string;
    items?: OrderItem[];
  }) => Promise<boolean>;
  updating: boolean;
}

function getReservationValue(order: Order | null, key: string): string {
  return order?.reservationData?.find((f) => f.key === key)?.value || '';
}

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  field,
  onUpdate,
  updating,
}: Props) {
  const t = useTranslations('execution');
  const locale = useLocale();
  const tooltipPos = locale === 'ar' ? 'right' : 'left';

  const [names, setNames] = useState<string[]>([]);
  const [shortDuaa, setShortDuaa] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    if (isOpen && order) {
      const rawNames = getReservationValue(order, 'sacrificeFor');
      setNames(
        rawNames
          .split(/,|;|\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      setShortDuaa(getReservationValue(order, 'shortDuaa'));
      setPhotoUrl(getReservationValue(order, 'photo'));
      setItems(order.items ? [...order.items] : []);
    }
  }, [isOpen, order]);

  useEffect(() => {
    if (isOpen && field === 'items') {
      setLoadingProducts(true);
      fetch('/api/products')
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setProducts(data.data.products || []);
        })
        .catch(() => { })
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, field]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast.error(t('editOrder.invalidImage'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoUrl(reader.result as string);
        setFileInputKey((k) => k + 1);
      };
      reader.readAsDataURL(file);
    },
    [t],
  );

  const handleDownload = useCallback(() => {
    if (!photoUrl) return;
    const a = document.createElement('a');
    a.href = photoUrl;
    a.download = `photo-${order?.orderNumber || 'order'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }, [photoUrl, order?.orderNumber]);

  const handleShare = useCallback(async () => {
    if (!photoUrl) {
      toast.error(t('editOrder.noPhotoToShare'));
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Order ${order?.orderNumber || ''}`,
          url: photoUrl,
        });
      } else {
        await navigator.clipboard.writeText(photoUrl);
        toast.success(t('editOrder.photoUrlCopied'));
      }
    } catch {
      // user cancelled share
    }
  }, [photoUrl, order?.orderNumber, t]);

  const handleQuantityChange = useCallback(
    (index: number, delta: number) => {
      setItems((prev) => {
        const next = [...prev];
        const nextQty = Math.max(1, (next[index].quantity || 1) + delta);
        next[index] = { ...next[index], quantity: nextQty };
        return next;
      });
    },
    [],
  );

  const handleSave = async () => {
    if (!order || !field) return;
    const fields: Parameters<typeof onUpdate>[1] = {};
    if (field === 'name')
      fields.sacrificeFor = names.filter(Boolean).join(', ');
    if (field === 'duaa') fields.shortDuaa = shortDuaa;
    if (field === 'photo') fields.photo = photoUrl;
    if (field === 'items') fields.items = items;
    const success = await onUpdate(order._id, fields);
    if (success) {
      onClose();
    }
  };

  const handleAddName = () => setNames((prev) => [...prev, '']);
  const handleRemoveName = (index: number) =>
    setNames((prev) => prev.filter((_, i) => i !== index));
  const handleChangeName = (index: number, value: string) =>
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)));

  const handleRemoveItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index));

  const handleChangeItemProduct = (index: number, productId: string) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;
    const size = product.sizes[0];
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product._id,
        productSlug: product.slug,
        productName: product.name,
        price: size?.price ?? 0,
        currency: product.baseCurrency,
        sizeIndex: 0,
        sizeName: size?.name ?? { ar: '', en: '' },
      };
      return next;
    });
  };

  const handleAddItem = (productId: string) => {
    const product = products.find((p) => p._id === productId);
    if (!product) return;
    const size = product.sizes[0];
    setItems((prev) => [
      ...prev,
      {
        productId: product._id,
        productSlug: product.slug,
        productName: product.name,
        price: size?.price ?? 0,
        currency: product.baseCurrency,
        quantity: 1,
        sizeIndex: 0,
        sizeName: size?.name ?? { ar: '', en: '' },
      },
    ]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        field === 'name' ? t('editOrder.sacrificeFor') :
          field === 'duaa' ? t('editOrder.shortDuaa') :
            field === 'photo' ? t('editOrder.photo') :
              field === 'items' ? t('editOrder.items') :
                t('editOrder.title')
      }
      size="lg"
      footer={
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose} disabled={updating}>
            {t('editOrder.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={updating}
          >
            {updating ? t('editOrder.saving') : t('editOrder.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {field === 'name' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('editOrder.sacrificeFor')}
            </label>
            <div className="space-y-2">
              {names.map((name, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => handleChangeName(index, e.target.value)}
                    placeholder={t('editOrder.sacrificeForPlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-8 w-8 p-0 text-secondary hover:text-error shrink-0"
                    onClick={() => handleRemoveName(index)}
                  >
                    <LuX size={16} />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddName}
              className="mt-1"
            >
              <LuPlus size={14} className="mr-1" />
              {t('editOrder.addName')}
            </Button>
          </div>
        )}

        {field === 'duaa' && (
          <Textarea
            label={t('editOrder.shortDuaa')}
            value={shortDuaa}
            onChange={(value) => setShortDuaa(value)}
            placeholder={t('editOrder.shortDuaaPlaceholder')}
            rows={3}
          />
        )}

        {field === 'photo' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              {t('editOrder.photo')}
            </label>
            <div className="flex gap-2 items-center">
              <Input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder={t('editOrder.photoPlaceholder')}
                className="flex-1"
              />
              <Tooltip position={tooltipPos} content={t('editOrder.uploadPhoto')}>
                <label className="inline-flex cursor-pointer">
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <span className="font-medium transition-all duration-200 rounded-site flex items-center justify-center border border-stroke text-foreground hover:bg-foreground hover:text-background px-4 py-2 text-sm cursor-pointer">
                    <LuUpload size={16} />
                  </span>
                </label>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('editOrder.downloadPhoto')}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!photoUrl}
                >
                  <LuDownload size={16} />
                </Button>
              </Tooltip>
              <Tooltip position={tooltipPos} content={t('editOrder.sharePhoto')}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  disabled={!photoUrl}
                >
                  <LuShare2 size={16} />
                </Button>
              </Tooltip>
            </div>
            {photoUrl && (
              <a
                href={photoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2"
              >
                <img
                  src={photoUrl}
                  alt="Preview"
                  className="h-24 w-24 object-cover rounded border border-stroke"
                />
              </a>
            )}
          </div>
        )}

        {field === 'items' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              {t('editOrder.items')}
            </label>

            {loadingProducts && (
              <p className="text-sm text-secondary">{t('editOrder.loadingProducts')}</p>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const productOptions = products.map((p) => ({
                  label: locale === 'ar' ? p.name?.ar : p.name?.en,
                  value: p._id,
                }));
                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border border-stroke bg-background"
                  >
                    <div className="flex-1 w-full sm:w-auto min-w-0">
                      <Dropdown
                        value={String(item.productId)}
                        options={productOptions}
                        onChange={(value) => handleChangeItemProduct(index, value)}
                        placeholder={t('editOrder.selectProduct')}
                        className="w-full"
                      />
                    </div>
                    <span className="text-sm text-secondary whitespace-nowrap">
                      {item.price} {item.currency}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-7 w-7 p-0"
                        onClick={() => handleQuantityChange(index, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <LuMinus size={14} />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-7 w-7 p-0"
                        onClick={() => handleQuantityChange(index, 1)}
                      >
                        <LuPlus size={14} />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-7 w-7 p-0 text-secondary hover:text-error shrink-0"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <LuX size={14} />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-stroke">
              <p className="text-sm font-medium text-foreground mb-2">
                {t('editOrder.addItem')}
              </p>
              <div className="flex items-center gap-2">
                <Dropdown
                  value=""
                  options={products.map((p) => ({
                    label: locale === 'ar' ? p.name?.ar : p.name?.en,
                    value: p._id,
                  }))}
                  onChange={(value) => {
                    if (value) handleAddItem(value);
                  }}
                  placeholder={t('editOrder.selectProduct')}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
