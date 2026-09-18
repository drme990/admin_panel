'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuX,
  LuPlus,
  LuSplit,
  LuRefreshCw,
  LuUpload,
  LuImage,
} from 'react-icons/lu';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import QuantityInput from '@/components/ui/quantity-input';
import Tabs from '@/components/ui/tabs';
import Textarea from '@/components/ui/textarea';
import RadioButton from '@/components/ui/radio-button';
import Switch from '@/components/ui/switch';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import MultiNameInput from '@/components/ui/multi-name-input';
import { uploadImageToR2, deleteOldImage } from '../../lib/image-upload-utils';
import { getOrderItemDisplayName } from '../../lib/order/order-utils';

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
  workAsSacrifice?: boolean;
  reservationFields?: Array<{
    key: string;
    type: string;
    label: { ar: string; en: string };
    required?: boolean;
    options?: Array<{ ar: string; en: string }>;
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

interface ReservationData {
  sacrificeFor: string;
  gender: string;
  isAlive: string;
  intention: string;
  shortDuaa: string;
  executionDate: string;
  photo: string;
}

interface SubOrderFormState {
  items: OrderItemForm[];
  reservationData: ReservationData;
  useCustomExecutionDate: boolean;
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

const DEFAULT_RESERVATION: ReservationData = {
  sacrificeFor: '',
  gender: '',
  isAlive: '',
  intention: '',
  shortDuaa: '',
  executionDate: '',
  photo: '',
};

const DEFAULT_FORM: SubOrderFormState = {
  items: [emptyItem()],
  reservationData: { ...DEFAULT_RESERVATION },
  useCustomExecutionDate: false,
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadingParentDetails, setLoadingParentDetails] = useState(false);
  const [fullParentOrder, setFullParentOrder] = useState<Order | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fetch full parent order details on open so items include price, currency, size info
  useEffect(() => {
    if (isOpen && parentOrder) {
      setLoadingParentDetails(true);
      setFullParentOrder(null);
      fetch(`/api/orders/${parentOrder._id}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.data) {
            setFullParentOrder(data.data);
          } else {
            setFullParentOrder(parentOrder);
          }
        })
        .catch(() => {
          setFullParentOrder(parentOrder);
        })
        .finally(() => setLoadingParentDetails(false));
    } else {
      setFullParentOrder(null);
    }
  }, [isOpen, parentOrder]);

  // Use full parent order if loaded, otherwise fall back to the table row data
  const displayParentOrder = fullParentOrder || parentOrder;

  // Extract the parent order's sacrificeFor name(s) so we can warn the admin
  // if they enter the same name on the sub-order. Sub-orders are meant for
  // DIFFERENT people — if it's the same person, the product should be added
  // to the parent order directly.
  const parentSacrificeFor = useMemo(() => {
    const fields = displayParentOrder?.reservationData;
    if (!Array.isArray(fields)) return '';
    const field = fields.find((f) => f.key === 'sacrificeFor');
    return (field?.value || '').trim();
  }, [displayParentOrder]);

  const parentSacrificeForNames = useMemo(
    () =>
      parentSacrificeFor
        .split(/[,،\n]/)
        .map((n) => n.trim().toLowerCase())
        .filter(Boolean),
    [parentSacrificeFor],
  );

  // Check if any name entered in the sub-order's sacrificeFor field matches
  // a name in the parent order's sacrificeFor field.
  const duplicateNameMatch = useMemo(() => {
    const enteredNames = form.reservationData.sacrificeFor
      .split(/[,،\n]/)
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    if (enteredNames.length === 0 || parentSacrificeForNames.length === 0) {
      return null;
    }
    return enteredNames.find((n) => parentSacrificeForNames.includes(n)) ?? null;
  }, [form.reservationData.sacrificeFor, parentSacrificeForNames]);

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
      setForm({
        items: [emptyItem()],
        reservationData: { ...DEFAULT_RESERVATION },
        useCustomExecutionDate: false,
      });
      setFormErrors({});
    }
  }, [isOpen]);

  const currency = displayParentOrder?.currency || 'SAR';

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

  // Compute the union of REQUIRED reservation field keys across all selected
  // existing products. Custom products contribute nothing. executionDate is
  // excluded because the backend always assigns it (defaults to next day).
  const requiredReservationFieldKeys = useMemo<Set<string>>(() => {
    const keys = new Set<string>();
    for (const item of form.items) {
      if (item.type !== 'existing' || !item.productId) continue;
      const product = products.find((p) => p._id === item.productId);
      if (!product?.reservationFields) continue;
      for (const field of product.reservationFields) {
        if (field.required && field.key !== 'executionDate') {
          keys.add(field.key);
        }
      }
    }
    return keys;
  }, [form.items, products]);

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

  // Intention options follow the MAIN (first existing) product's
  // reservationFields config exactly — the same options the customer
  // sees at checkout, including hiding عقيقة for non-sacrifice
  // products. Values stay Arabic (canonical stored value) while labels
  // follow the admin's locale. Falls back to the full preset list when
  // the main product has no intention config.
  const intentionOptions = useMemo(() => {
    const mainItem = form.items.find(
      (item) => item.type === 'existing' && item.productId,
    );
    const product = mainItem
      ? products.find((p) => p._id === mainItem.productId)
      : undefined;
    const field = product?.reservationFields?.find(
      (f) => f.key === 'intention',
    );
    const rawOptions =
      field?.options && field.options.length > 0
        ? field.options
        : [
          { ar: 'عقيقة', en: 'Aqeeqah' },
          { ar: 'أُضحيــَــة', en: 'Sacrifice' },
          { ar: 'صدقة', en: 'Charity' },
          { ar: 'نذر', en: 'Vow' },
          { ar: 'فدو', en: 'Protective' },
        ];
    // Mirrors checkout: عقيقة is hidden unless the product works as a
    // sacrifice. With no product selected, keep the full preset list.
    const hideAqeeqah = product ? !product.workAsSacrifice : false;
    return rawOptions
      .filter(
        (opt) =>
          !hideAqeeqah ||
          (!opt.en.toLowerCase().includes('aqeeqah') && opt.ar !== 'عقيقة'),
      )
      .map((opt) => {
        const value = opt.ar || opt.en;
        const label = locale === 'ar' ? opt.ar || opt.en : opt.en || opt.ar;
        return value ? { label: label || value, value } : null;
      })
      .filter((o): o is { label: string; value: string } => o !== null);
  }, [form.items, products, locale]);

  // Drop a previously chosen intention the current product selection
  // no longer allows.
  useEffect(() => {
    const current = form.reservationData.intention;
    if (!current) return;
    if (!intentionOptions.some((o) => o.value === current)) {
      setForm((prev) => ({
        ...prev,
        reservationData: { ...prev.reservationData, intention: '' },
      }));
    }
  }, [intentionOptions, form.reservationData.intention]);

  const genderOptions = useMemo(
    () => [
      { label: t('createManualOrder.genderMale') || 'Male', value: 'ذكر' },
      { label: t('createManualOrder.genderFemale') || 'Female', value: 'انثى' },
      { label: t('createManualOrder.genderBoth') || 'Both', value: 'ذكور و اناث' },
    ],
    [t],
  );

  const isAliveOptions = useMemo(
    () => [
      { label: t('createManualOrder.statusAlive') || 'Alive', value: 'حي' },
      { label: t('createManualOrder.statusDead') || 'Dead', value: 'متوفي' },
      { label: t('createManualOrder.statusBoth') || 'Both', value: 'احياء و متوفين' },
    ],
    [t],
  );

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      setUploadingPhoto(true);
      const oldPhotoUrl = form.reservationData.photo;
      const url = await uploadImageToR2(file);
      setForm((prev) => ({
        ...prev,
        reservationData: { ...prev.reservationData, photo: url },
      }));

      if (oldPhotoUrl) {
        await deleteOldImage(oldPhotoUrl);
      }
    } catch {
      toast.error(t('createManualOrder.photoUploadFailed') || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    const photoUrl = form.reservationData.photo;
    if (!photoUrl) return;

    setForm((prev) => ({
      ...prev,
      reservationData: { ...prev.reservationData, photo: '' },
    }));

    try {
      await deleteOldImage(photoUrl);
    } catch {
      // ignore
    }
  };

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (form.items.length === 0) {
      errors.items = t('createManualOrder.errors.noItems') || 'At least one item is required';
    }
    // Block submission if the sacrificeFor name matches the parent order —
    // the admin should add the product to the parent order directly instead.
    if (duplicateNameMatch) {
      errors.reservation_sacrificeFor =
        t('subOrder.duplicateNameWarning', { name: duplicateNameMatch }) ||
        'This name is already used in the parent order. Please add the product to the parent order directly.';
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
    // Enforce per-product required reservation fields (union across selected
    // existing products). Custom products contribute no required fields.
    requiredReservationFieldKeys.forEach((fieldKey) => {
      const value = (form.reservationData as unknown as Record<string, string>)[fieldKey];
      if (!value || !value.trim()) {
        errors[`reservation_${fieldKey}`] =
          t('createManualOrder.errors.reservationFieldRequired') ||
          'This reservation field is required for the selected product';
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
      const reservationData: Array<{ key: string; value: string }> = [];
      if (form.reservationData.sacrificeFor.trim()) {
        reservationData.push({ key: 'sacrificeFor', value: form.reservationData.sacrificeFor.trim() });
      }
      if (form.reservationData.gender) {
        reservationData.push({ key: 'gender', value: form.reservationData.gender });
      }
      if (form.reservationData.isAlive) {
        reservationData.push({ key: 'isAlive', value: form.reservationData.isAlive });
      }
      if (form.reservationData.intention) {
        reservationData.push({ key: 'intention', value: form.reservationData.intention });
      }
      if (form.reservationData.shortDuaa.trim()) {
        reservationData.push({ key: 'shortDuaa', value: form.reservationData.shortDuaa.trim() });
      }
      if (form.useCustomExecutionDate && form.reservationData.executionDate.trim()) {
        reservationData.push({ key: 'executionDate', value: form.reservationData.executionDate.trim() });
      }
      if (form.reservationData.photo.trim()) {
        reservationData.push({ key: 'photo', value: form.reservationData.photo.trim() });
      }

      const res = await fetch(`/api/orders/${parentOrder?._id}/sub-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: form.items.map((item) =>
            item.type === 'custom'
              ? { type: 'custom', name: item.customName.trim(), size: item.customSize.trim() || undefined, quantity: item.quantity, price: parseFloat(item.customPrice) }
              : { type: 'existing', productId: item.productId, quantity: item.quantity, sizeIndex: item.sizeIndex, customPrice: item.overridePrice ? parseFloat(item.overridePrice) : undefined }
          ),
          reservationData,
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
    setForm({
      items: [emptyItem()],
      reservationData: { ...DEFAULT_RESERVATION },
      useCustomExecutionDate: false,
    });
    setFormErrors({});
    onClose();
  };

  if (!parentOrder) return null;

  // Skeleton component for parent order summary
  const ParentOrderSkeleton = () => (
    <div className="p-4 rounded-lg bg-muted/30 border border-stroke animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded bg-stroke" />
        <div className="h-4 w-40 rounded bg-stroke" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-16 rounded bg-stroke mb-1.5" />
            <div className="h-4 w-24 rounded bg-stroke" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-stroke">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="h-3 w-12 rounded bg-stroke mb-1.5" />
            <div className="h-4 w-20 rounded bg-stroke" />
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-stroke space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-stroke" />
            <div className="h-4 w-16 rounded bg-stroke" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('subOrder.title') || 'Create Sub Order'}
      size="xl"
      contentClassName="flex flex-col gap-4 pr-1 px-4"
    >
      {/* Parent order summary */}
      {loadingParentDetails ? (
        <ParentOrderSkeleton />
      ) : displayParentOrder ? (
        <div className="p-4 rounded-lg bg-muted/30 border border-stroke">
          <div className="flex items-center gap-2 mb-3">
            <LuSplit size={18} className="text-primary" />
            <span className="font-semibold text-sm">
              {t('subOrder.parentOrder') || 'Parent Order'}: {displayParentOrder.orderNumber}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.customerInfo') || 'Customer'}</span>
              <p className="font-medium">{displayParentOrder.billingData?.fullName || 'N/A'}</p>
            </div>
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.email') || 'Email'}</span>
              <p className="font-medium truncate">{displayParentOrder.billingData?.email || 'N/A'}</p>
            </div>
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.phone') || 'Phone'}</span>
              <p className="font-medium">{displayParentOrder.billingData?.phone || 'N/A'}</p>
            </div>
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.country') || 'Country'}</span>
              <p className="font-medium">{displayParentOrder.billingData?.country || 'N/A'}</p>
            </div>
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.currency') || 'Currency'}</span>
              <p className="font-medium">{currency}</p>
            </div>
            <div>
              <span className="text-secondary text-xs">{t('createManualOrder.referral') || 'Referral'}</span>
              <p className="font-medium">{displayParentOrder.referralId || 'N/A'}</p>
            </div>
          </div>

          {/* Parent order financials */}
          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-stroke">
            <div>
              <span className="text-secondary text-xs">
                {t('createManualOrder.fullAmount') || 'Total'}
              </span>
              <p className="font-bold text-sm">
                {(displayParentOrder.fullAmount ?? displayParentOrder.totalAmount ?? 0).toFixed(2)} {currency}
              </p>
            </div>
            <div>
              <span className="text-secondary text-xs">
                {t('createManualOrder.paidAmount') || 'Paid'}
              </span>
              <p className="font-bold text-sm text-success">
                {(displayParentOrder.paidAmount ?? 0).toFixed(2)} {currency}
              </p>
            </div>
            <div>
              <span className="text-secondary text-xs">
                {t('createManualOrder.remaining') || 'Remaining'}
              </span>
              <p className="font-bold text-sm text-error">
                {(displayParentOrder.remainingAmount ?? (displayParentOrder.fullAmount ?? displayParentOrder.totalAmount ?? 0) - (displayParentOrder.paidAmount ?? 0)).toFixed(2)} {currency}
              </p>
            </div>
          </div>

          {/* Parent order items */}
          {displayParentOrder.items && displayParentOrder.items.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stroke">
              <span className="text-secondary text-xs block mb-2">
                {t('createManualOrder.items') || 'Items'}
              </span>
              <div className="flex flex-col gap-2">
                {displayParentOrder.items.map((item, i) => {
                  const price = item.price ?? 0;
                  const qty = item.quantity ?? 0;
                  const itemCurrency = item.currency || currency;
                  const displayName = getOrderItemDisplayName(item, locale);
                  return (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg bg-background border border-stroke"
                    >
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {displayName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-secondary">
                          <span>
                            {t('createManualOrder.quantity') || 'Qty'}: {qty}
                          </span>
                          <span>
                            {price.toFixed(2)} {itemCurrency}
                          </span>
                        </div>
                      </div>
                      <div className="text-end shrink-0">
                        <p className="font-bold text-sm text-success">
                          {(price * qty).toFixed(2)} {itemCurrency}
                        </p>
                        <p className="text-[11px] text-secondary">
                          {qty} x {price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-secondary mt-3 italic">
            {t('subOrder.inheritedFromParent') || 'Customer info, invoices, and payment timeline are inherited from the parent order.'}
          </p>
        </div>
      ) : null}

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

      {/* Reservation Data */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.reservationData') || 'Reservation Data'}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div data-error-key="reservation_sacrificeFor">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.sacrificeFor') || 'Sacrifice For'}
              {requiredReservationFieldKeys.has('sacrificeFor') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <MultiNameInput
              value={form.reservationData.sacrificeFor}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, sacrificeFor: value },
                }))
              }
              placeholder={t('createManualOrder.sacrificeForPlaceholder') || 'Enter name(s)'}
              isRTL={locale === 'ar'}
            />
            {duplicateNameMatch && (
              <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                {t('subOrder.duplicateNameWarning', { name: duplicateNameMatch })}
              </div>
            )}
            {formErrors[`reservation_sacrificeFor`] && !duplicateNameMatch && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_sacrificeFor`]}</p>
            )}
          </div>
          <div data-error-key="reservation_intention">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.intention') || 'Intention'}
              {requiredReservationFieldKeys.has('intention') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <Dropdown
              value={form.reservationData.intention}
              options={intentionOptions}
              onChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, intention: val },
                }))
              }
              placeholder={t('createManualOrder.selectIntention') || 'Select intention'}
            />
            {formErrors[`reservation_intention`] && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_intention`]}</p>
            )}
          </div>
          <div data-error-key="reservation_gender">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.gender') || 'Gender'}
              {requiredReservationFieldKeys.has('gender') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <div className="flex flex-wrap gap-4">
              {genderOptions.map((option) => (
                <RadioButton
                  key={`gender-${option.value}`}
                  id={`gender-${option.value}`}
                  name="sub-order-gender"
                  value={option.value}
                  label={option.label}
                  checked={form.reservationData.gender === option.value}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      reservationData: { ...prev.reservationData, gender: val },
                    }))
                  }
                />
              ))}
            </div>
            {formErrors[`reservation_gender`] && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_gender`]}</p>
            )}
          </div>
          <div data-error-key="reservation_isAlive">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.isAlive') || 'Status'}
              {requiredReservationFieldKeys.has('isAlive') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <div className="flex flex-wrap gap-4">
              {isAliveOptions.map((option) => (
                <RadioButton
                  key={`status-${option.value}`}
                  id={`status-${option.value}`}
                  name="sub-order-status"
                  value={option.value}
                  label={option.label}
                  checked={form.reservationData.isAlive === option.value}
                  onChange={(val) =>
                    setForm((prev) => ({
                      ...prev,
                      reservationData: { ...prev.reservationData, isAlive: val },
                    }))
                  }
                />
              ))}
            </div>
            {formErrors[`reservation_isAlive`] && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_isAlive`]}</p>
            )}
          </div>
          <div className="sm:col-span-2" data-error-key="reservation_shortDuaa">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.shortDuaa') || 'Short Duaa'}
              {requiredReservationFieldKeys.has('shortDuaa') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <Textarea
              value={form.reservationData.shortDuaa}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, shortDuaa: value },
                }))
              }
              placeholder={t('createManualOrder.shortDuaa') || 'Short Duaa'}
              rows={2}
              maxLength={250}
              showCount
            />
            {formErrors[`reservation_shortDuaa`] && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_shortDuaa`]}</p>
            )}
          </div>

          <div className="sm:col-span-2 mb-3" data-error-key="reservation_photo">
            <label className="text-xs font-medium text-secondary mb-1.5 block">
              {t('createManualOrder.photo') || 'Photo'}
              {requiredReservationFieldKeys.has('photo') && (
                <span className="text-error ms-0.5">*</span>
              )}
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                size="custom"
                className="px-3 py-2"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <LuRefreshCw size={16} className="animate-spin me-2" />
                ) : (
                  <LuUpload size={16} className="me-2" />
                )}
                {form.reservationData.photo
                  ? t('createManualOrder.changePhoto') || 'Change Photo'
                  : t('createManualOrder.uploadPhoto') || 'Upload Photo'}
              </Button>

              {form.reservationData.photo && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-error/30 text-error hover:bg-error/10 transition-colors shrink-0"
                  title={t('createManualOrder.removePhoto') || 'Remove Photo'}
                >
                  <LuX size={16} />
                </button>
              )}
            </div>

            {form.reservationData.photo && (
              <div className="mt-3">
                <div className="relative w-64 h-64 rounded-lg overflow-hidden border border-stroke shrink-0 group">
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided URL */}
                  <img
                    src={form.reservationData.photo}
                    alt="User photo"
                    className="w-full h-full object-cover"
                  />
                  <a
                    href={form.reservationData.photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors"
                    title={t('createManualOrder.viewPhoto') || 'View Photo'}
                  >
                    <LuImage size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </div>
              </div>
            )}
            {formErrors[`reservation_photo`] && (
              <p className="text-xs text-error mt-1">{formErrors[`reservation_photo`]}</p>
            )}
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoFileChange}
          />
        </div>

        <div className="flex flex-col gap-3 mt-4">
          <Switch
            checked={form.useCustomExecutionDate}
            onChange={(checked) => {
              setForm((prev) => ({
                ...prev,
                useCustomExecutionDate: checked,
                reservationData: checked
                  ? prev.reservationData
                  : { ...prev.reservationData, executionDate: '' },
              }));
            }}
            label={t('createManualOrder.customExecutionDate') || 'Custom Execution Date'}
          />
          {form.useCustomExecutionDate && (
            <CustomDatePicker
              value={form.reservationData.executionDate}
              onChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, executionDate: val },
                }))
              }
              locale={locale}
              placeholder={t('createManualOrder.executionDate') || 'Execution Date'}
              minDate={(() => {
                const today = new Date();
                return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
              })()}
            />
          )}
          {!form.useCustomExecutionDate && (
            <p className="text-sm text-secondary">
              {t('createManualOrder.defaultExecutionDateHint') || 'Default execution date will be assigned automatically.'}
            </p>
          )}
        </div>
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
