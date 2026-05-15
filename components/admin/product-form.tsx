'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Product, normalizeProductMedia } from '@/types/Product';
import Input from '@/components/ui/input';
import Switch from '@/components/ui/switch';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Checkbox from '../ui/checkbox';
import MultiCurrencyPriceEditor, {
  CurrencyPrice,
} from '@/components/admin/multi-currency-price-editor';
import MultiCurrencyMinimumPaymentEditor, {
  CurrencyMinimumPayment,
} from '@/components/admin/multi-currency-minimum-payment-editor';
import MultiMediaUpload, {
  type UploadProgressState,
} from '@/components/admin/multi-media-upload';
import UploadProgressDisplay from '@/components/admin/upload-progress-display';
import RichTextEditor from '@/components/ui/rich-text-editor';

import Loading from '../ui/loading';
import {
  buildCurrencyRoundingMap,
  roundPrice,
  type RoundingRule,
} from '@/lib/currency-rounding';
import {
  getReservationPreset,
  normalizeReservationFields,
  RESERVATION_FIELD_PRESETS,
  ReservationField,
  ReservationFieldKey,
} from '@/lib/reservation-fields';
import { toast } from 'react-toastify';

import {
  LuPlus as Plus,
  LuX as X,
  LuClipboardList as ClipboardList,
  LuCircleHelp as CircleHelp,
} from 'react-icons/lu';

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
  const initialUploadState: UploadProgressState = {
    isUploading: false,
    overallProgress: 0,
    currentFileName: null,
    currentFileProgress: 0,
    completedFiles: 0,
    totalFiles: 0,
    uploadSpeed: '',
    timeRemaining: '',
  };

  const defaultSize = {
    name: { ar: '', en: '' },
    price: 0,
    prices: [] as CurrencyPrice[],
    feedsUp: 0,
    isAvailable: true,
  };

  const [formData, setFormData] = useState({
    name_ar: '',
    name_en: '',
    slug: '',
    content_ar: '',
    content_en: '',
    baseCurrency: 'SAR',
    inStock: true,
    isBestSeller: false,
    label_ar: '',
    label_en: '',
    showAlways: false,
    isActive: true,
    supportsHalfPayment: true,
    media: normalizeProductMedia([]),
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
      isAvailable: boolean;
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
  const [currencyRoundingMap, setCurrencyRoundingMap] = useState<
    Record<string, RoundingRule>
  >({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isFormDataReady, setIsFormDataReady] = useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<UploadProgressState>(initialUploadState);
  const [cancelUpload, setCancelUpload] = useState<(() => void) | null>(null);
  const isInitialMount = useRef(true);
  const t = useTranslations('admin.products');
  const router = useRouter();

  // Handle cancel upload with proper callback
  const handleCancelUpload = useCallback(() => {
    if (cancelUpload && typeof cancelUpload === 'function') {
      try {
        cancelUpload();
      } catch (error) {
        console.error('Error cancelling upload:', error);
        toast.error('Failed to cancel upload');
      }
    }
  }, [cancelUpload]);

  const handleCancelUploadReady = useCallback(
    (cancelFn: (() => void) | null) => {
      // Store function values safely in React state without invoking them as updaters.
      setCancelUpload(() => cancelFn);
    },
    [],
  );

  // Fetch all products for upgrade dropdown
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAllProducts(d.data.products || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/countries?active=true')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !Array.isArray(d.data)) return;
        setCurrencyRoundingMap(buildCurrencyRoundingMap(d.data));
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
        isBestSeller: Boolean(product.isBestSeller),
        label_ar: product.label?.ar || '',
        label_en: product.label?.en || '',
        showAlways: product.showAlways === true,
        isActive: product.isActive !== false,
        supportsHalfPayment: product.supportsHalfPayment !== false,
        media: normalizeProductMedia(product.media),
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
                isAvailable: s.isAvailable !== false,
              }))
            : [{ ...defaultSize }],
        workAsSacrifice: product.workAsSacrifice || false,
        sacrificeCount: product.sacrificeCount ?? 1,
        upgradeTo: product.upgradeTo || '',
        upgradeDiscount: product.upgradeDiscount ?? 0,
        upgradeFeaturesAr: (product.upgradeFeatures?.ar || []).join('\n'),
        upgradeFeaturesEn: (product.upgradeFeatures?.en || []).join('\n'),
        canBeUpgraded: !!product.upgradeTo,
        reservationFields: normalizeReservationFields(
          product.reservationFields,
        ),
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
        amount: roundPrice(
          p.amount * multiplier,
          p.currencyCode,
          currencyRoundingMap,
        ),
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
    value: string | number | boolean | CurrencyPrice[],
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
    } else if (field === 'isAvailable') {
      size.isAvailable = value as boolean;
    }

    updatedSizes[index] = size;
    setFormData({ ...formData, sizes: updatedSizes });
  };

  const toggleReservationField = (
    key: ReservationFieldKey,
    isActive: boolean,
  ) => {
    if (!isActive) {
      setFormData({
        ...formData,
        reservationFields: formData.reservationFields.filter(
          (field) => field.key !== key,
        ),
      });
      return;
    }

    const preset = getReservationPreset(key);
    if (!preset) return;

    const existing = formData.reservationFields.find(
      (field) => field.key === key,
    );
    if (existing) return;

    // Filter options for intention field based on workAsSacrifice setting
    let fieldOptions = preset.options;
    if (key === 'intention' && !formData.workAsSacrifice && fieldOptions) {
      fieldOptions = fieldOptions.filter(
        (opt) =>
          !opt.en.toLowerCase().includes('aqeeqah') && opt.ar !== 'عقيقة',
      );
    }

    setFormData({
      ...formData,
      reservationFields: [
        ...formData.reservationFields,
        {
          key: preset.key,
          type: preset.type,
          label: preset.label,
          options: fieldOptions,
          required: false,
          supportsMulti: Boolean(preset.supportsMulti),
        },
      ],
    });
  };

  const updateIntentionOptions = (optionEn: string, isSelected: boolean) => {
    const intentionField = formData.reservationFields.find(
      (f) => f.key === 'intention',
    );
    if (!intentionField) return;

    const preset = getReservationPreset('intention');
    const allOptions = preset?.options || [];

    let currentOptions = intentionField.options || allOptions;

    if (isSelected) {
      // Add option if not present
      const optionToAdd = allOptions.find((o) => o.en === optionEn);
      if (optionToAdd && !currentOptions.find((o) => o.en === optionEn)) {
        currentOptions = [...currentOptions, optionToAdd];
      }
    } else {
      // Remove option
      currentOptions = currentOptions.filter((o) => o.en !== optionEn);
    }

    setFormData({
      ...formData,
      reservationFields: formData.reservationFields.map((field) =>
        field.key === 'intention'
          ? { ...field, options: currentOptions }
          : field,
      ),
    });
  };

  const updateReservationField = (
    key: ReservationFieldKey,
    updater: (field: ReservationField) => ReservationField,
  ) => {
    setFormData({
      ...formData,
      reservationFields: formData.reservationFields.map((field) =>
        field.key === key ? updater(field) : field,
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadProgress.isUploading) {
      toast.error(
        'Please wait for media upload to finish before creating or updating the product.',
      );
      return;
    }

    if (!formData.name_ar.trim() || !formData.name_en.trim()) {
      toast.error(t('messages.nameRequired') || 'Product name is required');
      return;
    }

    if (!formData.media.length) {
      toast.error(
        t('messages.imageRequired') ||
          'At least one product media item is required',
      );
      return;
    }

    if (!formData.sizes.length) {
      toast.error(t('messages.minOneSize'));
      return;
    }

    const hasInvalidSize = formData.sizes.some(
      (size) =>
        !size.name.ar.trim() ||
        !size.name.en.trim() ||
        !Number.isFinite(size.price) ||
        size.price <= 0,
    );
    if (hasInvalidSize) {
      toast.error(
        t('messages.invalidSizeData') ||
          'Each size must have Arabic/English names and a valid price.',
      );
      return;
    }

    if (formData.partialPayment.isAllowed) {
      const minimumValues = formData.partialPayment.minimumPayments || [];
      const hasInvalidMinimum = minimumValues.some(
        (item) => !Number.isFinite(item.value) || item.value <= 0,
      );
      if (!minimumValues.length || hasInvalidMinimum) {
        toast.error(
          t('messages.invalidMinimumPayment') ||
            'Valid minimum payment values are required when partial payment is enabled.',
        );
        return;
      }
    }

    if (formData.upgradeTo) {
      const discount = Number(formData.upgradeDiscount);
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        toast.error(
          t('messages.invalidUpgradeDiscount') ||
            'Upgrade discount must be between 0 and 100.',
        );
        return;
      }
    }

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
      isBestSeller: formData.isBestSeller,
      label:
        formData.label_ar || formData.label_en
          ? { ar: formData.label_ar, en: formData.label_en }
          : null,
      showAlways: formData.showAlways,
      isActive: formData.isActive,
      supportsHalfPayment: formData.supportsHalfPayment,
      media: normalizeProductMedia(formData.media),
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
      <UploadProgressDisplay
        uploadProgress={uploadProgress}
        onCancel={handleCancelUpload}
        cancelDisabled={!cancelUpload || !uploadProgress.isUploading}
      />

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

        <MultiMediaUpload
          media={formData.media}
          onChange={(media) => setFormData({ ...formData, media })}
          onUploadProgressChange={setUploadProgress}
          onCancelUploadReady={handleCancelUploadReady}
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
          <div className="flex items-center gap-2">
            <Switch
              id="isBestSeller"
              checked={formData.isBestSeller}
              onChange={(checked) =>
                setFormData({ ...formData, isBestSeller: checked })
              }
              label={t('form.bestSellerLabel')}
            />
            <Tooltip content={t('form.bestSellerTooltip')} position="top">
              <span className="inline-flex text-secondary hover:text-foreground transition-colors cursor-help">
                <CircleHelp size={16} />
              </span>
            </Tooltip>
          </div>
        </div>

        {/* Label Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          <Input
            id="label_ar"
            label={t('form.labelAr')}
            value={formData.label_ar}
            onChange={(e) =>
              setFormData({ ...formData, label_ar: e.target.value })
            }
            placeholder={t('form.labelPlaceholderAr')}
          />
          <Input
            id="label_en"
            label={t('form.labelEn')}
            value={formData.label_en}
            onChange={(e) =>
              setFormData({ ...formData, label_en: e.target.value })
            }
          />
        </div>

        {/* Show Always Toggle */}
        <div className="flex items-center gap-2 pt-2">
          <Switch
            id="showAlways"
            checked={formData.showAlways}
            onChange={(checked) =>
              setFormData({ ...formData, showAlways: checked })
            }
            label={t('form.showAlways') || 'Show in all label filters'}
          />
          <Tooltip
            content={
              t('form.showAlwaysTooltip') ||
              'This product will appear in all label filters regardless of its assigned label'
            }
            position="top"
          >
            <span className="inline-flex text-secondary hover:text-foreground transition-colors cursor-help">
              <CircleHelp size={16} />
            </span>
          </Tooltip>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            id="supportsHalfPayment"
            checked={formData.supportsHalfPayment}
            onChange={(checked) =>
              setFormData({
                ...formData,
                supportsHalfPayment: checked,
              })
            }
            label={t('form.allowHalfPayment')}
          />

          <hr className="border-stroke" />

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

              <Switch
                id={`sizeAvailable_${index}`}
                checked={size.isAvailable !== false}
                onChange={(checked) =>
                  updateSize(index, 'isAvailable', checked)
                }
                label={t('form.sizeAvailableLabel')}
              />
              <p className="text-xs text-secondary">
                {t('form.sizeAvailabilityHelp')}
              </p>

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
            onChange={(checked) => {
              const newFormData = { ...formData, workAsSacrifice: checked };

              // Update intention options when workAsSacrifice changes
              const intentionField = formData.reservationFields.find(
                (f) => f.key === 'intention',
              );
              if (intentionField) {
                const preset = getReservationPreset('intention');
                const allOptions = preset?.options || [];
                const aqeeqahOption = allOptions.find(
                  (o) =>
                    o.en.toLowerCase().includes('aqeeqah') || o.ar === 'عقيقة',
                );

                if (checked && aqeeqahOption) {
                  // Turning ON - add Aqeeqah option if not present
                  const hasAqeeqah = (intentionField.options || []).some(
                    (o) => o.en === aqeeqahOption.en,
                  );
                  if (!hasAqeeqah) {
                    newFormData.reservationFields =
                      formData.reservationFields.map((f) =>
                        f.key === 'intention'
                          ? {
                              ...f,
                              options: [...(f.options || []), aqeeqahOption],
                            }
                          : f,
                      );
                  }
                } else if (!checked) {
                  // Turning OFF - remove Aqeeqah option
                  newFormData.reservationFields =
                    formData.reservationFields.map((f) =>
                      f.key === 'intention'
                        ? {
                            ...f,
                            options: (f.options || []).filter(
                              (o) =>
                                !o.en.toLowerCase().includes('aqeeqah') &&
                                o.ar !== 'عقيقة',
                            ),
                          }
                        : f,
                    );
                }
              }

              setFormData(newFormData);
            }}
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
          </div>
          <p className="text-xs text-secondary">{t('form.reservationHelp')}</p>

          <div className="space-y-3">
            {RESERVATION_FIELD_PRESETS.map((preset) => {
              const field = formData.reservationFields.find(
                (item) => item.key === preset.key,
              );
              const isActive = Boolean(field);
              const supportsMaxLength =
                preset.type === 'text' || preset.type === 'textarea';
              const typeLabelMap: Record<string, string> = {
                text: t('form.reservationTypeText'),
                textarea: t('form.reservationTypeTextarea'),
                number: t('form.reservationTypeNumber'),
                date: t('form.reservationTypeDate'),
                select: t('form.reservationTypeSelect'),
                radio: t('form.reservationTypeRadio'),
                picture: t('form.reservationTypePicture'),
              };

              return (
                <div
                  key={preset.key}
                  className="border border-stroke rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {preset.label.ar}
                      </h4>
                      <p className="text-xs text-secondary">
                        {preset.label.en}
                      </p>
                    </div>
                    <Switch
                      id={`reservationActive_${preset.key}`}
                      checked={isActive}
                      onChange={(checked) =>
                        toggleReservationField(preset.key, checked)
                      }
                      label={t('form.reservationEnabled')}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
                    <span className="px-2 py-1 rounded-full bg-background border border-stroke">
                      {typeLabelMap[preset.type]}
                    </span>
                    {(preset.type === 'select' || preset.type === 'radio') &&
                      (preset.options ?? []).map((option) => (
                        <span
                          key={`${preset.key}_${option.en}`}
                          className="px-2 py-1 rounded-full bg-background border border-stroke"
                        >
                          {option.ar} / {option.en}
                        </span>
                      ))}
                  </div>

                  {isActive && supportsMaxLength && field && (
                    <Input
                      label={t('form.reservationMaxLength')}
                      type="number"
                      min={1}
                      value={field.maxLength || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10) || undefined;
                        updateReservationField(preset.key, (currentField) => ({
                          ...currentField,
                          maxLength: val,
                        }));
                      }}
                      helperText={t('form.reservationMaxLengthHelp')}
                    />
                  )}

                  {isActive && field && (
                    <Switch
                      id={`reservationRequired_${preset.key}`}
                      checked={field.required}
                      onChange={(checked) => {
                        updateReservationField(preset.key, (currentField) => ({
                          ...currentField,
                          required: checked,
                        }));
                      }}
                      label={t('form.reservationRequired')}
                    />
                  )}

                  {isActive && field && preset.key === 'sacrificeFor' && (
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`reservationSupportsMulti_${preset.key}`}
                        checked={Boolean(field.supportsMulti)}
                        onChange={(checked) => {
                          updateReservationField(
                            preset.key,
                            (currentField) => ({
                              ...currentField,
                              supportsMulti: checked,
                            }),
                          );
                        }}
                        label={t('form.reservationSupportsMulti')}
                      />
                      <Tooltip
                        content={t('form.reservationSupportsMultiTooltip')}
                        position="top"
                      >
                        <span className="inline-flex text-secondary hover:text-foreground transition-colors cursor-help">
                          <CircleHelp size={16} />
                        </span>
                      </Tooltip>
                    </div>
                  )}

                  {isActive && field && preset.key === 'intention' && (
                    <div className="space-y-3 pt-2 border-t border-stroke">
                      <p className="text-xs font-medium text-secondary">
                        {t('form.intentionOptionsLabel', {
                          defaultValue:
                            'Available Options (Select which options to show for this product)',
                        })}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(preset.options || []).map((option) => {
                          // Hide Aqeeqah option if product is not marked as sacrifice
                          const isAqeeqah =
                            option.en.toLowerCase().includes('aqeeqah') ||
                            option.ar === 'عقيقة';
                          if (isAqeeqah && !formData.workAsSacrifice) {
                            return null;
                          }

                          const isSelected = (field.options || []).some(
                            (o) => o.en === option.en,
                          );

                          return (
                            <label
                              key={`intention_option_${option.en}`}
                              className="flex items-center gap-2 p-2 rounded-lg border border-stroke hover:bg-background/50 cursor-pointer transition-colors"
                            >
                              <Checkbox
                                checked={isSelected}
                                onChange={(checked) =>
                                  updateIntentionOptions(option.en, checked)
                                }
                              />
                              <span className="text-sm">
                                {option.ar} / {option.en}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {!formData.workAsSacrifice && (
                        <p className="text-xs text-secondary">
                          {t('form.aqeeqahOptionHidden', {
                            defaultValue:
                              'Aqeeqah option is hidden because this product is not marked as Sacrifice',
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          disabled={loading || uploadProgress.isUploading}
          className="flex-1"
        >
          {loading
            ? t('buttons.uploading')
            : uploadProgress.isUploading
              ? `Uploading media ${uploadProgress.overallProgress}%`
              : product
                ? t('buttons.updateProduct')
                : t('buttons.addProduct')}
        </Button>
      </div>
    </form>
  );
}
