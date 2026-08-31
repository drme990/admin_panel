'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  LuMinus,
  LuPlus,
  LuX,
  LuTag,
} from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import { Order, OrderItem } from '@/types/Order';
import { Product, ProductSize } from '@/types/Product';
import { Referral } from '@/types/Referral';
import { RESERVATION_FIELD_PRESETS } from '@/lib/reservation-fields';

/**
 * Get the base-currency price for a size.
 * Uses the dedicated `basePrice` field if available, falls back to
 * the base-currency entry in `prices[]` for old docs.
 */
function getBasePriceForSize(
  size: ProductSize | undefined,
  baseCurrency: string,
): number {
  if (!size) return 0;
  if (size.basePrice > 0) return size.basePrice;
  const base = baseCurrency.toUpperCase();
  const entry = size.prices?.find(
    (p) => p.currencyCode.toUpperCase() === base,
  );
  return entry?.amount ?? 0;
}

/** Placeholder product ID used for custom/manual order items. */
const MANUAL_ORDER_PRODUCT_ID = '__manual_order__';

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
    referralId?: string;
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
  const [referralId, setReferralId] = useState('');
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

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
      setItems(order.items ? order.items.map((it) => ({ ...it })) : []);
      const genderPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'gender');
      const isAlivePreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'isAlive');
      const intentionPreset = RESERVATION_FIELD_PRESETS.find((p) => p.key === 'intention');
      setGender(normalizePresetValue(getReservationValue(order, 'gender'), genderPreset));
      setIsAlive(normalizePresetValue(getReservationValue(order, 'isAlive'), isAlivePreset));
      setIntention(normalizePresetValue(getReservationValue(order, 'intention'), intentionPreset));
      setReferralId(order.referralId || '');
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

  // Load referral codes when the name editor opens (referral is edited
  // alongside sacrificeFor / gender / status)
  const shouldLoadReferrals = isOpen && field === 'name';
  const [prevShouldLoadRef, setPrevShouldLoadRef] = useState(shouldLoadReferrals);
  if (shouldLoadReferrals !== prevShouldLoadRef) {
    setPrevShouldLoadRef(shouldLoadReferrals);
    if (shouldLoadReferrals && referrals.length === 0) setLoadingReferrals(true);
  }

  useEffect(() => {
    if (!shouldLoadReferrals) return;
    if (referrals.length > 0) return;
    fetch('/api/referrals?limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setReferrals(data.data.referrals || []);
      })
      .catch(() => { })
      .finally(() => setLoadingReferrals(false));
  }, [shouldLoadReferrals, referrals.length]);

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

  // ── Price editing ──────────────────────────────────────────────
  const handleChangeItemPrice = useCallback((index: number, raw: string) => {
    const num = parseFloat(raw);
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        price: Number.isFinite(num) && num >= 0 ? num : 0,
      };
      return next;
    });
  }, []);

  // ── Custom product field editing ───────────────────────────────
  const handleChangeCustomName = useCallback((index: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productName: { ar: value, en: value },
      };
      return next;
    });
  }, []);

  const handleChangeCustomSize = useCallback((index: number, value: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], customSize: value };
      return next;
    });
  }, []);

  // ── Toggle an existing item between Existing / Custom ──────────
  const handleToggleCustom = useCallback((index: number, isCustom: boolean) => {
    setItems((prev) => {
      const next = [...prev];
      if (isCustom) {
        // Preserve the current name/price/quantity; mark as custom
        const current = next[index];
        const currentName = current.productName?.ar || current.productName?.en || '';
        next[index] = {
          ...current,
          productId: MANUAL_ORDER_PRODUCT_ID,
          productSlug: undefined,
          isCustom: true,
          sizeIndex: undefined,
          sizeName: undefined,
          productName: { ar: currentName, en: currentName },
        };
      } else {
        // Switching back to existing — clear custom flags; the user must
        // pick a product from the dropdown which will repopulate fields.
        next[index] = {
          ...next[index],
          isCustom: false,
          customSize: undefined,
          productId: '',
          productSlug: undefined,
          productName: { ar: '', en: '' },
          sizeIndex: 0,
          sizeName: { ar: '', en: '' },
        };
      }
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!order || !field) return;
    const fields: Parameters<typeof onUpdate>[1] = {};
    if (field === 'name') {
      fields.sacrificeFor = names.filter(Boolean).join(', ');
      fields.gender = gender;
      fields.isAlive = isAlive;
      fields.referralId = referralId;
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
    // Keep the current sizeIndex if it exists in the new product, otherwise fall back to 0
    const prevItem = items[index];
    const keptIndex =
      prevItem?.productId === product._id &&
        typeof prevItem?.sizeIndex === 'number' &&
        prevItem.sizeIndex >= 0 &&
        prevItem.sizeIndex < product.sizes.length
        ? prevItem.sizeIndex
        : 0;
    const size = product.sizes[keptIndex] ?? product.sizes[0];
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        productId: product._id,
        productSlug: product.slug,
        productName: product.name,
        price: getBasePriceForSize(size, product.baseCurrency),
        currency: product.baseCurrency,
        sizeIndex: keptIndex,
        sizeName: size?.name ?? { ar: '', en: '' },
        isCustom: false,
        customSize: undefined,
      };
      return next;
    });
  };

  const handleChangeItemSize = (index: number, sizeIndex: number) => {
    const item = items[index];
    if (!item) return;
    const product = products.find((p) => p._id === item.productId);
    if (!product) return;
    const size = product.sizes[sizeIndex];
    if (!size) return;
    setItems((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        price: getBasePriceForSize(size, product.baseCurrency),
        currency: product.baseCurrency,
        sizeIndex,
        sizeName: size.name ?? { ar: '', en: '' },
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
        price: getBasePriceForSize(size, product.baseCurrency),
        currency: product.baseCurrency,
        quantity: 1,
        sizeIndex: 0,
        sizeName: size?.name ?? { ar: '', en: '' },
      },
    ]);
  };

  const handleAddCustomItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: MANUAL_ORDER_PRODUCT_ID,
        productName: { ar: '', en: '' },
        price: 0,
        currency: order?.currency || 'EGP',
        quantity: 1,
        isCustom: true,
        customSize: '',
      },
    ]);
  };

  // ── Live total + status preview ────────────────────────────────
  const orderCurrency = (order?.currency || 'EGP').toUpperCase();
  const paidAmount = order?.paidAmount ?? 0;

  const newTotal = useMemo(() => {
    // Simple sum in the order's currency. The backend does proper
    // currency conversion; this is just a preview.
    return items.reduce((sum, item) => {
      const itemCurrency = (item.currency || orderCurrency).toUpperCase();
      const subtotal = (item.price || 0) * (item.quantity || 1);
      // If the item currency differs from the order currency we still
      // show the raw sum — the backend will convert properly on save.
      if (itemCurrency !== orderCurrency) {
        // Best-effort: just add the raw number so the admin sees a
        // rough total. The authoritative total is computed server-side.
        return sum + subtotal;
      }
      return sum + subtotal;
    }, 0);
  }, [items, orderCurrency]);

  const newRemaining = Math.max(0, newTotal - paidAmount);
  const previewStatus: 'paid' | 'partial-paid' | 'pending' =
    newTotal > 0 && paidAmount >= newTotal
      ? 'paid'
      : paidAmount > 0
        ? 'partial-paid'
        : 'pending';

  const statusLabelMap: Record<string, string> = {
    paid: t('editOrder.statusPaid'),
    'partial-paid': t('editOrder.statusPartialPaid'),
    pending: t('editOrder.statusPending'),
  };

  const itemTypeOptions = useMemo(
    () => [
      { label: t('editOrder.existingProduct') || 'Existing', value: 'existing' },
      { label: t('editOrder.customProduct') || 'Custom', value: 'custom' },
    ],
    [t],
  );

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
      className="overflow-visible"
      contentClassName='overflow-y-auto'
    >
      <div className="space-y-5">
        {field === 'name' && (
          <div className="space-y-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-stroke">
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

            {/* Referral code */}
            <div className="pt-4 border-t border-stroke">
              <Dropdown
                label={t('editOrder.referralCode') || 'Referral Code'}
                value={referralId}
                options={[
                  { label: t('editOrder.noReferral') || 'No referral', value: '' },
                  ...referrals.map((r) => ({
                    label: `${r.referralId} — ${r.name}`,
                    value: r.referralId,
                  })),
                ]}
                onChange={(val) => setReferralId(val)}
                placeholder={loadingReferrals ? (t('editOrder.loadingReferrals') || 'Loading...') : (t('editOrder.selectReferral') || 'Select referral')}
              />
            </div>
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
          <div className="space-y-5">
            <div className="space-y-3">
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
            </div>

            {loadingProducts && (
              <p className="text-sm text-secondary">{t('editOrder.loadingProducts')}</p>
            )}

            <div className="space-y-4">
              {items.map((item, index) => {
                const isCustom = !!item.isCustom || item.productId === MANUAL_ORDER_PRODUCT_ID;
                const productOptions = products.map((p) => ({
                  label: locale === 'ar' ? p.name?.ar : p.name?.en,
                  value: p._id,
                }));
                const selectedProduct = products.find((p) => p._id === item.productId);
                const hasMultipleSizes = (selectedProduct?.sizes?.length ?? 0) > 1;
                const sizeOptions = (selectedProduct?.sizes ?? []).map((s, i) => ({
                  label: locale === 'ar' ? s.name?.ar : s.name?.en,
                  value: String(i),
                }));
                const itemSubtotal = (item.price || 0) * (item.quantity || 1);
                return (
                  <div
                    key={index}
                    className="flex flex-col gap-4 p-4 rounded-xl border border-stroke bg-background/50"
                  >
                    {/* Row 1: type toggle (Existing / Custom) + remove */}
                    <div className="flex items-center justify-between gap-3">
                      <Tabs
                        value={isCustom ? 'custom' : 'existing'}
                        options={itemTypeOptions}
                        onChange={(val) => handleToggleCustom(index, val === 'custom')}
                        size="sm"
                      />
                      <Button
                        variant="ghost"
                        size="custom"
                        className="h-7 w-7 p-0 text-secondary hover:text-error shrink-0"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <LuX size={14} />
                      </Button>
                    </div>

                    {/* Row 2: product/name + size */}
                    {isCustom ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          value={item.productName?.ar || item.productName?.en || ''}
                          onChange={(e) => handleChangeCustomName(index, e.target.value)}
                          placeholder={t('editOrder.customNamePlaceholder')}
                          className="w-full"
                        />
                        <Input
                          value={item.customSize || ''}
                          onChange={(e) => handleChangeCustomSize(index, e.target.value)}
                          placeholder={t('editOrder.customSizePlaceholder')}
                          className="w-full"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex-1 w-full sm:w-auto min-w-0">
                          <Dropdown
                            value={String(item.productId || '')}
                            options={productOptions}
                            onChange={(value) => handleChangeItemProduct(index, value)}
                            placeholder={t('editOrder.selectProduct')}
                            className="w-full"
                          />
                        </div>
                        {hasMultipleSizes && (
                          <div className="w-full sm:w-40 shrink-0">
                            <Dropdown
                              value={String(item.sizeIndex ?? 0)}
                              options={sizeOptions}
                              onChange={(value) => handleChangeItemSize(index, Number(value))}
                              placeholder={t('editOrder.selectSize')}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Row 3: price + currency + quantity + subtotal */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-stroke/60">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-secondary whitespace-nowrap">
                          {t('editOrder.price')}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={String(item.price ?? 0)}
                          onChange={(e) => handleChangeItemPrice(index, e.target.value)}
                          className="w-24"
                        />
                        <span className="text-xs text-secondary whitespace-nowrap">
                          {item.currency || orderCurrency}
                        </span>
                      </div>
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
                      <span className="text-sm font-medium text-foreground whitespace-nowrap sm:ml-auto">
                        = {itemSubtotal.toFixed(2)} {item.currency || orderCurrency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add existing product */}
            <div className="pt-4 border-t border-stroke">
              <p className="text-sm font-medium text-foreground mb-3">
                {t('editOrder.addItem')}
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomItem}
                  className="shrink-0"
                >
                  <LuTag size={14} className="mr-1" />
                  {t('editOrder.addCustomProduct')}
                </Button>
              </div>
            </div>

            {/* Total + status preview */}
            <div className="pt-4 border-t border-stroke space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">{t('editOrder.newTotal')}</span>
                <span className="font-semibold text-foreground">
                  {newTotal.toFixed(2)} {orderCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">{t('editOrder.paidAmount')}</span>
                <span className="font-semibold text-foreground">
                  {paidAmount.toFixed(2)} {orderCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">{t('editOrder.remainingAmount')}</span>
                <span className="font-semibold text-foreground">
                  {newRemaining.toFixed(2)} {orderCurrency}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-stroke">
                <span className="text-secondary">{t('editOrder.previewStatus')}</span>
                <span className="font-semibold text-foreground">
                  {statusLabelMap[previewStatus] || previewStatus}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
