'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  LuMinus,
  LuPlus,
  LuX,
} from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Dropdown from '@/components/ui/dropdown';
import { Order, OrderItem } from '@/types/Order';
import { Product } from '@/types/Product';
import { RESERVATION_FIELD_PRESETS } from '@/lib/reservation-fields';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  field: 'name' | 'items' | 'duaa' | null;
  onUpdate: (orderId: string, fields: {
    sacrificeFor?: string;
    shortDuaa?: string;
    items?: OrderItem[];
    gender?: string;
    isAlive?: string;
    intention?: string;
  }) => Promise<boolean>;
  updating: boolean;
}

function getReservationValue(order: Order | null, key: string): string {
  return order?.reservationData?.find((f) => f.key === key)?.value || '';
}

function normalizePresetValue(
  storedValue: string,
  preset: { options?: Array<{ ar: string; en: string }> } | undefined,
): string {
  if (!storedValue || !preset?.options) return '';
  const matched = preset.options.find(
    (o) => o.ar === storedValue || o.en === storedValue,
  );
  if (!matched) return '';
  // Always return the Arabic value — it's the canonical value stored in the DB.
  // The design app's renderer reads these fields (intention, gender, isAlive)
  // from the DB and expects Arabic strings.
  return matched.ar;
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

  const [names, setNames] = useState<string[]>([]);
  const [shortDuaa, setShortDuaa] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [gender, setGender] = useState('');
  const [isAlive, setIsAlive] = useState('');
  const [intention, setIntention] = useState('');

  const [prevOpenOrder, setPrevOpenOrder] = useState<{
    open: boolean;
    order: Order | null;
    locale: string;
  }>({ open: isOpen, order, locale });
  if (
    isOpen !== prevOpenOrder.open ||
    order !== prevOpenOrder.order ||
    locale !== prevOpenOrder.locale
  ) {
    setPrevOpenOrder({ open: isOpen, order, locale });
    if (isOpen && order) {
      const rawNames = getReservationValue(order, 'sacrificeFor');
      setNames(
        rawNames
          .split(/,|;|\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      );
      setShortDuaa(getReservationValue(order, 'shortDuaa'));
      setItems(order.items ? [...order.items] : []);
      const genderPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'gender');
      const isAlivePreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'isAlive');
      const intentionPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'intention');
      setGender(normalizePresetValue(getReservationValue(order, 'gender'), genderPreset));
      setIsAlive(normalizePresetValue(getReservationValue(order, 'isAlive'), isAlivePreset));
      setIntention(normalizePresetValue(getReservationValue(order, 'intention'), intentionPreset));
    }
  }

  const shouldLoadProducts = isOpen && field === 'items';
  const [prevShouldLoad, setPrevShouldLoad] = useState(shouldLoadProducts);
  if (shouldLoadProducts !== prevShouldLoad) {
    setPrevShouldLoad(shouldLoadProducts);
    if (shouldLoadProducts) setLoadingProducts(true);
  }

  useEffect(() => {
    if (!shouldLoadProducts) return;
    fetch('/api/products')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setProducts(data.data.products || []);
      })
      .catch(() => { })
      .finally(() => setLoadingProducts(false));
  }, [shouldLoadProducts]);

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
    if (field === 'name') {
      fields.sacrificeFor = names.filter(Boolean).join(', ');
      fields.gender = gender;
      fields.isAlive = isAlive;
    }
    if (field === 'duaa') fields.shortDuaa = shortDuaa;
    if (field === 'items') {
      fields.items = items;
      fields.intention = intention;
    }
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

            {(() => {
              const genderPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'gender');
              const isAlivePreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'isAlive');
              const genderOptions = genderPreset?.options?.map((o) => ({
                label: locale === 'ar' ? o.ar : o.en,
                value: o.ar,
              })) || [];
              const isAliveOptions = isAlivePreset?.options?.map((o) => ({
                label: locale === 'ar' ? o.ar : o.en,
                value: o.ar,
              })) || [];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-stroke">
                  <Dropdown
                    label={locale === 'ar' ? genderPreset?.label?.ar : genderPreset?.label?.en}
                    value={gender}
                    options={genderOptions}
                    onChange={(val) => setGender(val)}
                  />
                  <Dropdown
                    label={locale === 'ar' ? isAlivePreset?.label?.ar : isAlivePreset?.label?.en}
                    value={isAlive}
                    options={isAliveOptions}
                    onChange={(val) => setIsAlive(val)}
                  />
                </div>
              );
            })()}
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

        {field === 'items' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              {t('editOrder.items')}
            </label>

            {(() => {
              const intentionPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'intention');
              const intentionOptions = intentionPreset?.options?.map((o) => ({
                label: locale === 'ar' ? o.ar : o.en,
                value: o.ar,
              })) || [];
              return (
                <Dropdown
                  label={locale === 'ar' ? intentionPreset?.label?.ar : intentionPreset?.label?.en}
                  value={intention}
                  options={intentionOptions}
                  onChange={(val) => setIntention(val)}
                />
              );
            })()}

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
                        value={String(item.productId || '')}
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
