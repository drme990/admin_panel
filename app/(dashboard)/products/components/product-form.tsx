'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Product, normalizeProductMedia } from '@/types/Product';
import Input from '@/components/ui/input';
import Switch from '@/components/ui/switch';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';
import Checkbox from '../../../../components/ui/checkbox';
import { cn } from '@/lib/utils';
import CollapsibleSection from '@/app/(dashboard)/products/components/collapsible-section';
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

import Loading from '../../../../components/ui/loading';
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
  LuInfo as Info,
  LuImage as ImageIcon,
  LuEye as EyeIcon,
  LuDollarSign as DollarIcon,
  LuLayers as LayersIcon,
  LuHeart as HeartIcon,
  LuArrowUp as ArrowUpIcon,
  LuListChecks as ListChecksIcon,
  LuCircleAlert as AlertIcon,
  LuSave as SaveIcon,
  LuChevronDown as ChevronDownIcon,
} from 'react-icons/lu';

interface ProductFormProps {
  product?: Product | null;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
  /** Called whenever the dirty state changes (unsaved edits present) */
  onChangesChange?: (hasChanges: boolean) => void;
}

// ─── Validation types ────────────────────────────────────────────────
type FormErrors = Record<string, string | undefined>;

export default function ProductForm({
  product,
  onSubmit,
  loading = false,
  onChangesChange,
}: ProductFormProps) {
  // ─── Helpers for base price in prices[] ────────────────────────────
  // The base price is the entry in prices[] whose currencyCode matches
  // the product's baseCurrency. These helpers read/write that entry
  // directly — there is no separate `price` field anymore.
  const getBasePrice = (prices: CurrencyPrice[], baseCurrency: string): number => {
    const base = baseCurrency.toUpperCase();
    return prices.find((p) => p.currencyCode.toUpperCase() === base)?.amount ?? 0;
  };

  const setBasePrice = (
    prices: CurrencyPrice[],
    baseCurrency: string,
    amount: number,
  ): CurrencyPrice[] => {
    const base = baseCurrency.toUpperCase();
    const idx = prices.findIndex((p) => p.currencyCode.toUpperCase() === base);
    if (idx >= 0) {
      const updated = [...prices];
      updated[idx] = { ...updated[idx], amount, isManual: true };
      return updated;
    }
    return [...prices, { currencyCode: base, amount, isManual: true }];
  };

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
    designName: '',
    basePrice: 0 as number,
    baseCurrency: '' as string,
    prices: [] as CurrencyPrice[],
    manualPrice: null as number | null,
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
    sizes: [{ ...defaultSize, baseCurrency: 'SAR' }] as {
      name: { ar: string; en: string };
      designName: string;
      basePrice: number;
      baseCurrency: string;
      prices: CurrencyPrice[];
      manualPrice: number | null;
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
    recommendProduct: false,
    recommendProductId: '' as string,
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
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const isInitialMount = useRef(true);
  const t = useTranslations('admin.products');

  // ─── Section accordion state ──────────────────────────────────────
  // Create mode: first section ("section-basic") is open, rest closed.
  // Edit mode: all sections closed (user opens what they need).
  // Opening a section closes all other non-locked open sections.
  // Locking a section preserves its state when other sections toggle.
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(product ? [] : ['section-basic']),
  );
  const [lockedSections, setLockedSections] = useState<Set<string>>(
    () => new Set(),
  );
  // Track which size cards are expanded (by index). First size is open by default.
  const [expandedSizes, setExpandedSizes] = useState<Set<number>>(
    () => new Set([0]),
  );

  const handleSectionToggle = (sectionId: string, open: boolean) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (open) {
        next.add(sectionId);
        // Accordion: close all other non-locked open sections
        for (const id of next) {
          if (id !== sectionId && !lockedSections.has(id)) {
            next.delete(id);
          }
        }
      } else {
        next.delete(sectionId);
      }
      return next;
    });
  };

  const handleLockToggle = (sectionId: string) => {
    setLockedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const toggleSizeExpand = (index: number) => {
    setExpandedSizes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // ─── Validation logic ──────────────────────────────────────────────
  const validateForm = useCallback((): FormErrors => {
    const errors: FormErrors = {};

    if (!formData.name_ar.trim()) {
      errors.name_ar = t('form.errors.nameArRequired');
    }
    if (!formData.name_en.trim()) {
      errors.name_en = t('form.errors.nameEnRequired');
    }

    const normalizedSlug = formData.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!normalizedSlug) {
      errors.slug = t('form.errors.slugRequired');
    }

    if (!formData.media.length) {
      errors.media = t('form.errors.mediaRequired');
    }

    formData.sizes.forEach((size, index) => {
      if (!size.name.ar.trim()) {
        errors[`size_${index}_name_ar`] = t('form.errors.sizeNameArRequired');
      }
      if (!size.name.en.trim()) {
        errors[`size_${index}_name_en`] = t('form.errors.sizeNameEnRequired');
      }
      const basePrice = size.basePrice || getBasePrice(size.prices, formData.baseCurrency);
      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        errors[`size_${index}_price`] = t('form.errors.sizePriceRequired');
      }
    });

    if (formData.partialPayment.isAllowed) {
      const minimumValues = formData.partialPayment.minimumPayments || [];
      const hasInvalidMinimum = minimumValues.some(
        (item) => !Number.isFinite(item.value) || item.value <= 0,
      );
      if (!minimumValues.length || hasInvalidMinimum) {
        errors.partialPayment = t('form.errors.minPaymentRequired');
      }
    }

    if (formData.upgradeTo) {
      const discount = Number(formData.upgradeDiscount);
      if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
        errors.upgradeDiscount = t('form.errors.upgradeDiscountRange');
      }
    }

    return errors;
  }, [formData, t]);

  // Recompute errors live after first submit attempt
  useEffect(() => {
    if (!attemptedSubmit) return;
    setFormErrors(validateForm());
  }, [attemptedSubmit, formData, validateForm]);

  // ─── Section error counts ──────────────────────────────────────────
  const sectionErrorCounts = useMemo(() => {
    const counts: Record<string, number> = {
      basic: 0,
      media: 0,
      display: 0,
      pricing: 0,
      sizes: 0,
      sacrifice: 0,
      upgrade: 0,
      reservation: 0,
    };
    if (formErrors.name_ar) counts.basic++;
    if (formErrors.name_en) counts.basic++;
    if (formErrors.slug) counts.basic++;
    if (formErrors.media) counts.media++;
    if (formErrors.partialPayment) counts.pricing++;
    formData.sizes.forEach((_, index) => {
      if (formErrors[`size_${index}_name_ar`]) counts.sizes++;
      if (formErrors[`size_${index}_name_en`]) counts.sizes++;
      if (formErrors[`size_${index}_price`]) counts.sizes++;
    });
    if (formErrors.upgradeDiscount) counts.upgrade++;
    return counts;
  }, [formErrors, formData.sizes]);

  // ─── Scroll to first error section ─────────────────────────────────
  const scrollToFirstError = useCallback(
    (errors: FormErrors) => {
      const errorKeys = Object.keys(errors);
      if (errorKeys.length === 0) return;

      // Map error keys to section ids
      const sectionMap: Record<string, string> = {
        name_ar: 'section-basic',
        name_en: 'section-basic',
        slug: 'section-basic',
        media: 'section-media',
        partialPayment: 'section-pricing',
        upgradeDiscount: 'section-upgrade',
      };
      // Size errors → sizes section
      errorKeys.forEach((key) => {
        if (key.startsWith('size_') && !sectionMap[key]) {
          sectionMap[key] = 'section-sizes';
        }
      });

      // Find the first section that has an error
      const sectionOrder = [
        'section-basic',
        'section-media',
        'section-display',
        'section-pricing',
        'section-sizes',
        'section-sacrifice',
        'section-upgrade',
        'section-reservation',
      ];

      for (const sectionId of sectionOrder) {
        const hasErrorInSection = errorKeys.some(
          (key) => sectionMap[key] === sectionId,
        );
        if (hasErrorInSection) {
          const el = document.getElementById(sectionId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            break;
          }
        }
      }
    },
    [],
  );

  // ─── Upload handlers ───────────────────────────────────────────────
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
      setCancelUpload(() => cancelFn);
    },
    [],
  );

  // ─── Data fetching ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAllProducts(d.data.products || []);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    fetch('/api/countries?active=true')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success || !Array.isArray(d.data)) return;
        setCurrencyRoundingMap(buildCurrencyRoundingMap(d.data));
      })
      .catch(() => { });
  }, []);

  // ─── Initialize form data when product prop changes ────────────────
  useEffect(() => {
    if (product) {
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
            ? product.sizes.map((s) => {
              return {
                name: { ar: s.name.ar || '', en: s.name.en || '' },
                designName: s.designName || '',
                // Use basePrice from the size if available; fall back to
                // the base-currency entry in prices[] for old docs.
                basePrice: s.basePrice ?? getBasePrice(s.prices || [], product.baseCurrency || 'SAR'),
                baseCurrency: s.baseCurrency || product.baseCurrency || 'SAR',
                prices: s.prices || [],
                manualPrice: s.manualPrice ?? null,
                feedsUp: s.feedsUp ?? 0,
                isAvailable: s.isAvailable !== false,
              };
            })
            : [{ ...defaultSize }],
        workAsSacrifice: product.workAsSacrifice || false,
        sacrificeCount: product.sacrificeCount ?? 1,
        upgradeTo: product.upgradeTo || '',
        upgradeDiscount: product.upgradeDiscount ?? 0,
        upgradeFeaturesAr: (product.upgradeFeatures?.ar || []).join('\n'),
        upgradeFeaturesEn: (product.upgradeFeatures?.en || []).join('\n'),
        canBeUpgraded: !!product.upgradeTo,
        recommendProduct: product.recommendProduct?.recommend || false,
        recommendProductId: product.recommendProduct?.product || '',
        reservationFields: normalizeReservationFields(
          product.reservationFields,
        ),
      });

      setTimeout(() => {
        setIsFormDataReady(true);
        setHasChanges(false);
        setFormErrors({});
        setAttemptedSubmit(false);
        // Reset sections: edit mode starts with all sections closed
        setOpenSections(new Set());
        setLockedSections(new Set());
        setExpandedSizes(new Set());
        isInitialMount.current = true;
      }, 0);
    } else {
      setIsFormDataReady(true);
      // Create mode: first section open, rest closed
      setOpenSections(new Set(['section-basic']));
      setLockedSections(new Set());
      setExpandedSizes(new Set([0]));
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

  // Report dirty state to parent so it can guard navigation
  useEffect(() => {
    onChangesChange?.(hasChanges);
  }, [hasChanges, onChangesChange]);

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

  // ─── Price operations ──────────────────────────────────────────────
  const handleApplyPriceIncrease = () => {
    if (!addedPricePercentage || addedPricePercentage <= 0) {
      toast.error(t('messages.invalidPercentage'));
      return;
    }
    const multiplier = 1 + addedPricePercentage / 100;
    const updatedSizes = formData.sizes.map((size) => ({
      ...size,
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

  // ─── Size operations ───────────────────────────────────────────────
  const addSize = () => {
    setFormData({
      ...formData,
      sizes: [...formData.sizes, { ...defaultSize, baseCurrency: formData.baseCurrency }],
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
    value: string | number | boolean | CurrencyPrice[] | null,
  ) => {
    const updatedSizes = [...formData.sizes];
    const size = { ...updatedSizes[index] };

    if (field === 'name.ar') {
      size.name = { ...size.name, ar: value as string };
    } else if (field === 'name.en') {
      size.name = { ...size.name, en: value as string };
    } else if (field === 'designName') {
      size.designName = value as string;
    } else if (field === 'price') {
      // Update the dedicated basePrice field (used by cron job / exchange
      // calculations) AND sync the baseCurrency entry in prices[] (used
      // for display/checkout). Both stay in sync.
      size.basePrice = value as number;
      size.baseCurrency = formData.baseCurrency;
      size.prices = setBasePrice(size.prices, formData.baseCurrency, value as number);
    } else if (field === 'manualPrice') {
      size.manualPrice = value as number | null;
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

  // ─── Reservation field operations ──────────────────────────────────
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
      const optionToAdd = allOptions.find((o) => o.en === optionEn);
      if (optionToAdd && !currentOptions.find((o) => o.en === optionEn)) {
        currentOptions = [...currentOptions, optionToAdd];
      }
    } else {
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

  // ─── Submit handler ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (uploadProgress.isUploading) {
      toast.error(
        'Please wait for media upload to finish before creating or updating the product.',
      );
      return;
    }

    const errors = validateForm();
    setFormErrors(errors);
    setAttemptedSubmit(true);

    if (Object.keys(errors).length > 0) {
      toast.error(t('form.errors.fixErrorsBeforeSave'));
      scrollToFirstError(errors);
      return;
    }

    const normalizedSlug = formData.slug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

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
      sizes: formData.sizes.map((s) => {
        // basePrice + baseCurrency are saved on each size for exchange
        // calculations. prices[] stays in sync (updated live via
        // updateSize('price', ...)) for display/checkout.
        return {
          name: s.name,
          designName: s.designName,
          basePrice: s.basePrice,
          baseCurrency: s.baseCurrency || formData.baseCurrency,
          prices: s.prices,
          manualPrice: s.manualPrice,
          feedsUp: s.feedsUp,
          isAvailable: s.isAvailable,
        };
      }),
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
      recommendProduct: formData.recommendProduct
        ? {
          recommend: true,
          product: formData.recommendProductId || null,
        }
        : null,
      reservationFields: formData.reservationFields,
    };

    try {
      await onSubmit(productData);
      setHasChanges(false);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  // Don't render form until data is ready
  if (product && !isFormDataReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loading />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <UploadProgressDisplay
        uploadProgress={uploadProgress}
        onCancel={handleCancelUpload}
        cancelDisabled={!cancelUpload || !uploadProgress.isUploading}
      />

      {/* ═══ Basic Information ═══ */}
      <CollapsibleSection
        sectionId="section-basic"
        title={t('form.sectionBasicInfo')}
        description={t('form.sectionBasicInfoDesc')}
        icon={<Info size={18} />}
        hasError={sectionErrorCounts.basic > 0}
        errorCount={sectionErrorCounts.basic}
        open={openSections.has('section-basic')}
        onToggle={(open) => handleSectionToggle('section-basic', open)}
        locked={lockedSections.has('section-basic')}
        onLockToggle={() => handleLockToggle('section-basic')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('form.nameAr')}
            type="text"
            required
            value={formData.name_ar}
            onChange={(e) =>
              setFormData({ ...formData, name_ar: e.target.value })
            }
            error={formErrors.name_ar}
          />
          <Input
            label={t('form.nameEn')}
            type="text"
            required
            value={formData.name_en}
            onChange={(e) =>
              setFormData({ ...formData, name_en: e.target.value })
            }
            error={formErrors.name_en}
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
          error={formErrors.slug}
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
      </CollapsibleSection>

      {/* ═══ Product Media ═══ */}
      <CollapsibleSection
        sectionId="section-media"
        title={t('form.sectionMedia')}
        description={t('form.sectionMediaDesc')}
        icon={<ImageIcon size={18} />}
        hasError={sectionErrorCounts.media > 0}
        errorCount={sectionErrorCounts.media}
        open={openSections.has('section-media')}
        onToggle={(open) => handleSectionToggle('section-media', open)}
        locked={lockedSections.has('section-media')}
        onLockToggle={() => handleLockToggle('section-media')}
      >
        {formErrors.media && (
          <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            <AlertIcon size={16} />
            {formErrors.media}
          </div>
        )}
        <MultiMediaUpload
          media={formData.media}
          onChange={(media) => setFormData({ ...formData, media })}
          onUploadProgressChange={setUploadProgress}
          onCancelUploadReady={handleCancelUploadReady}
        />
      </CollapsibleSection>

      {/* ═══ Display & Visibility ═══ */}
      <CollapsibleSection
        sectionId="section-display"
        title={t('form.sectionDisplay')}
        description={t('form.sectionDisplayDesc')}
        icon={<EyeIcon size={18} />}
        open={openSections.has('section-display')}
        onToggle={(open) => handleSectionToggle('section-display', open)}
        locked={lockedSections.has('section-display')}
        onLockToggle={() => handleLockToggle('section-display')}
      >
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

        <div className="flex items-center gap-2">
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

        <Switch
          id="isActive"
          checked={formData.isActive}
          onChange={(checked) =>
            setFormData({ ...formData, isActive: checked })
          }
          label={t('form.isActiveLabel', { defaultValue: 'Active' })}
        />
      </CollapsibleSection>

      {/* ═══ Pricing & Payment ═══ */}
      <CollapsibleSection
        sectionId="section-pricing"
        title={t('form.sectionPricing')}
        description={t('form.sectionPricingDesc')}
        icon={<DollarIcon size={18} />}
        hasError={sectionErrorCounts.pricing > 0}
        errorCount={sectionErrorCounts.pricing}
        open={openSections.has('section-pricing')}
        onToggle={(open) => handleSectionToggle('section-pricing', open)}
        locked={lockedSections.has('section-pricing')}
        onLockToggle={() => handleLockToggle('section-pricing')}
      >
        <MultiCurrencyPriceEditor
          mainCurrency={formData.baseCurrency}
          basePrice={formData.sizes[0]?.basePrice || getBasePrice(formData.sizes[0]?.prices ?? [], formData.baseCurrency)}
          prices={[]}
          onChange={() => { }}
          onMainCurrencyChange={(currency) => {
            // Update the product's base currency AND sync each size's
            // baseCurrency field (used by the cron job for exchange).
            setFormData({
              ...formData,
              baseCurrency: currency,
              sizes: formData.sizes.map((s) => ({
                ...s,
                baseCurrency: currency,
              })),
            });
          }}
          onBasePriceChange={() => { }}
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
          {formErrors.partialPayment && (
            <div className="flex items-center gap-2 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
              <AlertIcon size={16} />
              {formErrors.partialPayment}
            </div>
          )}
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
      </CollapsibleSection>

      {/* ═══ Product Sizes ═══ */}
      <CollapsibleSection
        sectionId="section-sizes"
        title={t('form.sectionSizes')}
        description={t('form.sectionSizesDesc')}
        icon={<LayersIcon size={18} />}
        hasError={sectionErrorCounts.sizes > 0}
        errorCount={sectionErrorCounts.sizes}
        open={openSections.has('section-sizes')}
        onToggle={(open) => handleSectionToggle('section-sizes', open)}
        locked={lockedSections.has('section-sizes')}
        onLockToggle={() => handleLockToggle('section-sizes')}
      >
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

        {formData.sizes.map((size, index) => {
          const isExpanded = expandedSizes.has(index);
          const sizeLabel = size.name.ar || size.name.en
            ? `${size.name.ar || size.name.en}${size.basePrice ? ` — ${size.basePrice} ${formData.baseCurrency}` : ''}`
            : t('form.sizeNumber', { number: index + 1 });
          return (
            <div
              key={index}
              className="border border-stroke rounded-lg overflow-hidden"
            >
              {/* Size header — click to expand/collapse */}
              <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <button
                  type="button"
                  onClick={() => toggleSizeExpand(index)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-start"
                >
                  <ChevronDownIcon
                    size={16}
                    className={cn(
                      'shrink-0 text-secondary transition-transform duration-200',
                      isExpanded ? 'rotate-180' : '',
                    )}
                  />
                  <span className="text-sm font-semibold truncate">
                    {t('form.sizeNumber', { number: index + 1 })}
                  </span>
                  {size.name.ar && (
                    <span className="text-xs text-secondary truncate">
                      {sizeLabel}
                    </span>
                  )}
                </button>
                <Button
                  variant="custom"
                  type="button"
                  onClick={() => removeSize(index)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors shrink-0"
                  title={t('form.removeSize')}
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Size body — collapsible */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-stroke">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                    <Input
                      label={t('form.sizeNameAr')}
                      type="text"
                      value={size.name.ar}
                      onChange={(e) => updateSize(index, 'name.ar', e.target.value)}
                      error={formErrors[`size_${index}_name_ar`]}
                    />
                    <Input
                      label={t('form.sizeNameEn')}
                      type="text"
                      value={size.name.en}
                      onChange={(e) => updateSize(index, 'name.en', e.target.value)}
                      error={formErrors[`size_${index}_name_en`]}
                    />
                  </div>

                  <Input
                    label={t('form.sizeDesignName')}
                    type="text"
                    value={size.designName}
                    onChange={(e) => updateSize(index, 'designName', e.target.value)}
                    helperText={t('form.sizeDesignNameHelp')}
                  />

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

                  <div className="space-y-3">
                    <label className="text-xs font-medium text-secondary">
                      {t('form.sizePrice')}
                    </label>

                    {/* Base Price section */}
                    <div className="space-y-2 p-3 rounded-lg border border-stroke bg-card-bg/50">
                      <Input
                        label={`${t('form.sizeBasePrice')} (${formData.baseCurrency})`}
                        type="number"
                        value={size.basePrice || ''}
                        onChange={(e) =>
                          updateSize(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        min="0"
                        step="0.01"
                        error={formErrors[`size_${index}_price`]}
                      />
                      {size.basePrice > 0 && (
                        <MultiCurrencyPriceEditor
                          mainCurrency={formData.baseCurrency}
                          basePrice={size.basePrice}
                          prices={size.prices}
                          onChange={(prices) => updateSize(index, 'prices', prices)}
                          onMainCurrencyChange={() => { }}
                          onBasePriceChange={() => { }}
                          compact
                        />
                      )}
                    </div>

                    {/* Manual Price section */}
                    <div className="space-y-2 p-3 rounded-lg border border-stroke bg-card-bg/50">
                      <Input
                        label={`${t('form.sizeManualPrice') || 'Manual Price'} (EGP)`}
                        type="number"
                        value={size.manualPrice ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateSize(index, 'manualPrice', value === '' ? null : parseFloat(value) || 0);
                        }}
                        min="0"
                        step="0.01"
                        helperText={t('form.sizeManualPriceHelp') || 'Price in EGP used for manual orders. Leave empty to use the regular price.'}
                      />
                    </div>
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
              )}
            </div>
          );
        })}
      </CollapsibleSection>

      {/* ═══ Aqiqah / Sacrifice ═══ */}
      <CollapsibleSection
        sectionId="section-sacrifice"
        title={t('form.sectionSacrifice')}
        description={t('form.sectionSacrificeDesc')}
        icon={<HeartIcon size={18} />}
        open={openSections.has('section-sacrifice')}
        onToggle={(open) => handleSectionToggle('section-sacrifice', open)}
        locked={lockedSections.has('section-sacrifice')}
        onLockToggle={() => handleLockToggle('section-sacrifice')}
      >
        <Switch
          id="workAsSacrifice"
          checked={formData.workAsSacrifice}
          onChange={(checked) => {
            const newFormData = { ...formData, workAsSacrifice: checked };

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
      </CollapsibleSection>

      {/* ═══ Upgrade & Recommendations ═══ */}
      <CollapsibleSection
        sectionId="section-upgrade"
        title={t('form.sectionUpgrade')}
        description={t('form.sectionUpgradeDesc')}
        icon={<ArrowUpIcon size={18} />}
        hasError={sectionErrorCounts.upgrade > 0}
        errorCount={sectionErrorCounts.upgrade}
        open={openSections.has('section-upgrade')}
        onToggle={(open) => handleSectionToggle('section-upgrade', open)}
        locked={lockedSections.has('section-upgrade')}
        onLockToggle={() => handleLockToggle('section-upgrade')}
      >
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
                  error={formErrors.upgradeDiscount}
                />
              </div>
            )}
          </div>
        )}

        <hr className="border-stroke" />

        <div className="pt-2">
          <h4 className="text-sm font-semibold text-foreground mb-2">
            {t('form.recommendProductLabel')}
          </h4>
          <Switch
            id="recommendProduct"
            checked={formData.recommendProduct}
            onChange={(checked) => {
              if (!checked) {
                setFormData({
                  ...formData,
                  recommendProduct: false,
                  recommendProductId: '',
                });
              } else {
                setFormData({ ...formData, recommendProduct: true });
              }
            }}
            label={t('form.recommendProductToggle')}
          />
          {formData.recommendProduct && (
            <div className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  {t('form.recommendProductSelect')}
                </label>
                <select
                  value={formData.recommendProductId}
                  onChange={(e) =>
                    setFormData({ ...formData, recommendProductId: e.target.value })
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
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ═══ Reservation Fields ═══ */}
      <CollapsibleSection
        sectionId="section-reservation"
        title={t('form.sectionReservation')}
        description={t('form.sectionReservationDesc')}
        icon={<ListChecksIcon size={18} />}
        open={openSections.has('section-reservation')}
        onToggle={(open) => handleSectionToggle('section-reservation', open)}
        locked={lockedSections.has('section-reservation')}
        onLockToggle={() => handleLockToggle('section-reservation')}
      >
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
      </CollapsibleSection>

      {/* ═══ Floating Save Button ═══ */}
      <div className="fixed bottom-6 right-6 z-50">
        <Tooltip
          content={product ? t('buttons.updateProduct') : t('buttons.addProduct')}
          position="left"

        >
          <button
            type="submit"
            disabled={loading || uploadProgress.isUploading}
            aria-label={product ? t('buttons.updateProduct') : t('buttons.addProduct')}
            className="w-14 h-14 rounded-full gradient-site gradient-text shadow-lg hover:opacity-90 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {loading || uploadProgress.isUploading ? (
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
            ) : (
              <SaveIcon size={22} />
            )}
          </button>
        </Tooltip>
      </div>
    </form>
  );
}
