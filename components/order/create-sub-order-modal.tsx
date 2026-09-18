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
import Switch from '@/components/ui/switch';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import ManualReservationFields from '@/components/order/manual-reservation-fields';
import { uploadImageToR2, deleteOldImage } from '../../lib/image-upload-utils';
import { getOrderItemDisplayName } from '../../lib/order/order-utils';
import {
  getVisibleFieldOptions,
  isExecutionDateKey,
  mergeProductReservationFields,
  parsePictureUrls,
  serializePictureUrls,
  toIsoLocalDate,
} from '@/lib/reservation-fields';

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
    maxLength?: number;
    supportsMulti?: boolean;
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
  [key: string]: string;
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
  const [uploadingPictureField, setUploadingPictureField] = useState<string | null>(null);
  const [blockedExecutionDates, setBlockedExecutionDates] = useState<string[]>([]);
  const [loadingParentDetails, setLoadingParentDetails] = useState(false);
  const [fullParentOrder, setFullParentOrder] = useState<Order | null>(null);

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

      // Blocked execution dates for the custom-date picker (same
      // restriction the checkout date picker enforces).
      fetch('/api/booking', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          const dates = data?.data?.blockedExecutionDates;
          if (Array.isArray(dates)) {
            setBlockedExecutionDates(
              dates.filter((d): d is string => typeof d === 'string'),
            );
          }
        })
        .catch(() => {
          // Non-fatal — the backend still validates blocked dates.
        });
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

  // Merge the reservation field configs of all selected existing products
  // — the union of fields any selected product accepts, deduplicated by
  // key and ordered like checkout. Custom products contribute nothing.
  const selectedProducts = useMemo(
    () =>
      form.items
        .filter((item) => item.type === 'existing' && item.productId)
        .map((item) => products.find((p) => p._id === item.productId))
        .filter((p): p is Product => p !== undefined),
    [form.items, products],
  );

  const mergedReservationFields = useMemo(
    () => mergeProductReservationFields(selectedProducts),
    [selectedProducts],
  );

  // executionDate is handled by the custom-date switch below — the
  // backend always assigns one. When a selected product marks it
  // required, the switch is forced on.
  const executionDateRequired = useMemo(
    () =>
      mergedReservationFields.some(
        (f) => isExecutionDateKey(f.key) && f.required,
      ),
    [mergedReservationFields],
  );
  const effectiveUseCustomExecutionDate =
    form.useCustomExecutionDate || executionDateRequired;

  // Drop stale reservation values the current product selection no
  // longer accepts — keys not in the merged config, and select/radio
  // values outside the field's visible options. executionDate is
  // switch-controlled and skipped.
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev.reservationData };
      let changed = false;

      const acceptedKeys = new Set(mergedReservationFields.map((f) => f.key));
      for (const key of Object.keys(next)) {
        if (isExecutionDateKey(key)) continue;
        if (!acceptedKeys.has(key) && next[key]) {
          next[key] = '';
          changed = true;
        }
      }

      for (const field of mergedReservationFields) {
        if (field.type !== 'select' && field.type !== 'radio') continue;
        const current = next[field.key];
        if (!current) continue;
        const options = getVisibleFieldOptions(field);
        if (
          options.length > 0 &&
          !options.some((o) => o.ar === current || o.en === current)
        ) {
          next[field.key] = '';
          changed = true;
        }
      }

      return changed ? { ...prev, reservationData: next } : prev;
    });
  }, [mergedReservationFields]);

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

  // Picture fields accept up to 4 images and store them as a
  // JSON-array string — the same format checkout produces.
  const handleUploadPictures = async (fieldKey: string, files: File[]) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    const valid = files.filter(
      (f) => allowedTypes.includes(f.type) && f.size <= 5 * 1024 * 1024,
    );
    if (valid.length === 0) {
      toast.error(t('createManualOrder.photoUploadFailed') || 'Failed to upload photo');
      return;
    }

    const existing = parsePictureUrls(form.reservationData[fieldKey] || '');
    const toUpload = valid.slice(0, Math.max(0, 4 - existing.length));
    if (toUpload.length === 0) return;

    try {
      setUploadingPictureField(fieldKey);
      const urls = await Promise.all(toUpload.map((f) => uploadImageToR2(f)));
      setForm((prev) => {
        const current = parsePictureUrls(prev.reservationData[fieldKey] || '');
        return {
          ...prev,
          reservationData: {
            ...prev.reservationData,
            [fieldKey]: serializePictureUrls([...current, ...urls].slice(0, 4)),
          },
        };
      });
    } catch {
      toast.error(t('createManualOrder.photoUploadFailed') || 'Failed to upload photo');
    } finally {
      setUploadingPictureField(null);
    }
  };

  const handleRemovePicture = (fieldKey: string, url: string) => {
    setForm((prev) => {
      const current = parsePictureUrls(prev.reservationData[fieldKey] || '');
      return {
        ...prev,
        reservationData: {
          ...prev.reservationData,
          [fieldKey]: serializePictureUrls(current.filter((u) => u !== url)),
        },
      };
    });
    deleteOldImage(url).catch(() => {
      // ignore
    });
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
    // Enforce per-product reservation field rules — the same validation
    // checkout applies: required fields, text/textarea maxLength, and
    // select/radio values restricted to the field's visible options.
    for (const field of mergedReservationFields) {
      if (isExecutionDateKey(field.key)) continue;
      const value = (form.reservationData[field.key] || '').trim();

      if (field.required && !value) {
        errors[`reservation_${field.key}`] =
          t('createManualOrder.errors.reservationFieldRequired') ||
          'This reservation field is required for the selected product';
        continue;
      }
      if (!value) continue;

      if (
        (field.type === 'text' || field.type === 'textarea') &&
        field.maxLength &&
        value.length > field.maxLength
      ) {
        errors[`reservation_${field.key}`] =
          t('createManualOrder.errors.reservationMaxLength', { max: field.maxLength }) ||
          `This field is limited to ${field.maxLength} characters`;
      }

      if (field.type === 'select' || field.type === 'radio') {
        const options = getVisibleFieldOptions(field);
        if (
          options.length > 0 &&
          !options.some((o) => o.ar === value || o.en === value)
        ) {
          errors[`reservation_${field.key}`] =
            t('createManualOrder.errors.invalidReservationOption') ||
            'Invalid option for the selected product';
        }
      }
    }

    // Custom execution date — same restrictions as checkout: required
    // while the switch is on, strictly after today, never a blocked date.
    if (effectiveUseCustomExecutionDate) {
      const execValue = form.reservationData.executionDate.trim();
      const today = toIsoLocalDate(new Date());
      if (!execValue) {
        errors[`reservation_executionDate`] =
          t('createManualOrder.errors.reservationFieldRequired') ||
          'This reservation field is required for the selected product';
      } else if (execValue <= today) {
        errors[`reservation_executionDate`] =
          t('createManualOrder.errors.executionDatePast') ||
          'Execution date must be after today';
      } else if (blockedExecutionDates.includes(execValue)) {
        errors[`reservation_executionDate`] =
          t('createManualOrder.errors.executionDateBlocked') ||
          'Execution date is not available';
      }
    }
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
      // Reservation answers are built from the merged product field
      // config — the same {key, label, type, value} shape checkout
      // submits. The backend re-validates everything against the
      // products' own config.
      const reservationData = mergedReservationFields
        .filter((f) => !isExecutionDateKey(f.key))
        .map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          value: (form.reservationData[f.key] || '').trim(),
        }));
      if (
        effectiveUseCustomExecutionDate &&
        form.reservationData.executionDate.trim()
      ) {
        reservationData.push({
          key: 'executionDate',
          label: { ar: 'تاريخ التنفيذ', en: 'Execution Date' },
          type: 'date',
          value: form.reservationData.executionDate.trim(),
        });
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
        <ManualReservationFields
          fields={mergedReservationFields.filter((f) => !isExecutionDateKey(f.key))}
          values={form.reservationData}
          errors={
            duplicateNameMatch
              ? { ...formErrors, reservation_sacrificeFor: undefined }
              : formErrors
          }
          locale={locale}
          t={t}
          uploadingField={uploadingPictureField}
          blockedExecutionDates={blockedExecutionDates}
          onValueChange={(key, value) =>
            setForm((prev) => ({
              ...prev,
              reservationData: { ...prev.reservationData, [key]: value },
            }))
          }
          onUploadPictures={handleUploadPictures}
          onRemovePicture={handleRemovePicture}
          fieldFooters={{
            sacrificeFor: duplicateNameMatch ? (
              <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                {t('subOrder.duplicateNameWarning', { name: duplicateNameMatch })}
              </div>
            ) : undefined,
          }}
        />

        <div className="flex flex-col gap-3 mt-4">
          <Switch
            checked={effectiveUseCustomExecutionDate}
            disabled={executionDateRequired}
            onChange={(checked) => {
              setForm((prev) => ({
                ...prev,
                useCustomExecutionDate: checked,
                reservationData: checked
                  ? prev.reservationData
                  : { ...prev.reservationData, executionDate: '' },
              }));
            }}
            label={
              `${t('createManualOrder.customExecutionDate') || 'Custom Execution Date'}${executionDateRequired ? ' *' : ''}`
            }
          />
          {effectiveUseCustomExecutionDate && (
            <>
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
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  return toIsoLocalDate(tomorrow);
                })()}
                disabledDates={blockedExecutionDates}
              />
              {formErrors[`reservation_executionDate`] && (
                <p className="text-xs text-error mt-1">{formErrors[`reservation_executionDate`]}</p>
              )}
            </>
          )}
          {!effectiveUseCustomExecutionDate && (
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
