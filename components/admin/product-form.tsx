'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@/types/Product';
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
import { Plus, X } from 'lucide-react';
import Loading from '../ui/loading';

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
    easykashLinks: {
      fullPayment: '',
      halfPayment: '',
      customPayment: '',
    },
  };

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
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
    },
    sizes: [{ ...defaultSize }] as {
      name: { ar: string; en: string };
      price: number;
      prices: CurrencyPrice[];
      feedsUp: number;
      easykashLinks: {
        fullPayment: string;
        halfPayment: string;
        customPayment: string;
      };
    }[],
    workAsSacrifice: false,
    sacrificeCount: 1,
  });
  const [addedPricePercentage, setAddedPricePercentage] = useState<number>(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [isFormDataReady, setIsFormDataReady] = useState(false);
  const isInitialMount = useRef(true);
  const t = useTranslations('admin.products');
  const router = useRouter();

  // Initialize form data when product prop changes
  useEffect(() => {
    if (product) {
      // Set ready to false while updating
      setIsFormDataReady(false);

      setFormData({
        name_ar: product.name.ar,
        name_en: product.name.en,
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
        },
        sizes:
          product.sizes?.length > 0
            ? product.sizes.map((s) => ({
                name: { ar: s.name.ar || '', en: s.name.en || '' },
                price: s.price || 0,
                prices: s.prices || [],
                feedsUp: s.feedsUp ?? 0,
                easykashLinks: {
                  fullPayment: s.easykashLinks?.fullPayment || '',
                  halfPayment: s.easykashLinks?.halfPayment || '',
                  customPayment: s.easykashLinks?.customPayment || '',
                },
              }))
            : [{ ...defaultSize }],
        workAsSacrifice: product.workAsSacrifice || false,
        sacrificeCount: product.sacrificeCount ?? 1,
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
        amount: Math.ceil(p.amount * multiplier),
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
    } else if (field === 'easykashLinks.fullPayment') {
      size.easykashLinks = {
        ...size.easykashLinks,
        fullPayment: value as string,
      };
    } else if (field === 'easykashLinks.halfPayment') {
      size.easykashLinks = {
        ...size.easykashLinks,
        halfPayment: value as string,
      };
    } else if (field === 'easykashLinks.customPayment') {
      size.easykashLinks = {
        ...size.easykashLinks,
        customPayment: value as string,
      };
    } else if (field === 'feedsUp') {
      size.feedsUp = value as number;
    }

    updatedSizes[index] = size;
    setFormData({ ...formData, sizes: updatedSizes });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const productData = {
      name: { ar: formData.name_ar, en: formData.name_en },
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
      {/* Name */}
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

      {/* Content (Arabic) */}
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

      {/* Content (English) */}
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

      {/* Main Currency selector (always visible) */}
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

      {/* Added Price Percentage */}
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
          <button
            type="button"
            onClick={handleApplyPriceIncrease}
            disabled={!addedPricePercentage || addedPricePercentage <= 0}
            className="px-6 py-3 bg-success text-white rounded-lg hover:bg-success/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('form.applyButton')}
          </button>
        </div>
      </div>

      {/* Partial Payment Settings */}
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
              baseMinimumValue={50}
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
              onBaseValueChange={() => {}}
            />
          </div>
        )}
      </div>

      {/* Product Sizes (Required - at least one) */}
      <div className="border border-stroke rounded-lg p-4 bg-background space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">{t('form.sizes')}</h3>
            <p className="text-xs text-secondary mt-1">{t('form.sizesHelp')}</p>
          </div>
          <button
            type="button"
            onClick={addSize}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-success text-white rounded-lg hover:bg-success/90 transition-colors"
          >
            <Plus size={16} />
            {t('form.addSize')}
          </button>
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
              <button
                type="button"
                onClick={() => removeSize(index)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                title={t('form.removeSize')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Size Name */}
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

            {/* Size Price */}
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

            {/* Easy Kash Links for this size */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-secondary">
                {t('form.easykashLinks')}
              </label>
              <Input
                label={t('form.fullPaymentLink')}
                type="url"
                value={size.easykashLinks.fullPayment}
                onChange={(e) =>
                  updateSize(index, 'easykashLinks.fullPayment', e.target.value)
                }
              />
              <Input
                label={t('form.halfPaymentLink')}
                type="url"
                value={size.easykashLinks.halfPayment}
                onChange={(e) =>
                  updateSize(index, 'easykashLinks.halfPayment', e.target.value)
                }
              />
              <Input
                label={t('form.customPaymentLink')}
                type="url"
                value={size.easykashLinks.customPayment}
                onChange={(e) =>
                  updateSize(
                    index,
                    'easykashLinks.customPayment',
                    e.target.value,
                  )
                }
              />
            </div>

            {/* Feeds up (per size) */}
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

      {/* Multi-Image Upload */}
      <MultiImageUpload
        images={formData.images}
        onChange={(images) => setFormData({ ...formData, images })}
      />

      {/* Sacrifice / Aqeqa Settings */}
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

      {/* In Stock */}
      <Switch
        id="inStock"
        checked={formData.inStock}
        onChange={(checked) => setFormData({ ...formData, inStock: checked })}
        label={t('form.inStockLabel')}
      />

      {/* Is Active */}
      <Switch
        id="isActive"
        checked={formData.isActive}
        onChange={(checked) => setFormData({ ...formData, isActive: checked })}
        label={t('form.isActiveLabel', { defaultValue: 'Active' })}
      />

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-stroke">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.replace('/admin/products')}
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
