'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuX,
  LuPlus,
  LuSplit,
  LuRefreshCw,
} from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import QuantityInput from '@/components/ui/quantity-input';
import Tabs from '@/components/ui/tabs';

import { Order } from '@/types/Order';

interface Product {
  _id: string;
  name: { ar: string; en: string };
  slug: string;
  baseCurrency: string;
  sizes: Array<{
    name?: { ar: string; en: string };
    prices?: Array<{ currencyCode: string; amount: number }>;
    manualPrice?: number | null;
    isAvailable?: boolean;
    designName?: string;
  }>;
}

interface OrderItemForm {
  type: 'existing' | 'custom';
  productId: string;
  sizeIndex: number;
  quantity: number;
  overridePrice: string;
  customName: string;
  customSize: string;
  customPrice: string;
}

interface SubOrderFormState {
  items: OrderItemForm[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentOrder: Order | null;
  namespace?: 'orders' | 'execution';
}

function emptyItem(): OrderItemForm {
  return {
    type: 'existing',
    productId: '',
    sizeIndex: 0,
    quantity: 1,
    overridePrice: '',
    customName: '',
    customSize: '',
    customPrice: '',
  };
}

const DEFAULT_FORM: SubOrderFormState = {
  items: [emptyItem()],
};

export default function CreateSubOrderModal({
  isOpen,
  onClose,
  onSuccess,
  parentOrder,
  namespace = 'orders',
}: Props) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const [form, setForm] = useState<SubOrderFormState>(DEFAULT_FORM);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch products on open
  useEffect(() => {
    if (isOpen) {
      setLoadingProducts(true);
      fetch('/api/products?status=Active', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setProducts(data.data.products || []);
          }
        })
        .catch(() => {
          toast.error(t('createManualOrder.loadProductsFailed') || 'Failed to load products');
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, t]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({ ...DEFAULT_FORM, items: [emptyItem()] });
      setFormErrors({});
    }
  }, [isOpen]);

  const currency = parentOrder?.currency || 'SAR';

  const productOptions = useMemo(
    () => [
      { label: t('createManualOrder.selectProduct') || 'Select product', value: '' },
      ...products.map((p) => ({
        label: locale === 'ar' ? p.name.ar : p.name.en,
        value: p._id,
      })),
    ],
    [products, locale, t],
  );

  const getSizeOptions = (productId: string) => {
    const product = products.find((p) => p._id === productId);
    if (!product || product.sizes.length <= 1) return [];
    return product.sizes.map((s, i) => ({
      label: locale === 'ar' ? s.name?.ar || `Size ${i + 1}` : s.name?.en || `Size ${i + 1}`,
      value: i,
    }));
  };

  const getLoadedUnitPrice = useCallback((item: OrderItemForm): number => {
    const product = products.find((p) => p._id === item.productId);
    if (!product) return 0;
    const size = product.sizes[item.sizeIndex] || product.sizes[0];
    if (!size) return 0;
    if (typeof size.manualPrice === 'number' && size.manualPrice > 0 && currency === 'EGP') {
      return size.manualPrice;
    }
    const priceEntry = size.prices?.find((p) => p.currencyCode === currency);
    return priceEntry?.amount || 0;
  }, [products, currency]);

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()],
    }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const updateItem = (index: number, updates: Partial<OrderItemForm>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    }));
  };

  const fullOrderTotal = useMemo(() => {
    return form.items.reduce((sum, item) => {
      if (item.type === 'custom') {
        const price = parseFloat(item.customPrice) || 0;
        return sum + price * item.quantity;
      }
      const override = parseFloat(item.overridePrice);
      const price = Number.isFinite(override) && override >= 0 ? override : getLoadedUnitPrice(item);
      return sum + price * item.quantity;
    }, 0);
  }, [form.items, getLoadedUnitPrice]);

  const itemTypeOptions = useMemo(
    () => [
      { label: t('createManualOrder.product') || 'Product', value: 'existing' },
      { label: t('createManualOrder.customProduct') || 'Custom', value: 'custom' },
    ],
    [t],
  );

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (form.items.length === 0) {
      errors.items = t('createManualOrder.errors.noItems') || 'At least one item is required';
    }
    form.items.forEach((item, index) => {
      if (item.type === 'existing') {
        if (!item.productId) {
          errors[`item_${index}_product`] = t('createManualOrder.errors.productRequired') || 'Product is required';
        }
      } else {
        if (!item.customName.trim()) {
          errors[`item_${index}_name`] = t('createManualOrder.errors.nameRequired') || 'Name is required';
        }
        const customPrice = parseFloat(item.customPrice);
        if (!Number.isFinite(customPrice) || customPrice <= 0) {
          errors[`item_${index}_price`] = t('createManualOrder.errors.priceRequired') || 'Price must be greater than zero';
        }
      }
    });
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const firstErrorKey = Object.keys(errors)[0];
      const el = document.querySelector(`[data-error-key="${firstErrorKey}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = el.querySelector('input, textarea, button');
        if (input) (input as HTMLElement).focus();
      }
      return;
    }

    setFormErrors({});
    setCreating(true);
    try {
      const res = await fetch(`/api/orders/${parentOrder?._id}/sub-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: form.items.map((item) =>
            item.type === 'custom'
              ? { type: 'custom', name: item.customName.trim(), size: item.customSize.trim() || undefined, quantity: item.quantity, price: parseFloat(item.customPrice) }
              : { type: 'existing', productId: item.productId, quantity: item.quantity, sizeIndex: item.sizeIndex, customPrice: item.overridePrice ? parseFloat(item.overridePrice) : undefined }
          ),
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create sub-order');

      toast.success(t('subOrder.successTitle') || 'Sub order created successfully');
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create sub-order');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setForm({ ...DEFAULT_FORM, items: [emptyItem()] });
    setFormErrors({});
    onClose();
  };

  if (!parentOrder) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('subOrder.title') || 'Create Sub Order'}
      size="xl"
      contentClassName="flex flex-col gap-4 pr-1 px-4"
    >
      {/* Parent order summary */}
      <div className="p-4 rounded-lg bg-muted/30 border border-stroke">
        <div className="flex items-center gap-2 mb-3">
          <LuSplit size={18} className="text-primary" />
          <span className="font-semibold text-sm">
            {t('subOrder.parentOrder') || 'Parent Order'}: {parentOrder.orderNumber}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.customerInfo') || 'Customer'}</span>
            <p className="font-medium">{parentOrder.billingData?.fullName || 'N/A'}</p>
          </div>
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.email') || 'Email'}</span>
            <p className="font-medium truncate">{parentOrder.billingData?.email || 'N/A'}</p>
          </div>
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.phone') || 'Phone'}</span>
            <p className="font-medium">{parentOrder.billingData?.phone || 'N/A'}</p>
          </div>
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.country') || 'Country'}</span>
            <p className="font-medium">{parentOrder.billingData?.country || 'N/A'}</p>
          </div>
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.currency') || 'Currency'}</span>
            <p className="font-medium">{currency}</p>
          </div>
          <div>
            <span className="text-secondary text-xs">{t('createManualOrder.referral') || 'Referral'}</span>
            <p className="font-medium">{parentOrder.referralId || 'N/A'}</p>
          </div>
        </div>
        <p className="text-xs text-secondary mt-3 italic">
          {t('subOrder.inheritedFromParent') || 'Customer info, invoices, and payment timeline are inherited from the parent order.'}
        </p>
      </div>

      {/* Items section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{t('createManualOrder.items') || 'Items'}</h3>
          <Button variant="outline" size="sm" onClick={addItem}>
            <LuPlus size={16} />
            <span>{t('createManualOrder.addItem') || 'Add Item'}</span>
          </Button>
        </div>

        {form.items.map((item, index) => {
          const sizeOpts = getSizeOptions(item.productId);
          const itemErrorKey = item.type === 'custom' ? `item_${index}_name` : `item_${index}_product`;
          return (
            <div
              key={index}
              className="flex flex-col gap-3 p-3 rounded-lg border border-stroke bg-background/50"
              data-error-key={itemErrorKey}
            >
              <div className="flex items-center justify-between">
                <Tabs
                  value={item.type}
                  options={itemTypeOptions}
                  onChange={(val) => updateItem(index, { type: val as 'existing' | 'custom' })}
                  size="sm"
                />
                {index > 0 && (
                  <Button variant="icon-danger" size="custom" onClick={() => removeItem(index)} aria-label="Remove item">
                    <LuX size={16} />
                  </Button>
                )}
              </div>

              {item.type === 'existing' ? (
                <>
                  <div className="flex flex-row gap-2 sm:gap-3 items-center">
                    <div className="shrink-0 w-20 sm:w-28 self-stretch">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItem(index, { quantity: val })}
                      />
                    </div>
                    <div className={`flex-1 min-w-0 ${locale === 'ar' ? 'mr-2' : 'ml-2'}`}>
                      <Dropdown
                        value={item.productId}
                        options={productOptions}
                        onChange={(val) => {
                          const product = products.find((p) => p._id === val);
                          const size = product?.sizes?.[0];
                          let price = 0;
                          if (size) {
                            if (typeof size.manualPrice === 'number' && size.manualPrice > 0 && currency === 'EGP') {
                              price = size.manualPrice;
                            } else {
                              price = size.prices?.find((p) => p.currencyCode === currency)?.amount || 0;
                            }
                          }
                          updateItem(index, {
                            productId: val,
                            sizeIndex: 0,
                            overridePrice: price > 0 ? String(price) : '',
                          });
                        }}
                        placeholder={t('createManualOrder.selectProduct') || 'Select product'}
                        disabled={loadingProducts}
                        error={formErrors[`item_${index}_product`]}
                        searchable
                      />
                    </div>
                  </div>
                  {sizeOpts.length > 1 && (
                    <div className="mt-1">
                      <Dropdown
                        value={item.sizeIndex}
                        options={sizeOpts}
                        onChange={(val) => {
                          const product = products.find((p) => p._id === item.productId);
                          const size = product?.sizes?.[val];
                          let price = 0;
                          if (size) {
                            if (typeof size.manualPrice === 'number' && size.manualPrice > 0 && currency === 'EGP') {
                              price = size.manualPrice;
                            } else {
                              price = size.prices?.find((p) => p.currencyCode === currency)?.amount || 0;
                            }
                          }
                          updateItem(index, {
                            sizeIndex: val,
                            overridePrice: price > 0 ? String(price) : '',
                          });
                        }}
                      />
                    </div>
                  )}
                  <div className="flex flex-row gap-2 sm:gap-3 items-center mt-1">
                    <div className="flex-1 min-w-0">
                      <Input
                        type="number"
                        value={item.overridePrice}
                        onChange={(e) => updateItem(index, { overridePrice: e.target.value })}
                        placeholder={t('createManualOrder.price') || 'Price'}
                      />
                    </div>
                    <div className="shrink-0 w-24 sm:w-28">
                      <Input value={currency} readOnly className="text-center" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-row gap-2 sm:gap-3 items-center">
                    <div className="shrink-0 w-20 sm:w-28 self-stretch">
                      <QuantityInput
                        value={item.quantity}
                        onChange={(val) => updateItem(index, { quantity: val })}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Input
                        value={item.customName}
                        placeholder={t('createManualOrder.customNamePlaceholder') || 'Product name'}
                        onChange={(e) => updateItem(index, { customName: e.target.value })}
                        error={formErrors[`item_${index}_name`]}
                      />
                    </div>
                  </div>
                  <Input
                    value={item.customSize}
                    placeholder={t('createManualOrder.customSizePlaceholder') || 'Size (optional)'}
                    onChange={(e) => updateItem(index, { customSize: e.target.value })}
                  />
                  <div className="flex flex-row gap-2 sm:gap-3 items-center mt-1">
                    <div className="flex-1 min-w-0">
                      <Input
                        type="number"
                        value={item.customPrice}
                        onChange={(e) => updateItem(index, { customPrice: e.target.value })}
                        placeholder={t('createManualOrder.price') || 'Price'}
                        error={formErrors[`item_${index}_price`]}
                      />
                    </div>
                    <div className="shrink-0 w-24 sm:w-28">
                      <Input value={currency} readOnly className="text-center" />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
        <span className="font-semibold text-sm">{t('createManualOrder.fullAmount') || 'Total'}</span>
        <span className="font-bold text-lg">
          {fullOrderTotal.toFixed(2)} {currency}
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={handleClose} disabled={creating}>
          {t('createManualOrder.cancel') || 'Cancel'}
        </Button>
        <Button onClick={handleSubmit} disabled={creating || loadingProducts}>
          {creating ? <LuRefreshCw size={16} className="animate-spin" /> : null}
          <span>{creating ? (t('createManualOrder.creating') || 'Creating...') : (t('subOrder.create') || 'Create Sub Order')}</span>
        </Button>
      </div>
    </Modal>
  );
}
