'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Product, ReservationField } from '@/types/Product';
import Input from '@/components/ui/input';
import Switch from '@/components/ui/switch';
import Button from '@/components/ui/button';
import MultiCurrencyPriceEditor, {
  CurrencyPrice,
} from '@/components/admin/multi-currency-price-editor';
import MultiCurrencyMinimumPaymentEditor, {
  CurrencyMinimumPayment,
} from '@/components/admin/multi-currency-minimum-payment-editor';
import MultiImageUpload from '@/components/admin/multi-image-upload';
import RichTextEditor from '@/components/ui/rich-text-editor';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { Plus, X, ClipboardList } from 'lucide-react';
import Loading from '../ui/loading';
import Dropdown from '@/components/ui/dropdown';
import { roundPrice } from '@/lib/currency-rounding';

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
}

export default function ProductForm({
  product,
  onSubmit,
  loading = false,
}: ProductFormProps) {
  const defaultSize = {
    name: { ar: '', en: '' },
    price: 0,
    prices: [] as CurrencyPrice[],
    feedsUp: 0,
  };

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    slug: '',
    content_ar: '',
    content_en: '',
    baseCurrency: 'SAR',
    inStock: true,
    isActive: true,
    images: [] as string[],
    partialPayment: {
      isAllowed: false,
      minimumType: 'percentage' as 'percentage' | 'fixed',
      minimumPayments: [] as CurrencyMinimumPayment[],
      baseMinimumValue: 50,
    },
    sizes: [{ ...defaultSize }] as {
      name: { ar: string; en: string };
      price: number;
      prices: CurrencyPrice[];
      feedsUp: number;
    }[],
    workAsSacrifice: false,
    sacrificeCount: 1,
    upgradeTo: '' as string,
    upgradeDiscount: 0,
    upgradeFeaturesAr: '',
    upgradeFeaturesEn: '',
    canBeUpgraded: false,
    reservationFields: [] as ReservationField[],
  });
  const [addedPricePercentage, setAddedPricePercentage] = useState<number>(0);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isFormDataReady, setIsFormDataReady] = useState(false);
  const isInitialMount = useRef(true);
  const t = useTranslations('admin.products');
  const router = useRouter();

  // Fetch all products for upgrade dropdown
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAllProducts(d.data.products || []);
      })
      .catch(() => {});
  }, []);

  // Initialize form data when product prop changes
  useEffect(() => {
    if (product) {
      // Set ready to false while updating
      setIsFormDataReady(false);

      setFormData({
        name_ar: product.name.ar,
        name_en: product.name.en,
        slug: product.slug || '',
        content_ar: product.content?.ar || '',
        content_en: product.content?.en || '',
        baseCurrency: product.baseCurrency || 'SAR',
        inStock: product.inStock,
        isActive: product.isActive !== false,
        images: product.images || [],
        partialPayment: {
          isAllowed: product.partialPayment?.isAllowed || false,
          minimumType: product.partialPayment?.minimumType || 'percentage',
          minimumPayments: product.partialPayment?.minimumPayments || [],
          baseMinimumValue:
            product.partialPayment?.minimumPayments?.[0]?.value || 50,
        },
        sizes:
          product.sizes?.length > 0
            ? product.sizes.map((s) => ({
                name: { ar: s.name.ar || '', en: s.name.en || '' },
                price: s.price || 0,
                prices: s.prices || [],
                feedsUp: s.feedsUp ?? 0,
              }))
            : [{ ...defaultSize }],
        workAsSacrifice: product.workAsSacrifice || false,
        sacrificeCount: product.sacrificeCount ?? 1,
        upgradeTo: product.upgradeTo || '',
        upgradeDiscount: product.upgradeDiscount ?? 0,
        upgradeFeaturesAr: (product.upgradeFeatures?.ar || []).join('\n'),
        upgradeFeaturesEn: (product.upgradeFeatures?.en || []).join('\n'),
        canBeUpgraded: !!product.upgradeTo,
        reservationFields: product.reservationFields || [],
      });

      // Use setTimeout to ensure state is updated before setting ready
      setTimeout(() => {
        setIsFormDataReady(true);
        setHasChanges(false);
        isInitialMount.current = true;
      }, 0);
    } else {
      setIsFormDataReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id]);

  // Track form changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setHasChanges(true);
  }, [formData]);

  // Block Ctrl+R and Ctrl+Shift+R
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        toast.info(
          t('messages.refreshDisabled') || 'Refresh is disabled while editing',
        );
        return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        toast.info(
          t('messages.refreshDisabled') || 'Refresh is disabled while editing',
        );
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [t]);

  // Show warning before leaving if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const handleApplyPriceIncrease = () => {
    if (!addedPricePercentage || addedPricePercentage <= 0) {
      toast.error(t('messages.invalidPercentage'));
      return;
    }
    const multiplier = 1 + addedPricePercentage / 100;
    const updatedSizes = formData.sizes.map((size) => ({
      ...size,
      price: Math.ceil(size.price * multiplier),
      prices: size.prices.map((p) => ({
        ...p,
        amount: roundPrice(p.amount * multiplier, p.currencyCode),
      })),
    }));
    setFormData({ ...formData, sizes: updatedSizes });
    toast.success(
      t('messages.priceIncreased', { percentage: addedPricePercentage }),
    );
    setAddedPricePercentage(0);
  };

  const addSize = () => {
    setFormData({
      ...formData,
      sizes: [...formData.sizes, { ...defaultSize }],
    });
  };

  const removeSize = (index: number) => {
    if (formData.sizes.length <= 1) {
      toast.error(
        t('messages.minOneSize') || 'Product must have at least one size',
      );
      return;
    }
    setFormData({
      ...formData,
      sizes: formData.sizes.filter((_, i) => i !== index),
    });
  };

  const updateSize = (
    index: number,
    field: string,
    value: string | number | CurrencyPrice[],
  ) => {
    const updatedSizes = [...formData.sizes];
    const size = { ...updatedSizes[index] };

    if (field === 'name.ar') {
      size.name = { ...size.name, ar: value as string };
    } else if (field === 'name.en') {
      size.name = { ...size.name, en: value as string };
    } else if (field === 'price') {
      size.price = value as number;
    } else if (field === 'prices') {
      size.prices = value as CurrencyPrice[];
    } else if (field === 'feedsUp') {
      size.feedsUp = value as number;
    }

    updatedSizes[index] = size;
    setFormData({ ...formData, sizes: updatedSizes });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedSlug = formData.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalizedSlug) {
      toast.error(t('form.slugHelp'));
      return;
    }

    const productData = {
      name: { ar: formData.name_ar, en: formData.name_en },
      slug: normalizedSlug,
      content: {
        ar: formData.content_ar.replace(/&nbsp;/g, ' '),
        en: formData.content_en.replace(/&nbsp;/g, ' '),
      },
      baseCurrency: formData.baseCurrency,
      inStock: formData.inStock,
      isActive: formData.isActive,
      images: formData.images,
      partialPayment: {
        isAllowed: formData.partialPayment.isAllowed,
        minimumType: formData.partialPayment.minimumType,
        minimumPayments: formData.partialPayment.minimumPayments,
      },
      sizes: formData.sizes,
      workAsSacrifice: formData.workAsSacrifice,
      sacrificeCount: formData.workAsSacrifice ? formData.sacrificeCount : 1,
      upgradeTo: formData.upgradeTo || null,
      upgradeDiscount: formData.upgradeTo ? formData.upgradeDiscount : 0,
      upgradeFeatures: (() => {
        const ar = formData.upgradeFeaturesAr
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean);
        const en = formData.upgradeFeaturesEn
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean);

        if (ar.length === 0 && en.length === 0) return null;
        return { ar, en };
      })(),
      reservationFields: formData.reservationFields,
    };

    try {
      await onSubmit(productData);
      // Reset change tracking after successful submission
      setHasChanges(false);
    } catch (error) {
      // If submission fails, keep hasChanges as true
      console.error('Form submission error:', error);
    }
  };

  // Don't render form until data is ready (prevents RichTextEditor from mounting with empty content)
  if (product && !isFormDataReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic product information */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('form.nameAr')}
            type="text"
            required
            value={formData.name_ar}
            onChange={(e) =>
              setFormData({ ...formData, name_ar: e.target.value })
            }
          />
          <Input
            label={t('form.nameEn')}
            type="text"
            required
            value={formData.name_en}
            onChange={(e) =>
              setFormData({ ...formData, name_en: e.target.value })
            }
          />
        </div>

        <Input
          label={t('form.slug')}
          type="text"
          required
          value={formData.slug}
          onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
          placeholder={t('form.slugPlaceholder')}
          helperText={t('form.slugHelp')}
        />

        <RichTextEditor
          key={`content_ar_${product?._id || 'new'}`}
          label={t('form.contentAr')}
          helperText={t('form.contentHelp')}
          value={formData.content_ar}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, content_ar: value }))
          }
          placeholder={t('form.contentPlaceholder')}
          dir="rtl"
        />

        <RichTextEditor
          key={`content_en_${product?._id || 'new'}`}
          label={t('form.contentEn')}
          helperText={t('form.contentHelp')}
          value={formData.content_en}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, content_en: value }))
          }
          placeholder={t('form.contentPlaceholder')}
          dir="ltr"
        />

        <MultiImageUpload
          images={formData.images}
          onChange={(images) => setFormData({ ...formData, images })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Switch
            id="inStock"
            checked={formData.inStock}
            onChange={(checked) =>
              setFormData({ ...formData, inStock: checked })
            }
            label={t('form.inStockLabel')}
          />
          <Switch
            id="isActive"
            checked={formData.isActive}
            onChange={(checked) =>
              setFormData({ ...formData, isActive: checked })
            }
            label={t('form.isActiveLabel', { defaultValue: 'Active' })}
          />
        </div>
      </section>

      <hr className="border-stroke" />

      {/* Pricing and payment setup */}
      <section className="space-y-4">
        <MultiCurrencyPriceEditor
          mainCurrency={formData.baseCurrency}
          basePrice={formData.sizes[0]?.price ?? 0}
          prices={[]}
          onChange={() => {}}
          onMainCurrencyChange={(currency) => {
            setFormData({
              ...formData,
              baseCurrency: currency,
            });
          }}
          onBasePriceChange={() => {}}
          hidePrice
        />

        <div className="border border-stroke rounded-lg p-4 bg-background space-y-3">
          <label className="block text-sm font-medium">
            {t('form.addedPrice')}
          </label>
          <p className="text-xs text-secondary">{t('form.addedPriceHelp')}</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                type="number"
                value={addedPricePercentage || ''}
                onChange={(e) =>
                  setAddedPricePercentage(parseFloat(e.target.value) || 0)
                }
                placeholder={t('form.addedPricePlaceholder')}
                min="0"
                step="0.1"
              />
            </div>
            <Button
              type="button"
              onClick={handleApplyPriceIncrease}
              disabled={!addedPricePercentage || addedPricePercentage <= 0}
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('form.applyButton')}
            </Button>
          </div>
        </div>

        <div className="border border-stroke rounded-lg p-4 bg-background space-y-4">
          <Switch
            id="allowPartialPayment"
            checked={formData.partialPayment.isAllowed}
            onChange={(checked) =>
              setFormData({
                ...formData,
                partialPayment: {
                  ...formData.partialPayment,
                  isAllowed: checked,
                },
              })
            }
            label={t('form.allowPartialPayment')}
          />
          {formData.partialPayment.isAllowed && (
            <div className="pt-2">
              <MultiCurrencyMinimumPaymentEditor
                mainCurrency={formData.baseCurrency}
                minimumPaymentType={formData.partialPayment.minimumType}
                baseMinimumValue={formData.partialPayment.baseMinimumValue}
                minimumPayments={formData.partialPayment.minimumPayments}
                prices={formData.sizes[0]?.prices || []}
                onChange={(minimumPayments) =>
                  setFormData({
                    ...formData,
                    partialPayment: {
                      ...formData.partialPayment,
                      minimumPayments,
                    },
                  })
                }
                onTypeChange={(type) =>
                  setFormData({
                    ...formData,
                    partialPayment: {
                      ...formData.partialPayment,
                      minimumType: type,
                    },
                  })
                }
                onBaseValueChange={(value) =>
                  setFormData({
                    ...formData,
                    partialPayment: {
                      ...formData.partialPayment,
                      baseMinimumValue: value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="border border-stroke rounded-lg p-4 bg-background space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">{t('form.sizes')}</h3>
              <p className="text-xs text-secondary mt-1">
                {t('form.sizesHelp')}
              </p>
            </div>
            <Button
              type="button"
              onClick={addSize}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Plus size={16} />
              {t('form.addSize')}
            </Button>
          </div>

          {formData.sizes.map((size, index) => (
            <div
              key={index}
              className="border border-stroke rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t('form.sizeNumber', { number: index + 1 })}
                </h4>
                <Button
                  variant="custom"
                  type="button"
                  onClick={() => removeSize(index)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  title={t('form.removeSize')}
                >
                  <X size={16} />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label={t('form.sizeNameAr')}
                  type="text"
                  value={size.name.ar}
                  onChange={(e) => updateSize(index, 'name.ar', e.target.value)}
                />
                <Input
                  label={t('form.sizeNameEn')}
                  type="text"
                  value={size.name.en}
                  onChange={(e) => updateSize(index, 'name.en', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-secondary">
                  {t('form.sizePrice')}
                </label>
                <Input
                  label={`${t('form.sizeBasePrice')} (${formData.baseCurrency})`}
                  type="number"
                  value={size.price || ''}
                  onChange={(e) =>
                    updateSize(index, 'price', parseFloat(e.target.value) || 0)
                  }
                  min="0"
                  step="0.01"
                />
                {size.price > 0 && (
                  <MultiCurrencyPriceEditor
                    mainCurrency={formData.baseCurrency}
                    basePrice={size.price}
                    prices={size.prices}
                    onChange={(prices) => updateSize(index, 'prices', prices)}
                    onMainCurrencyChange={() => {}}
                    onBasePriceChange={() => {}}
                    compact
                  />
                )}
              </div>

              <Input
                label={t('form.feedsUpLabel')}
                type="number"
                value={size.feedsUp || ''}
                onChange={(e) =>
                  updateSize(index, 'feedsUp', parseInt(e.target.value) || 0)
                }
                min="0"
                helperText={t('form.feedsUpHelp')}
              />
            </div>
          ))}
        </div>
      </section>

      <hr className="border-stroke" />

      {/* Advanced product behavior */}
      <section className="space-y-4">
        <div className="space-y-3 p-4 border border-stroke rounded-site">
          <p className="text-sm font-semibold text-foreground">
            {t('form.sacrificeSection')}
          </p>
          <Switch
            id="workAsSacrifice"
            checked={formData.workAsSacrifice}
            onChange={(checked) =>
              setFormData({ ...formData, workAsSacrifice: checked })
            }
            label={t('form.workAsSacrificeLabel')}
          />
          {formData.workAsSacrifice && (
            <Input
              label={t('form.sacrificeCountLabel')}
              type="number"
              min={1}
              value={formData.sacrificeCount}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  sacrificeCount: Math.max(1, parseInt(e.target.value) || 1),
                })
              }
              helperText={t('form.sacrificeCountHelp')}
            />
          )}
        </div>

        <div className="space-y-3 p-4 border border-stroke rounded-site">
          <p className="text-sm font-semibold text-foreground">
            {t('form.upgradeSection')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                {t('form.upgradeFeaturesArLabel')}
              </label>
              <textarea
                value={formData.upgradeFeaturesAr}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    upgradeFeaturesAr: e.target.value,
                  })
                }
                rows={5}
                className="w-full px-3 py-2 text-sm border border-stroke rounded-site bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
                placeholder={t('form.upgradeFeaturesPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                {t('form.upgradeFeaturesEnLabel')}
              </label>
              <textarea
                value={formData.upgradeFeaturesEn}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    upgradeFeaturesEn: e.target.value,
                  })
                }
                rows={5}
                className="w-full px-3 py-2 text-sm border border-stroke rounded-site bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
                placeholder={t('form.upgradeFeaturesPlaceholder')}
              />
            </div>
          </div>
          <p className="text-xs text-secondary">
            {t('form.upgradeFeaturesHelp')}
          </p>

          <hr className="border-stroke" />

          <Switch
            id="canBeUpgraded"
            checked={formData.canBeUpgraded}
            onChange={(checked) => {
              if (!checked) {
                setFormData({
                  ...formData,
                  canBeUpgraded: false,
                  upgradeTo: '',
                  upgradeDiscount: 0,
                });
              } else {
                setFormData({ ...formData, canBeUpgraded: true });
              }
            }}
            label={t('form.canBeUpgradedLabel')}
          />
          {formData.canBeUpgraded && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('form.upgradeToLabel')}
                </label>
                <select
                  value={formData.upgradeTo}
                  onChange={(e) =>
                    setFormData({ ...formData, upgradeTo: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-stroke rounded-site bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
                >
                  <option value="">{t('form.upgradeToPlaceholder')}</option>
                  {allProducts
                    .filter((p) => p._id !== product?._id)
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name.ar} — {p.name.en}
                      </option>
                    ))}
                </select>
              </div>
              {formData.upgradeTo && (
                <div className="space-y-3">
                  <Input
                    label={t('form.upgradeDiscountLabel')}
                    type="number"
                    value={formData.upgradeDiscount || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        upgradeDiscount: Math.min(
                          100,
                          Math.max(0, parseFloat(e.target.value) || 0),
                        ),
                      })
                    }
                    min="0"
                    max="100"
                    step="1"
                    helperText={t('form.upgradeDiscountHelp')}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3 p-4 border border-stroke rounded-site">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} className="text-success" />
              <p className="text-sm font-semibold text-foreground">
                {t('form.reservationSection')}
              </p>
            </div>
            <Button
              type="button"
              onClick={() =>
                setFormData({
                  ...formData,
                  reservationFields: [
                    ...formData.reservationFields,
                    {
                      type: 'text',
                      label: { ar: '', en: '' },
                      required: false,
                    },
                  ],
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm"
            >
              <Plus size={16} />
              {t('form.addReservationField')}
            </Button>
          </div>
          <p className="text-xs text-secondary">{t('form.reservationHelp')}</p>

          {formData.reservationFields.map((field, index) => (
            <div
              key={index}
              className="border border-stroke rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t('form.reservationFieldNumber', { number: index + 1 })}
                </h4>
                <Button
                  variant="custom"
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      reservationFields: formData.reservationFields.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                >
                  <X size={16} />
                </Button>
              </div>

              <Dropdown
                label={t('form.reservationFieldType')}
                value={field.type}
                options={[
                  { label: t('form.reservationTypeText'), value: 'text' },
                  {
                    label: t('form.reservationTypeTextarea'),
                    value: 'textarea',
                  },
                  { label: t('form.reservationTypeNumber'), value: 'number' },
                  { label: t('form.reservationTypeDate'), value: 'date' },
                  { label: t('form.reservationTypeSelect'), value: 'select' },
                  { label: t('form.reservationTypeRadio'), value: 'radio' },
                  { label: t('form.reservationTypePicture'), value: 'picture' },
                ]}
                onChange={(value) => {
                  const updated = [...formData.reservationFields];
                  updated[index] = {
                    ...updated[index],
                    type: value as
                      | 'text'
                      | 'textarea'
                      | 'number'
                      | 'date'
                      | 'select'
                      | 'radio'
                      | 'picture',
                    options:
                      value === 'select' || value === 'radio'
                        ? (updated[index].options ?? [])
                        : undefined,
                    maxLength:
                      value === 'text' || value === 'textarea'
                        ? updated[index].maxLength
                        : undefined,
                  };
                  setFormData({ ...formData, reservationFields: updated });
                }}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label={t('form.reservationLabelAr')}
                  type="text"
                  required
                  value={field.label.ar}
                  onChange={(e) => {
                    const updated = [...formData.reservationFields];
                    updated[index] = {
                      ...updated[index],
                      label: { ...updated[index].label, ar: e.target.value },
                    };
                    setFormData({ ...formData, reservationFields: updated });
                  }}
                />
                <Input
                  label={t('form.reservationLabelEn')}
                  type="text"
                  required
                  value={field.label.en}
                  onChange={(e) => {
                    const updated = [...formData.reservationFields];
                    updated[index] = {
                      ...updated[index],
                      label: { ...updated[index].label, en: e.target.value },
                    };
                    setFormData({ ...formData, reservationFields: updated });
                  }}
                />
              </div>

              {(field.type === 'text' || field.type === 'textarea') && (
                <Input
                  label={t('form.reservationMaxLength')}
                  type="number"
                  min={1}
                  value={field.maxLength || ''}
                  onChange={(e) => {
                    const updated = [...formData.reservationFields];
                    const val = parseInt(e.target.value) || undefined;
                    updated[index] = { ...updated[index], maxLength: val };
                    setFormData({ ...formData, reservationFields: updated });
                  }}
                  helperText={t('form.reservationMaxLengthHelp')}
                />
              )}

              {(field.type === 'select' || field.type === 'radio') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-secondary">
                      {field.type === 'radio'
                        ? t('form.reservationRadioOptions')
                        : t('form.reservationSelectOptions')}
                    </label>
                    <Button
                      type="button"
                      variant="custom"
                      onClick={() => {
                        const updated = [...formData.reservationFields];
                        updated[index] = {
                          ...updated[index],
                          options: [
                            ...(updated[index].options ?? []),
                            { ar: '', en: '' },
                          ],
                        };
                        setFormData({
                          ...formData,
                          reservationFields: updated,
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-stroke rounded-lg hover:border-success hover:text-success transition-colors"
                    >
                      <Plus size={12} />
                      {t('form.reservationAddOption')}
                    </Button>
                  </div>
                  {(field.options ?? []).length === 0 && (
                    <p className="text-xs text-secondary italic">
                      {t('form.reservationNoOptions')}
                    </p>
                  )}
                  {(field.options ?? []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <Input
                          placeholder={t('form.reservationOptionAr')}
                          type="text"
                          value={opt.ar}
                          onChange={(e) => {
                            const updated = [...formData.reservationFields];
                            const opts = [...(updated[index].options ?? [])];
                            opts[optIdx] = {
                              ...opts[optIdx],
                              ar: e.target.value,
                            };
                            updated[index] = {
                              ...updated[index],
                              options: opts,
                            };
                            setFormData({
                              ...formData,
                              reservationFields: updated,
                            });
                          }}
                        />
                        <Input
                          placeholder={t('form.reservationOptionEn')}
                          type="text"
                          value={opt.en}
                          onChange={(e) => {
                            const updated = [...formData.reservationFields];
                            const opts = [...(updated[index].options ?? [])];
                            opts[optIdx] = {
                              ...opts[optIdx],
                              en: e.target.value,
                            };
                            updated[index] = {
                              ...updated[index],
                              options: opts,
                            };
                            setFormData({
                              ...formData,
                              reservationFields: updated,
                            });
                          }}
                        />
                      </div>
                      <Button
                        variant="custom"
                        type="button"
                        onClick={() => {
                          const updated = [...formData.reservationFields];
                          const opts = (updated[index].options ?? []).filter(
                            (_, i) => i !== optIdx,
                          );
                          updated[index] = { ...updated[index], options: opts };
                          setFormData({
                            ...formData,
                            reservationFields: updated,
                          });
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors shrink-0"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Switch
                id={`reservationRequired_${index}`}
                checked={field.required}
                onChange={(checked) => {
                  const updated = [...formData.reservationFields];
                  updated[index] = { ...updated[index], required: checked };
                  setFormData({ ...formData, reservationFields: updated });
                }}
                label={t('form.reservationRequired')}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-stroke">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.replace('/products')}
          className="flex-1"
        >
          {t('buttons.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={loading}
          className="flex-1"
        >
          {loading
            ? t('buttons.uploading')
            : product
              ? t('buttons.updateProduct')
              : t('buttons.addProduct')}
        </Button>
      </div>
    </form>
  );
}
