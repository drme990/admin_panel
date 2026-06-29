'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useReducer } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { Referral } from '@/types/Referral';
import { toast } from 'react-toastify';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import MultiNameInput from '@/components/ui/multi-name-input';
import QuantityInput from '@/components/ui/quantity-input';
import Dropdown from '@/components/ui/dropdown';
import CountrySelector from '@/components/shared/country-selector';
import RadioButton from '@/components/ui/radio-button';
import Tabs from '@/components/ui/tabs';
import Switch from '@/components/ui/switch';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { uploadImageToR2, uploadInvoiceToR2, deleteOldImage } from '../../../../lib/image-upload-utils';

import { LuCopy, LuCheck, LuRefreshCw, LuUpload, LuDownload, LuPlus, LuX, LuAtSign, LuPencil } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { COUNTRIES } from '@/lib/countries';

function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const matrix: number[][] = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[m][n];
}

function phoneSimilarity(a: string, b: string): number {
  const digitsA = extractDigits(a);
  const digitsB = extractDigits(b);
  if (digitsA.length === 0 && digitsB.length === 0) return 1;
  if (digitsA.length === 0 || digitsB.length === 0) return 0;
  const distance = levenshteinDistance(digitsA, digitsB);
  const maxLength = Math.max(digitsA.length, digitsB.length);
  return 1 - distance / maxLength;
}

function validatePhoneNumber(phone: string, countryName: string): boolean {
  if (!phone.trim()) return false;

  const normalizedCountry = countryName.trim().toLowerCase();
  const country = COUNTRIES.find(
    (c) =>
      c.value.toLowerCase() === normalizedCountry ||
      c.en.toLowerCase() === normalizedCountry ||
      c.ar.toLowerCase() === normalizedCountry ||
      c.code.toLowerCase() === normalizedCountry,
  );

  try {
    if (country) {
      return isValidPhoneNumber(
        phone,
        country.code as Parameters<typeof isValidPhoneNumber>[1],
      );
    }
    return isValidPhoneNumber(phone);
  } catch {
    return false;
  }
}

interface Product {
  _id: string;
  name: { ar: string; en: string };
  slug: string;
  baseCurrency: string;
  sizes: Array<{
    name?: { ar: string; en: string };
    price: number;
    prices?: Array<{ currencyCode: string; amount: number }>;
    manualPrice?: number | null;
    manualPrices?: Array<{ currencyCode: string; amount: number }>;
    isAvailable?: boolean;
  }>;
  reservationFields?: Array<{
    key: string;
    type: string;
    label: { ar: string; en: string };
    required?: boolean;
    options?: Array<{ ar: string; en: string }>;
  }>;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  namespace?: 'orders' | 'execution';
}

type PaymentMethod = 'easykash' | 'insta_pay' | 'vodafone_cash' | 'bank_transfer' | 'paypal' | 'binance' | '';
type Source = 'manasik' | 'ghadaq';

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

interface FormState {
  source: Source;
  items: OrderItemForm[];
  currency: string;
  referralId: string;
  billingData: {
    fullName: string;
    email: string;
    phone: string;
    country: string;
  };
  reservationData: {
    sacrificeFor: string;
    gender: string;
    isAlive: string;
    intention: string;
    shortDuaa: string;
    executionDate: string;
    photo: string;
  };
  paymentMethod: PaymentMethod;
  paidAmount: string;
}

const emptyItem = (): OrderItemForm => ({
  type: 'existing',
  productId: '',
  sizeIndex: 0,
  quantity: 0,
  overridePrice: '',
  customName: '',
  customSize: '',
  customPrice: '',
});

const DEFAULT_FORM: FormState = {
  source: 'manasik',
  items: [emptyItem()],
  currency: '',
  referralId: '',
  billingData: {
    fullName: '',
    email: '',
    phone: '',
    country: '',
  },
  reservationData: {
    sacrificeFor: '',
    gender: '',
    isAlive: '',
    intention: '',
    shortDuaa: '',
    executionDate: '',
    photo: '',
  },
  paymentMethod: '',
  paidAmount: '',
};

interface UserSuggestion {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  appId: string;
}

interface OrderResult {
  orderNumber: string;
  totalAmount: number;
  fullAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isPartialPayment: boolean;
  currency: string;
  checkoutUrl: string | null;
  createdUser?: { email: string; password: string } | null;
}

interface UIState {
  products: Product[];
  loadingProducts: boolean;
  referrals: Referral[];
  loadingReferrals: boolean;
  creating: boolean;
  invoiceFile: File | null;
  invoiceReviewed: boolean;
  invoiceValue: string;
  uploadingInvoice: boolean;
  uploadingPhoto: boolean;
  useCustomExecutionDate: boolean;
  formErrors: Record<string, string | undefined>;
  result: OrderResult | null;
  copied: boolean;
  credentialsCopied: boolean;
  linkedUserId: string | null;
  focusedField: 'phone' | 'email' | null;
  foundUsers: UserSuggestion[];
  customPriceBlurred: number[];
  phoneWhatsappClicked: boolean;
  priceEditIndices: number[];
}

type UIAction =
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'SET_LOADING_PRODUCTS'; loading: boolean }
  | { type: 'SET_REFERRALS'; referrals: Referral[] }
  | { type: 'SET_LOADING_REFERRALS'; loading: boolean }
  | { type: 'SET_CREATING'; creating: boolean }
  | { type: 'SET_INVOICE_FILE'; file: File | null }
  | { type: 'SET_INVOICE_REVIEWED'; reviewed: boolean }
  | { type: 'SET_INVOICE_VALUE'; value: string }
  | { type: 'SET_UPLOADING_INVOICE'; uploading: boolean }
  | { type: 'SET_UPLOADING_PHOTO'; uploading: boolean }
  | { type: 'SET_USE_CUSTOM_EXECUTION_DATE'; checked: boolean }
  | { type: 'SET_FORM_ERRORS'; errors: Record<string, string | undefined> }
  | { type: 'PATCH_FORM_ERRORS'; errors: Record<string, string | undefined> }
  | { type: 'CLEAR_FORM_ERRORS' }
  | { type: 'SET_RESULT'; result: OrderResult | null }
  | { type: 'SET_COPIED'; copied: boolean }
  | { type: 'SET_CREDENTIALS_COPIED'; copied: boolean }
  | { type: 'SET_LINKED_USER_ID'; userId: string | null }
  | { type: 'SET_FOCUSED_FIELD'; field: 'phone' | 'email' | null }
  | { type: 'CLEAR_FOCUSED_FIELD_IF'; field: 'phone' | 'email' }
  | { type: 'SET_FOUND_USERS'; users: UserSuggestion[] }
  | { type: 'BLUR_CUSTOM_PRICE'; index: number }
  | { type: 'CLEAR_CUSTOM_PRICE_BLURRED' }
  | { type: 'SET_CUSTOM_PRICE_BLURRED'; indices: number[] }
  | { type: 'SET_WHATSAPP_PHONE_CLICKED'; clicked: boolean }
  | { type: 'TOGGLE_PRICE_EDIT'; index: number }
  | { type: 'SET_PRICE_EDIT_INDICES'; indices: number[] }
  | { type: 'RESET_UI' };

const UI_INITIAL_STATE: UIState = {
  products: [],
  loadingProducts: false,
  referrals: [],
  loadingReferrals: false,
  creating: false,
  invoiceFile: null,
  invoiceReviewed: false,
  invoiceValue: '',
  uploadingInvoice: false,
  uploadingPhoto: false,
  useCustomExecutionDate: false,
  formErrors: {},
  result: null,
  copied: false,
  credentialsCopied: false,
  linkedUserId: null,
  focusedField: null,
  foundUsers: [],
  customPriceBlurred: [],
  phoneWhatsappClicked: false,
  priceEditIndices: [],
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_PRODUCTS':
      return { ...state, products: action.products };
    case 'SET_LOADING_PRODUCTS':
      return { ...state, loadingProducts: action.loading };
    case 'SET_REFERRALS':
      return { ...state, referrals: action.referrals };
    case 'SET_LOADING_REFERRALS':
      return { ...state, loadingReferrals: action.loading };
    case 'SET_CREATING':
      return { ...state, creating: action.creating };
    case 'SET_INVOICE_FILE':
      return { ...state, invoiceFile: action.file };
    case 'SET_INVOICE_REVIEWED':
      return { ...state, invoiceReviewed: action.reviewed };
    case 'SET_INVOICE_VALUE':
      return { ...state, invoiceValue: action.value };
    case 'SET_UPLOADING_INVOICE':
      return { ...state, uploadingInvoice: action.uploading };
    case 'SET_UPLOADING_PHOTO':
      return { ...state, uploadingPhoto: action.uploading };
    case 'SET_USE_CUSTOM_EXECUTION_DATE':
      return { ...state, useCustomExecutionDate: action.checked };
    case 'SET_FORM_ERRORS':
      return { ...state, formErrors: action.errors };
    case 'PATCH_FORM_ERRORS':
      return { ...state, formErrors: { ...state.formErrors, ...action.errors } };
    case 'CLEAR_FORM_ERRORS':
      return { ...state, formErrors: {} };
    case 'SET_RESULT':
      return { ...state, result: action.result };
    case 'SET_COPIED':
      return { ...state, copied: action.copied };
    case 'SET_CREDENTIALS_COPIED':
      return { ...state, credentialsCopied: action.copied };
    case 'SET_LINKED_USER_ID':
      return { ...state, linkedUserId: action.userId };
    case 'SET_FOCUSED_FIELD':
      return { ...state, focusedField: action.field };
    case 'CLEAR_FOCUSED_FIELD_IF':
      return state.focusedField === action.field ? { ...state, focusedField: null } : state;
    case 'SET_FOUND_USERS':
      return { ...state, foundUsers: action.users };
    case 'BLUR_CUSTOM_PRICE':
      return state.customPriceBlurred.includes(action.index)
        ? state
        : { ...state, customPriceBlurred: [...state.customPriceBlurred, action.index] };
    case 'CLEAR_CUSTOM_PRICE_BLURRED':
      return { ...state, customPriceBlurred: [] };
    case 'SET_CUSTOM_PRICE_BLURRED':
      return { ...state, customPriceBlurred: action.indices };
    case 'SET_WHATSAPP_PHONE_CLICKED':
      return { ...state, phoneWhatsappClicked: action.clicked };
    case 'TOGGLE_PRICE_EDIT':
      return state.priceEditIndices.includes(action.index)
        ? {
          ...state,
          priceEditIndices: state.priceEditIndices.filter((i) => i !== action.index),
        }
        : { ...state, priceEditIndices: [...state.priceEditIndices, action.index] };
    case 'SET_PRICE_EDIT_INDICES':
      return { ...state, priceEditIndices: action.indices };
    case 'RESET_UI':
      return UI_INITIAL_STATE;
    default:
      return state;
  }
}

export default function CreateManualOrderModal({
  isOpen,
  onClose,
  onSuccess,
  namespace = 'orders',
}: Props) {
  const t = useTranslations(namespace);
  const locale = useLocale();
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [ui, dispatch] = useReducer(uiReducer, UI_INITIAL_STATE);
  const {
    products,
    loadingProducts,
    referrals,
    loadingReferrals,
    creating,
    invoiceFile,
    invoiceReviewed,
    invoiceValue,
    uploadingInvoice,
    uploadingPhoto,
    useCustomExecutionDate,
    formErrors,
    result,
    copied,
    credentialsCopied,
    linkedUserId,
    focusedField,
    foundUsers,
    customPriceBlurred,
    phoneWhatsappClicked,
    priceEditIndices,
  } = ui;
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookupRef = useRef<{ phone: string; email: string; source: string }>({ phone: '', email: '', source: '' });
  const skipBlurValidationRef = useRef(false);
  const [invoicePreviewUrl, setInvoicePreviewUrl] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    const initialReferralId =
      user?.role !== 'super_admin' && user?.ref ? user.ref : '';
    setForm({ ...DEFAULT_FORM, referralId: initialReferralId });
    dispatch({ type: 'RESET_UI' });
    lastLookupRef.current = { phone: '', email: '', source: '' };
    setInvoicePreviewUrl(null);
  }, [user]);

  useEffect(() => {
    return () => {
      if (invoicePreviewUrl) {
        URL.revokeObjectURL(invoicePreviewUrl);
      }
    };
  }, [invoicePreviewUrl]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      dispatch({ type: 'SET_LOADING_PRODUCTS', loading: true });
      fetch('/api/products?status=Active', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            dispatch({ type: 'SET_PRODUCTS', products: data.data.products || [] });
          }
        })
        .catch(() => {
          toast.error(t('createManualOrder.loadProductsFailed'));
        })
        .finally(() => dispatch({ type: 'SET_LOADING_PRODUCTS', loading: false }));

      dispatch({ type: 'SET_LOADING_REFERRALS', loading: true });
      fetch('/api/referrals?limit=100', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            dispatch({ type: 'SET_REFERRALS', referrals: data.data.referrals || [] });
          }
        })
        .catch(() => {
          toast.error(t('createManualOrder.loadReferralsFailed'));
        })
        .finally(() => dispatch({ type: 'SET_LOADING_REFERRALS', loading: false }));
    }
  }, [isOpen, t, resetForm]);

  const productOptions = useMemo(
    () =>
      products.map((p) => ({
        label: locale === 'ar' ? p.name.ar || p.name.en : p.name.en || p.name.ar,
        value: p._id,
      })),
    [products, locale],
  );

  const getProduct = useCallback(
    (productId: string) => products.find((p) => p._id === productId) || null,
    [products],
  );

  const getSizeOptions = useCallback(
    (productId: string) => {
      const product = getProduct(productId);
      if (!product?.sizes?.length) return [];
      return product.sizes.map((s, i) => {
        const label =
          locale === 'ar'
            ? s.name?.ar || s.name?.en
            : s.name?.en || s.name?.ar;
        return {
          label: label || `Size ${i + 1}`,
          value: i,
        };
      });
    },
    [getProduct, locale],
  );

  // Global currency options: union of all currencies across all products
  const currencyOptions = useMemo(() => {
    const currencies = new Set<string>();
    products.forEach((p) => {
      currencies.add(p.baseCurrency);
      p.sizes.forEach((s) => {
        s.prices?.forEach((pr) => currencies.add(pr.currencyCode));
      });
    });
    return Array.from(currencies).map((c) => ({ label: c, value: c }));
  }, [products]);

  useEffect(() => {
    if (currencyOptions.length > 0 && !form.currency) {
      setForm((prev) => ({ ...prev, currency: currencyOptions[0].value }));
    }
  }, [currencyOptions, form.currency]);

  useEffect(() => {
    dispatch({ type: 'CLEAR_FORM_ERRORS' });
  }, [form, dispatch]);

  const sourceOptions = useMemo(
    () => [
      { label: 'Manasik', value: 'manasik' as Source },
      { label: 'Ghadaq', value: 'ghadaq' as Source },
    ],
    [],
  );

  const defaultRef = form.source === 'ghadaq' ? 'GHD-D' : 'MNK-D';

  const referralOptions = useMemo(() => {
    const isSuperAdmin = user?.role === 'super_admin';
    const options: Array<{ label: string; value: string }> = [];

    if (isSuperAdmin) {
      // Super admins can pick any referral + source default
      options.push({
        label: `${t('createManualOrder.noReferral') || 'Default'} (${defaultRef})`,
        value: '',
      });
      referrals.forEach((r) => {
        options.push({
          label: `${r.name} (${r.referralId})`,
          value: r.referralId,
        });
      });
    } else if (user?.ref) {
      // Regular admins only see their own ref
      const ownReferral = referrals.find((r) => r.referralId === user.ref);
      options.push({
        label: ownReferral
          ? `${ownReferral.name} (${ownReferral.referralId})`
          : `${user.ref}`,
        value: user.ref,
      });
    } else {
      // Fallback: no ref assigned — show source default
      options.push({
        label: `${t('createManualOrder.noReferral') || 'Default'} (${defaultRef})`,
        value: '',
      });
    }

    return options;
  }, [referrals, user, t, defaultRef]);

  const paymentMethodOptions = useMemo(
    () => [
      { label: t('createManualPayment.selectPaymentMethod') || 'Select payment method', value: '' as PaymentMethod },
      { label: t('createManualPayment.instaPay'), value: 'insta_pay' as PaymentMethod },
      { label: t('createManualPayment.vodafoneCash'), value: 'vodafone_cash' as PaymentMethod },
      { label: t('createManualPayment.bankTransfer'), value: 'bank_transfer' as PaymentMethod },
      { label: t('createManualPayment.paypal'), value: 'paypal' as PaymentMethod },
      { label: t('createManualPayment.binance'), value: 'binance' as PaymentMethod },
      { label: t('createManualPayment.easykash'), value: 'easykash' as PaymentMethod },
    ],
    [t],
  );

  const intentionOptions = useMemo(
    () => [
      { label: t('createManualOrder.intentionAqeeqah') || 'Aqeeqah', value: 'عقيقة' },
      { label: t('createManualOrder.intentionSacrifice') || 'Sacrifice', value: 'أُضحيــَــة' },
      { label: t('createManualOrder.intentionCharity') || 'Charity', value: 'صدقة' },
      { label: t('createManualOrder.intentionVow') || 'Vow', value: 'نذر' },
      { label: t('createManualOrder.intentionProtective') || 'Protective', value: 'فدو' },
    ],
    [t],
  );

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

  const itemTypeOptions = useMemo(
    () => [
      { label: t('createManualOrder.existingProduct') || 'Existing', value: 'existing' as OrderItemForm['type'] },
      { label: t('createManualOrder.customProduct') || 'Custom', value: 'custom' as OrderItemForm['type'] },
    ],
    [t],
  );

  const isEasykash = form.paymentMethod === 'easykash';

  const getLoadedUnitPrice = useCallback(
    (item: OrderItemForm) => {
      if (item.type !== 'existing' || !item.productId) return 0;
      const product = getProduct(item.productId);
      if (!product) return 0;
      const size = product.sizes?.[item.sizeIndex];
      if (!size) return 0;
      if (typeof size.manualPrice === 'number' && size.manualPrice > 0) {
        const manualCurrencyPrice = size.manualPrices?.find(
          (p: { currencyCode: string; amount: number }) => p.currencyCode === form.currency,
        );
        if (manualCurrencyPrice) return manualCurrencyPrice.amount;
        return size.manualPrice;
      }
      let unitPrice = size.price ?? 0;
      const currencyPrice = size.prices?.find(
        (p: { currencyCode: string; amount: number }) => p.currencyCode === form.currency,
      );
      if (currencyPrice) unitPrice = currencyPrice.amount;
      return unitPrice;
    },
    [getProduct, form.currency],
  );

  // Compute the full order total based on selected items + currency
  const fullOrderTotal = useMemo(() => {
    let total = 0;
    for (const item of form.items) {
      if (item.quantity <= 0) continue;
      if (item.type === 'custom') {
        const price = parseFloat(item.customPrice);
        if (!Number.isFinite(price) || price <= 0) continue;
        total += price * item.quantity;
      } else {
        if (!item.productId) continue;
        const originalPrice = getLoadedUnitPrice(item);
        const overridePrice = parseFloat(item.overridePrice);
        const unitPrice = Number.isFinite(overridePrice) && overridePrice >= 0 ? overridePrice : originalPrice;
        total += unitPrice * item.quantity;
      }
    }
    return total;
  }, [form.items, getLoadedUnitPrice]);

  const paidAmountNum = useMemo(() => {
    const n = parseFloat(form.paidAmount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [form.paidAmount]);

  const priceWarnings = useMemo(() => {
    const warnings: Array<{ index: number; message: string }> = [];
    form.items.forEach((item, index) => {
      if (item.type !== 'existing' || !item.productId || item.quantity <= 0) return;
      const overridePrice = parseFloat(item.overridePrice);
      if (!Number.isFinite(overridePrice) || overridePrice <= 0) return;
      const originalPrice = getLoadedUnitPrice(item);
      if (originalPrice <= 0) return;
      const deviation = Math.abs(overridePrice - originalPrice) / originalPrice;
      if (deviation > 0.05) {
        warnings.push({
          index,
          message:
            t('createManualOrder.priceWarning') ||
            'Custom price differs by more than 5% from the original price',
        });
      }
    });
    return warnings;
  }, [form.items, getLoadedUnitPrice, t]);

  const isPartialPayment = paidAmountNum > 0 && paidAmountNum < fullOrderTotal;
  const remainingAmount = isPartialPayment
    ? Math.max(0, fullOrderTotal - paidAmountNum)
    : 0;

  const validateForm = useCallback((): Record<string, string | undefined> => {
    const errors: Record<string, string | undefined> = {};
    if (form.items.length === 0) {
      errors.items = t('createManualOrder.errors.itemsRequired');
    }
    form.items.forEach((item, index) => {
      if (item.type === 'custom') {
        if (!item.customName.trim()) {
          errors[`item_${index}_name`] = t('createManualOrder.errors.customNameRequired') || 'Custom product name is required';
        }
        const customPrice = parseFloat(item.customPrice);
        if (!Number.isFinite(customPrice) || customPrice <= 0) {
          errors[`item_${index}_price`] = t('createManualOrder.errors.customPriceRequired') || 'Custom price is required';
        }
      } else {
        if (!item.productId) {
          errors[`item_${index}_product`] = t('createManualOrder.errors.productRequired');
        }
      }
      if (item.quantity <= 0) {
        errors[`item_${index}_quantity`] = t('createManualOrder.errors.quantityRequired');
      }
    });
    if (!form.currency) {
      errors.currency = t('createManualOrder.errors.currencyRequired');
    }
    if (!form.billingData.fullName.trim()) {
      const firstSacrificeName = form.reservationData.sacrificeFor
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)[0];
      if (!firstSacrificeName) {
        errors.fullName = t('createManualOrder.errors.fullNameOrSacrificeForRequired') || 'Please enter a customer name or a sacrifice-for name';
      }
    }
    if (!form.billingData.email.trim()) {
      errors.email = t('createManualOrder.errors.emailRequired');
    }
    if (!form.billingData.phone.trim()) {
      errors.phone = t('createManualOrder.errors.phoneRequired');
    } else if (!validatePhoneNumber(form.billingData.phone, form.billingData.country)) {
      errors.phone = t('createManualOrder.errors.phoneInvalid') || 'Invalid phone number';
    } else if (!phoneWhatsappClicked) {
      errors.phone = t('createManualOrder.errors.whatsappNotClicked') || 'Please click the WhatsApp icon to validate the phone number';
    }
    if (!form.billingData.country.trim()) {
      errors.country = t('createManualOrder.errors.countryRequired');
    }
    if (!form.paymentMethod) {
      errors.paymentMethod = t('createManualOrder.errors.paymentMethodRequired') || 'Payment method is required';
    }
    if (!isEasykash && !invoiceFile) {
      errors.invoice = t('createManualOrder.errors.invoiceRequired');
    }
    if (!isEasykash && invoiceFile && invoiceValue.trim() === '') {
      errors.invoiceValue = t('createManualOrder.errors.invoiceValueRequired') || 'Invoice value is required';
    } else if (!isEasykash && invoiceFile && !Number.isFinite(parseFloat(invoiceValue))) {
      errors.invoiceValue = t('createManualOrder.errors.invoiceValueInvalid') || 'Invoice value must be a number';
    } else if (!isEasykash && invoiceFile && parseFloat(invoiceValue) <= 0) {
      errors.invoiceValue = t('createManualOrder.errors.invoiceValueInvalid') || 'Invoice value must be greater than 0';
    }
    if (form.paidAmount.trim() === '' || !Number.isFinite(parseFloat(form.paidAmount))) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountRequired');
    } else if (paidAmountNum <= 0) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountRequired');
    } else if (paidAmountNum > fullOrderTotal) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountInvalid') || 'Paid amount must not exceed the order total';
    }
    return errors;
  }, [form, isEasykash, invoiceFile, paidAmountNum, fullOrderTotal, phoneWhatsappClicked, t]);

  const updateItem = (index: number, patch: Partial<OrderItemForm>) => {
    setForm((prev) => {
      const next = [...prev.items];
      next[index] = { ...next[index], ...patch };
      return { ...prev, items: next };
    });
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  };

  const removeItem = (index: number) => {
    setForm((prev) => {
      const next = prev.items.filter((_, i) => i !== index);
      if (next.length === 0) next.push(emptyItem());
      return { ...prev, items: next };
    });
    const adjustIndices = (arr: number[]) =>
      arr.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
    dispatch({
      type: 'SET_CUSTOM_PRICE_BLURRED',
      indices: adjustIndices(customPriceBlurred),
    });
    dispatch({
      type: 'SET_PRICE_EDIT_INDICES',
      indices: adjustIndices(priceEditIndices),
    });
  };

  const handleInvoiceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('editOrder.invalidInvoice'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t('editOrder.invoiceTooLarge'));
      return;
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setInvoicePreviewUrl(previewUrl);
    dispatch({ type: 'SET_INVOICE_FILE', file });
    dispatch({ type: 'SET_INVOICE_VALUE', value: '' });
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('editOrder.invalidImage'));
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('editOrder.imageTooLarge'));
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    try {
      dispatch({ type: 'SET_UPLOADING_PHOTO', uploading: true });
      const oldPhotoUrl = form.reservationData.photo;
      const url = await uploadImageToR2(file);
      setForm((prev) => ({
        ...prev,
        reservationData: { ...prev.reservationData, photo: url },
      }));

      if (oldPhotoUrl) {
        deleteOldImage(oldPhotoUrl).catch((error: unknown) => {
          console.warn('Failed to delete old customer image:', error);
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('editOrder.uploadFailed');
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_UPLOADING_PHOTO', uploading: false });
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const selectUser = useCallback((user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    appId: string;
  }) => {
    setForm((prev) => ({
      ...prev,
      billingData: {
        fullName: user.name || prev.billingData.fullName,
        email: user.email || prev.billingData.email,
        phone: user.phone || prev.billingData.phone,
        country: user.country || prev.billingData.country,
      },
    }));
    lastLookupRef.current = {
      phone: extractDigits(user.phone),
      email: user.email.trim().toLowerCase(),
      source: form.source,
    };
    dispatch({ type: 'SET_LINKED_USER_ID', userId: user._id });
    dispatch({ type: 'SET_FOUND_USERS', users: [] });
    dispatch({ type: 'PATCH_FORM_ERRORS', errors: { phone: '', email: '' } });
    dispatch({ type: 'SET_WHATSAPP_PHONE_CLICKED', clicked: false });
    skipBlurValidationRef.current = true;
    toast.success(t('createManualOrder.userSelected') || 'User selected');
  }, [form.source, t]);

  const lookupUser = useCallback(async (phone: string, email: string) => {
    if (!phone && !email) return;
    const phoneDigits = extractDigits(phone);
    const emailNormalized = email.toLowerCase().trim();
    if (
      lastLookupRef.current.phone === phoneDigits &&
      lastLookupRef.current.email === emailNormalized &&
      lastLookupRef.current.source === form.source
    ) {
      return;
    }

    lastLookupRef.current = {
      phone: phoneDigits,
      email: emailNormalized,
      source: form.source,
    };
    try {
      const params = new URLSearchParams();
      if (phone) params.set('phone', phone);
      if (email) params.set('email', email);
      if (form.source) params.set('source', form.source);
      const res = await fetch(`/api/orders/lookup-user?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const users = data.data as UserSuggestion[];
        const inputPhoneDigits = phone ? extractDigits(phone) : '';
        const inputEmail = email ? email.toLowerCase().trim() : '';
        const PHONE_MATCH_THRESHOLD = 0.9;
        const bestMatch = users.find((u) => {
          const userPhoneDigits = u.phone ? extractDigits(u.phone) : '';
          const userEmail = u.email ? u.email.toLowerCase().trim() : '';
          const phoneExact = inputPhoneDigits.length > 0 && userPhoneDigits === inputPhoneDigits;
          const emailExact = inputEmail.length > 0 && userEmail === inputEmail;
          const phoneClose =
            inputPhoneDigits.length > 0 &&
            userPhoneDigits.length > 0 &&
            phoneSimilarity(inputPhoneDigits, userPhoneDigits) >= PHONE_MATCH_THRESHOLD;
          return phoneExact || emailExact || phoneClose;
        });

        if (bestMatch) {
          selectUser(bestMatch);
        } else {
          dispatch({ type: 'SET_FOUND_USERS', users });
        }
      } else {
        dispatch({ type: 'SET_FOUND_USERS', users: [] });
      }
    } catch {
      toast.error(t('createManualOrder.userLookupFailed') || 'Failed to lookup user');
      dispatch({ type: 'SET_FOUND_USERS', users: [] });
    }
  }, [t, dispatch, form.source, selectUser]);

  useEffect(() => {
    const phone = extractDigits(form.billingData.phone.trim());
    const email = form.billingData.email.trim().toLowerCase();

    if (!phone && !email) {
      dispatch({ type: 'SET_LINKED_USER_ID', userId: null });
      dispatch({ type: 'SET_FOUND_USERS', users: [] });
      lastLookupRef.current = { phone: '', email: '', source: '' };
      return;
    }

    if (
      lastLookupRef.current.phone === phone &&
      lastLookupRef.current.email === email &&
      lastLookupRef.current.source === form.source
    ) {
      return;
    }

    dispatch({ type: 'SET_FOUND_USERS', users: [] });
    const timer = setTimeout(() => {
      lookupUser(form.billingData.phone.trim(), form.billingData.email.trim());
    }, 800);

    return () => clearTimeout(timer);
  }, [form.billingData.phone, form.billingData.email, form.source, lookupUser]);

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SET_FORM_ERRORS', errors });
      toast.error(t('createManualOrder.errors.fixForm') || 'Please fix the errors above');
      return;
    }
    dispatch({ type: 'CLEAR_FORM_ERRORS' });
    dispatch({ type: 'SET_CREATING', creating: true });
    try {
      let invoiceUrl = '';
      if (!isEasykash && invoiceFile) {
        dispatch({ type: 'SET_UPLOADING_INVOICE', uploading: true });
        invoiceUrl = await uploadInvoiceToR2(invoiceFile);
        dispatch({ type: 'SET_UPLOADING_INVOICE', uploading: false });
      }

      const reservationData = [];
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
      if (useCustomExecutionDate && form.reservationData.executionDate.trim()) {
        reservationData.push({ key: 'executionDate', value: form.reservationData.executionDate.trim() });
      }
      if (form.reservationData.photo.trim()) {
        reservationData.push({ key: 'photo', value: form.reservationData.photo.trim() });
      }

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: form.source,
          items: form.items.map((item) =>
            item.type === 'custom'
              ? {
                type: 'custom' as const,
                name: item.customName.trim(),
                size: item.customSize.trim() || undefined,
                quantity: item.quantity,
                price: parseFloat(item.customPrice),
              }
              : {
                type: 'existing' as const,
                productId: item.productId,
                quantity: item.quantity,
                sizeIndex: item.sizeIndex,
                customPrice: item.overridePrice ? parseFloat(item.overridePrice) : undefined,
              },
          ),
          currency: form.currency,
          referralId: form.referralId || undefined,
          billingData: form.billingData,
          reservationData,
          paymentMethod: form.paymentMethod,
          invoiceUrl: invoiceUrl || undefined,
          invoiceReviewed: invoiceUrl ? invoiceReviewed : undefined,
          invoiceValue: invoiceUrl ? parseFloat(invoiceValue) || 0 : undefined,
          locale: 'ar',
          userId: linkedUserId || undefined,
          paidAmount: paidAmountNum,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      dispatch({
        type: 'SET_RESULT',
        result: {
          orderNumber: data.data.order.orderNumber,
          totalAmount: data.data.order.totalAmount,
          fullAmount: data.data.order.fullAmount,
          paidAmount: data.data.order.paidAmount,
          remainingAmount: data.data.order.remainingAmount,
          isPartialPayment: data.data.order.isPartialPayment,
          currency: data.data.order.currency,
          checkoutUrl: data.data.checkoutUrl,
          createdUser: data.data.createdUser || null,
        },
      });

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('createManualOrder.failed');
      toast.error(message);
    } finally {
      dispatch({ type: 'SET_CREATING', creating: false });
      dispatch({ type: 'SET_UPLOADING_INVOICE', uploading: false });
    }
  };

  const handleCopyLink = async () => {
    if (!result?.checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(result.checkoutUrl);
      dispatch({ type: 'SET_COPIED', copied: true });
      setTimeout(() => dispatch({ type: 'SET_COPIED', copied: false }), 2000);
    } catch {
      toast.error(t('createManualOrder.copyFailed'));
    }
  };

  const handleCopyCredentials = async () => {
    if (!result?.createdUser) return;
    const text = `🎉 *تهانينا، لقد أنشئنا لك (حِساب مَجاني) على موقعنا الإلكتروني*\n\n🌐 استعمل هذه البيانات لتسجيل الدخول والاستفادة من خدمات الموقع. www.manasik.net\n\n* اسم المستخدم: ${result.createdUser.email}\n* كلمة المرور المؤقتة: ${result.createdUser.password}`;
    try {
      await navigator.clipboard.writeText(text);
      dispatch({ type: 'SET_CREDENTIALS_COPIED', copied: true });
      setTimeout(() => dispatch({ type: 'SET_CREDENTIALS_COPIED', copied: false }), 2000);
    } catch {
      toast.error(t('createManualOrder.copyFailed'));
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (result) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('createManualOrder.successTitle')}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
            <p className="text-sm text-secondary mb-1">{t('createManualOrder.orderNumber')}</p>
            <p className="text-2xl font-bold text-success">{result.orderNumber}</p>
            <p className="text-sm text-foreground mt-1">
              {result.isPartialPayment ? (
                <>
                  <span className="font-semibold">
                    {t('createManualOrder.paid') || 'Paid'}: {result.paidAmount.toFixed(2)} {result.currency}
                  </span>
                  {' · '}
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    {t('createManualOrder.remaining') || 'Remaining'}: {result.remainingAmount.toFixed(2)} {result.currency}
                  </span>
                </>
              ) : (
                <>{result.totalAmount.toFixed(2)} {result.currency}</>
              )}
            </p>
          </div>

          {result.createdUser && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-right" dir="rtl">
              <p className="text-sm font-medium text-foreground mb-3 leading-relaxed whitespace-pre-line">
                🎉 *تهانينا، لقد أنشئنا لك (حِساب مَجاني) على موقعنا الإلكتروني*
                {'\n\n'}🌐 استعمل هذه البيانات لتسجيل الدخول والاستفادة من خدمات الموقع. www.manasik.net
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-stroke bg-background">
                  <span className="text-secondary">* اسم المستخدم:</span>
                  <span className="font-medium text-foreground ltr" dir="ltr">{result.createdUser.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-stroke bg-background">
                  <span className="text-secondary">* كلمة المرور المؤقتة:</span>
                  <span className="font-medium text-foreground ltr" dir="ltr">{result.createdUser.password}</span>
                </div>
              </div>
              <div className="mt-3 flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCredentials}
                >
                  {credentialsCopied ? <LuCheck size={16} className="me-2" /> : <LuCopy size={16} className="me-2" />}
                  {credentialsCopied ? 'تم النسخ' : 'نسخ البيانات'}
                </Button>
              </div>
            </div>
          )}

          {result.checkoutUrl ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                {result.isPartialPayment
                  ? (t('createManualOrder.remainingPaymentLink') || 'Remaining Payment Link')
                  : t('createManualOrder.paymentLink')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.checkoutUrl}
                  className="flex-1 px-3 py-2 rounded-lg border border-stroke bg-background text-sm text-foreground truncate"
                />
                <Button
                  variant="primary"
                  size="custom"
                  className="px-3 py-2"
                  onClick={handleCopyLink}
                >
                  {copied ? <LuCheck size={18} /> : <LuCopy size={18} />}
                </Button>
              </div>
              <p className="text-xs text-secondary">{t('createManualOrder.copyLinkHint')}</p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
              <p className="text-sm text-primary font-medium">
                {result.isPartialPayment
                  ? (t('createManualOrder.partialOrderSuccess') || 'Partial order created successfully')
                  : t('createManualOrder.paidOrderSuccess')}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={handleClose}>
              {t('createManualOrder.close')}
            </Button>
            {result.checkoutUrl && (
              <Button
                variant="primary"
                onClick={() => window.open(result.checkoutUrl!, '_blank')}
              >
                <LuDownload size={16} className="me-2" />
                {t('createManualOrder.openLink')}
              </Button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('createManualOrder.title')}
      size="xl"
      contentClassName="flex flex-col gap-4 pr-1"
    >
      {/* Source */}
      <Dropdown
        label={t('createManualOrder.source')}
        value={form.source}
        options={sourceOptions}
        onChange={(val) => setForm((prev) => ({ ...prev, source: val }))}
        placeholder={t('createManualOrder.selectSource')}
      />

      {/* Referral */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          {t('createManualOrder.referral')}
        </label>
        <Tabs
          value={form.referralId}
          options={referralOptions}
          onChange={(val) => setForm((prev) => ({ ...prev, referralId: val ?? '' }))}
          size="md"
        />
      </div>

      {/* Items */}
      <div className="border-t border-stroke pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            {t('createManualOrder.items')}
          </h4>
          <span className="text-xs text-secondary">
            {form.items.length} {t('createManualOrder.itemCount')}
          </span>
        </div>

        {formErrors.items && (
          <p className="text-xs text-error mb-2">{formErrors.items}</p>
        )}

        <div className="flex flex-col gap-3">
          {form.items.map((item, index) => {
            const product = getProduct(item.productId);
            const sizeOpts = getSizeOptions(item.productId);
            return (
              <div
                key={index}
                className="flex flex-col gap-3 p-3 rounded-lg border border-stroke bg-background/50"
              >
                <div className="flex items-center justify-between">
                  <Tabs
                    value={item.type}
                    options={itemTypeOptions}
                    onChange={(val) => {
                      updateItem(index, { type: val });
                      if (val === 'existing' && priceEditIndices.includes(index)) {
                        dispatch({ type: 'TOGGLE_PRICE_EDIT', index });
                      }
                    }}
                    size="sm"
                  />
                  {index > 0 && (
                    <Button
                      variant="ghost"
                      size="custom"
                      className="h-8 w-8 p-0 text-secondary hover:text-error -me-2 -mt-2"
                      onClick={() => removeItem(index)}
                      aria-label={t('createManualOrder.removeItem')}
                    >
                      <LuX size={16} />
                    </Button>
                  )}
                </div>
                {item.type === 'existing' ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                      <div className="col-span-1 sm:col-span-2">
                        <QuantityInput
                          label={index === 0 ? t('createManualOrder.quantity') : undefined}
                          value={item.quantity}
                          min={0}
                          onChange={(val) => updateItem(index, { quantity: val })}
                          error={formErrors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-5">
                        <Dropdown
                          label={index === 0 ? t('createManualOrder.product') : undefined}
                          value={item.productId}
                          options={productOptions}
                          onChange={(val) => {
                            const nextItem = { ...item, productId: val, sizeIndex: 0 };
                            const loadedPrice = getLoadedUnitPrice(nextItem);
                            updateItem(index, {
                              productId: val,
                              sizeIndex: 0,
                              overridePrice: loadedPrice > 0 ? loadedPrice.toFixed(2) : '',
                            });
                            if (priceEditIndices.includes(index)) {
                              dispatch({ type: 'TOGGLE_PRICE_EDIT', index });
                            }
                          }}
                          placeholder={t('createManualOrder.selectProduct')}
                          disabled={loadingProducts}
                          error={formErrors[`item_${index}_product`]}
                          searchable
                          searchPlaceholder={t('createManualOrder.searchProduct') || 'Search products...'}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-5">
                        {sizeOpts.length > 1 && (
                          <Dropdown
                            label={index === 0 ? t('createManualOrder.size') : undefined}
                            value={item.sizeIndex}
                            options={sizeOpts}
                            onChange={(val) => {
                              const nextItem = { ...item, sizeIndex: val };
                              const loadedPrice = getLoadedUnitPrice(nextItem);
                              updateItem(index, {
                                sizeIndex: val,
                                overridePrice: loadedPrice > 0 ? loadedPrice.toFixed(2) : '',
                              });
                              if (priceEditIndices.includes(index)) {
                                dispatch({ type: 'TOGGLE_PRICE_EDIT', index });
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={index === 0 ? (t('createManualOrder.price') || 'Price') : undefined}
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.overridePrice}
                        placeholder={getLoadedUnitPrice(item).toFixed(2)}
                        onChange={(e) =>
                          updateItem(index, { overridePrice: e.target.value })
                        }
                        onBlur={() =>
                          dispatch({ type: 'BLUR_CUSTOM_PRICE', index })
                        }
                        readOnly={!priceEditIndices.includes(index)}
                        suffix={
                          <button
                            type="button"
                            onClick={() => dispatch({ type: 'TOGGLE_PRICE_EDIT', index })}
                            className="text-secondary hover:text-foreground transition-colors"
                            aria-label={priceEditIndices.includes(index) ? 'Lock price' : 'Edit price'}
                          >
                            <LuPencil size={16} />
                          </button>
                        }
                      />
                    </div>
                    {customPriceBlurred.includes(index) && priceWarnings.find((w) => w.index === index) && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 -mt-1">
                        {priceWarnings.find((w) => w.index === index)?.message}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                      <div className="col-span-1 sm:col-span-2">
                        <QuantityInput
                          label={index === 0 ? t('createManualOrder.quantity') : undefined}
                          value={item.quantity}
                          min={0}
                          onChange={(val) => updateItem(index, { quantity: val })}
                          error={formErrors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className="col-span-1 sm:col-span-5">
                        <Input
                          label={index === 0 ? (t('createManualOrder.customName') || 'Custom name') : undefined}
                          value={item.customName}
                          placeholder={t('createManualOrder.customNamePlaceholder') || 'Product name'}
                          onChange={(e) =>
                            updateItem(index, { customName: e.target.value })
                          }
                          error={formErrors[`item_${index}_name`]}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-5">
                        <Input
                          label={index === 0 ? (t('createManualOrder.customSize') || 'Custom size') : undefined}
                          value={item.customSize}
                          placeholder={t('createManualOrder.customSizePlaceholder') || 'Size (optional)'}
                          onChange={(e) =>
                            updateItem(index, { customSize: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <Input
                      label={index === 0 ? (t('createManualOrder.customPrice') || 'Price') : undefined}
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.customPrice}
                      placeholder="0.00"
                      onChange={(e) =>
                        updateItem(index, { customPrice: e.target.value })
                      }
                      error={formErrors[`item_${index}_price`]}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={addItem}
        >
          <LuPlus size={16} className="me-2" />
          {t('createManualOrder.addItem')}
        </Button>
      </div>

      {/* Customer Info */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.customerInfo')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            placeholder={t('createManualOrder.fullNamePlaceholder')}
            value={form.billingData.fullName}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, fullName: e.target.value },
              }))
            }
            error={formErrors.fullName}
          />

          <div className="relative">
            <Input
              placeholder={t('createManualOrder.phonePlaceholder')}
              value={form.billingData.phone}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  billingData: { ...prev.billingData, phone: e.target.value },
                }));
                dispatch({ type: 'SET_LINKED_USER_ID', userId: null });
                dispatch({ type: 'PATCH_FORM_ERRORS', errors: { phone: '' } });
                if (phoneWhatsappClicked) {
                  dispatch({ type: 'SET_WHATSAPP_PHONE_CLICKED', clicked: false });
                }
              }}
              onFocus={() => dispatch({ type: 'SET_FOCUSED_FIELD', field: 'phone' })}
              onBlur={() => {
                setTimeout(() => dispatch({ type: 'CLEAR_FOCUSED_FIELD_IF', field: 'phone' }), 150);
                if (skipBlurValidationRef.current) {
                  skipBlurValidationRef.current = false;
                  return;
                }
                const phone = form.billingData.phone.trim();
                if (!phone) {
                  dispatch({
                    type: 'PATCH_FORM_ERRORS',
                    errors: { phone: t('createManualOrder.errors.phoneRequired') },
                  });
                } else if (!validatePhoneNumber(form.billingData.phone, form.billingData.country)) {
                  dispatch({
                    type: 'PATCH_FORM_ERRORS',
                    errors: { phone: t('createManualOrder.errors.phoneInvalid') || 'Invalid phone number' },
                  });
                }
              }}
              error={formErrors.phone}
              suffix={
                form.billingData.phone.replace(/\D/g, '').length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_WHATSAPP_PHONE_CLICKED', clicked: true });
                      dispatch({ type: 'PATCH_FORM_ERRORS', errors: { phone: '' } });
                      window.open(
                        `https://wa.me/${form.billingData.phone.replace(/\D/g, '')}`,
                        '_blank',
                      );
                    }}
                    className={`transition-colors ${phoneWhatsappClicked
                      ? 'text-success'
                      : 'text-success hover:text-foreground'
                      }`}
                    aria-label="Open WhatsApp chat"
                  >
                    <FaWhatsapp size={18} />
                  </button>
                ) : null
              }
            />
            {!phoneWhatsappClicked && form.billingData.phone.replace(/\D/g, '').length > 0 && (
              <p className="text-xs text-secondary">
                {t('createManualOrder.whatsappClickHint') || 'Click the WhatsApp icon to validate the phone number'}
              </p>
            )}
            {focusedField === 'phone' && foundUsers.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-stroke bg-card-bg shadow-xl max-h-60 overflow-y-auto p-1">
                {foundUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className="w-full px-3 py-2 text-start text-sm hover:bg-background rounded-lg transition-colors"
                  >
                    <div className="font-medium truncate">{user.name || '-'}</div>
                    <div className="text-xs text-secondary truncate">{user.phone || '-'}</div>
                    <div className="text-xs text-secondary truncate">{user.email || '-'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Input
              placeholder={t('createManualOrder.emailPlaceholder')}
              type="email"
              value={form.billingData.email}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  billingData: { ...prev.billingData, email: e.target.value },
                }));
                dispatch({ type: 'SET_LINKED_USER_ID', userId: null });
              }}
              onFocus={() => dispatch({ type: 'SET_FOCUSED_FIELD', field: 'email' })}
              onBlur={() => {
                setTimeout(() => dispatch({ type: 'CLEAR_FOCUSED_FIELD_IF', field: 'email' }), 150);
                if (skipBlurValidationRef.current) {
                  skipBlurValidationRef.current = false;
                  return;
                }
              }}
              error={formErrors.email}
              suffix={
                !form.billingData.email.trim() && form.billingData.phone.trim() ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        billingData: {
                          ...prev.billingData,
                          email: `${extractDigits(prev.billingData.phone)}@gmail.com`,
                        },
                      }));
                      dispatch({ type: 'SET_LINKED_USER_ID', userId: null });
                      dispatch({ type: 'SET_FOUND_USERS', users: [] });
                    }}
                    className="text-secondary hover:text-foreground transition-colors"
                    aria-label="Use phone as Gmail"
                  >
                    <LuAtSign size={16} />
                  </button>
                ) : null
              }
            />
            {focusedField === 'email' && foundUsers.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-lg border border-stroke bg-card-bg shadow-xl max-h-60 overflow-y-auto p-1">
                {foundUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => selectUser(user)}
                    className="w-full px-3 py-2 text-start text-sm hover:bg-background rounded-lg transition-colors"
                  >
                    <div className="font-medium truncate">{user.name || '-'}</div>
                    <div className="text-xs text-secondary truncate">{user.email || '-'}</div>
                    <div className="text-xs text-secondary truncate">{user.phone || '-'}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <CountrySelector
            value={form.billingData.country}
            onChange={(val) =>
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, country: val },
              }))
            }
            placeholder={t('createManualOrder.countryPlaceholder')}
            error={formErrors.country}
          />
        </div>
      </div>

      {/* Reservation Data */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.reservationData')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('createManualOrder.sacrificeFor')}
            </label>
            <MultiNameInput
              value={form.reservationData.sacrificeFor}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, sacrificeFor: value },
                }))
              }
              placeholder={t('createManualOrder.sacrificeForPlaceholder')}
              isRTL={locale === 'ar'}
            />
          </div>
          <Dropdown
            label={t('createManualOrder.intention')}
            value={form.reservationData.intention}
            options={intentionOptions}
            onChange={(val) =>
              setForm((prev) => ({
                ...prev,
                reservationData: { ...prev.reservationData, intention: val },
              }))
            }
            placeholder={t('createManualOrder.selectIntention')}
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('createManualOrder.gender')}
            </label>
            <div className="flex flex-wrap gap-4">
              {genderOptions.map((option) => (
                <RadioButton
                  key={`gender-${option.value}`}
                  id={`gender-${option.value}`}
                  name="gender"
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
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('createManualOrder.isAlive')}
            </label>
            <div className="flex flex-wrap gap-4">
              {isAliveOptions.map((option) => (
                <RadioButton
                  key={`status-${option.value}`}
                  id={`status-${option.value}`}
                  name="status"
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
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('createManualOrder.shortDuaa')}
            </label>
            <textarea
              value={form.reservationData.shortDuaa}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, shortDuaa: e.target.value },
                }))
              }
              rows={2}
              className="w-full rounded-lg border border-stroke bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t('createManualOrder.photo') || 'Photo'}
            </label>
            <div className="flex items-center gap-3">
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
                <a
                  href={form.reservationData.photo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate max-w-50"
                >
                  {t('createManualOrder.viewPhoto') || 'View Photo'}
                </a>
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
          <div className="flex flex-col gap-3">
            <Switch
              checked={useCustomExecutionDate}
              onChange={(checked) => {
                dispatch({ type: 'SET_USE_CUSTOM_EXECUTION_DATE', checked });
                if (!checked) {
                  setForm((prev) => ({
                    ...prev,
                    reservationData: { ...prev.reservationData, executionDate: '' },
                  }));
                }
              }}
              label={t('createManualOrder.customExecutionDate')}
            />
            {useCustomExecutionDate && (
              <CustomDatePicker
                value={form.reservationData.executionDate}
                onChange={(val) =>
                  setForm((prev) => ({
                    ...prev,
                    reservationData: { ...prev.reservationData, executionDate: val },
                  }))
                }
                locale={locale}
                label={t('createManualOrder.executionDate')}
                placeholder={t('createManualOrder.executionDate')}
                minDate={(() => {
                  const today = new Date();
                  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                })()}
              />
            )}
            {!useCustomExecutionDate && (
              <p className="text-sm text-secondary">
                {t('createManualOrder.defaultExecutionDateHint')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Payment */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.payment')}
        </h4>
        <div className="flex flex-col gap-4">
          {/* Order total summary */}
          {fullOrderTotal > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">
                  {t('createManualOrder.fullAmount') || 'Full Order Total'}
                </span>
                <span className="font-bold text-foreground">
                  {fullOrderTotal.toFixed(2)} {form.currency}
                </span>
              </div>
              {isPartialPayment && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">
                      {t('createManualOrder.paid') || 'Paid Amount'}
                    </span>
                    <span className="font-bold text-success">
                      {paidAmountNum.toFixed(2)} {form.currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-secondary">
                      {t('createManualOrder.remaining') || 'Remaining'}
                    </span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {remainingAmount.toFixed(2)} {form.currency}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Paid amount input — allows admin to record a partial payment */}
          <Input
            label={t('createManualOrder.paidAmount') || 'Paid Amount (leave empty for full payment)'}
            type="number"
            min={0}
            step="0.01"
            value={form.paidAmount}
            placeholder={fullOrderTotal > 0 ? fullOrderTotal.toFixed(2) : '0.00'}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, paidAmount: e.target.value }))
            }
            error={formErrors.paidAmount}
          />
          {isPartialPayment && (
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {t('createManualOrder.partialPaymentHint') || 'Order will be created as partial-paid. The remaining amount can be collected later via a payment link or another invoice.'}
            </p>
          )}

          <Dropdown
            label={t('createManualOrder.currency')}
            value={form.currency}
            options={currencyOptions}
            onChange={(val) => setForm((prev) => ({ ...prev, currency: val }))}
            placeholder={t('createManualOrder.selectCurrency')}
            error={formErrors.currency}
          />

          <Dropdown
            label={t('createManualOrder.paymentMethod')}
            value={form.paymentMethod}
            options={paymentMethodOptions}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, paymentMethod: val }))
            }
            error={formErrors.paymentMethod}
          />

          {!isEasykash && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                {t('createManualOrder.invoiceUpload')}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {uploadingInvoice ? (
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke text-secondary">
                    <LuRefreshCw size={16} className="animate-spin" />
                    {t('createManualOrder.uploadingInvoice') || 'Uploading...'}
                  </span>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={formErrors.invoice ? 'border-error text-error hover:text-error hover:border-error' : ''}
                      onClick={() => {
                        dispatch({ type: 'SET_INVOICE_REVIEWED', reviewed: true });
                        invoiceInputRef.current?.click();
                      }}
                    >
                      <LuUpload size={16} className="me-2" />
                      {t('createManualOrder.uploadReviewedInvoice') || 'Reviewed Invoice'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={formErrors.invoice ? 'border-error text-error hover:text-error hover:border-error' : ''}
                      onClick={() => {
                        dispatch({ type: 'SET_INVOICE_REVIEWED', reviewed: false });
                        invoiceInputRef.current?.click();
                      }}
                    >
                      <LuUpload size={16} className="me-2" />
                      {t('createManualOrder.uploadUnreviewedInvoice') || 'Unreviewed Invoice'}
                    </Button>
                  </>
                )}
                {invoiceFile && (
                  <span className="text-sm text-secondary">{invoiceFile.name}</span>
                )}
              </div>
              {invoiceFile && (
                <Input
                  label={t('createManualOrder.invoiceValue') || 'Invoice Value'}
                  type="number"
                  min={0}
                  step="0.01"
                  value={invoiceValue}
                  onChange={(e) =>
                    dispatch({ type: 'SET_INVOICE_VALUE', value: e.target.value })
                  }
                  error={formErrors.invoiceValue}
                />
              )}
              {invoicePreviewUrl && (
                <div className="w-fit">
                  <img
                    src={invoicePreviewUrl}
                    alt="Invoice preview"
                    className="h-32 rounded-lg border border-stroke object-contain bg-background"
                  />
                </div>
              )}
              {formErrors.invoice && (
                <p className="text-xs text-error">{formErrors.invoice}</p>
              )}
              <input
                ref={invoiceInputRef}
                type="file"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={handleInvoiceFileChange}
              />
            </div>
          )}

          {isEasykash && isPartialPayment && (
            <p className="text-xs text-secondary">
              {t('createManualOrder.easykashPartialHint') || 'An EasyKash payment link will be generated for the remaining amount. The paid portion will be recorded as a manual payment.'}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-end pt-2 border-t border-stroke">
        <Button variant="outline" onClick={handleClose} disabled={creating}>
          {t('createManualOrder.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={creating}
        >
          {creating ? (
            <>
              <LuRefreshCw size={16} className="animate-spin me-2" />
              {t('createManualOrder.creating')}
            </>
          ) : (
            t('createManualOrder.create')
          )}
        </Button>
      </div>
    </Modal >
  );
}
