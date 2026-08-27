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
import Textarea from '@/components/ui/textarea';
import { uploadImageToR2, uploadInvoiceToR2, deleteOldImage } from '../../lib/image-upload-utils';

import { LuCopy, LuCheck, LuRefreshCw, LuUpload, LuPlus, LuX, LuAtSign, LuPencil, LuUserCheck, LuImage, LuClock, LuLink, LuFileText } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import { COUNTRIES } from '@/lib/countries';
import { MANUAL_PAYMENT_METHODS, EASYKASH_PAYMENT_METHOD } from '@/lib/order';
import CurrencySelector from '@/components/shared/currency-selector';
import type { PaymentMethod, Order } from '@/types/Order';
import { buildOrderWhatsappMessageFromOrder } from '@/lib/order-whatsapp';
import { normalizeWhatsappPhone } from '@/lib/order/order-utils';
import ExchangeRateDisplay from '@/components/order/exchange-rate-display';

function extractDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Detect the country from a full international phone number (e.g. "+201234567890").
 * Returns the country name (matching COUNTRIES[].value) or null if detection fails.
 */
function detectCountryFromPhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Ensure the number starts with "+" so libphonenumber treats it as international
  const normalized = trimmed.startsWith('+') ? trimmed : `+${trimmed.replace(/^\+?/, '')}`;

  try {
    const parsed = parsePhoneNumberFromString(normalized);
    if (parsed?.country) {
      const country = COUNTRIES.find((c) => c.code === parsed.country);
      if (country) return country.value;
    }
  } catch {
    // ignore parse errors
  }

  // Fallback: match by phone code prefix against COUNTRIES
  const digits = extractDigits(trimmed);
  if (digits.length >= 2) {
    // Sort by phoneCode length descending so longer prefixes match first
    const sorted = [...COUNTRIES].sort((a, b) => b.phoneCode.length - a.phoneCode.length);
    for (const c of sorted) {
      if (digits.startsWith(c.phoneCode)) {
        return c.value;
      }
    }
  }

  return null;
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

type ManualPaymentMethod = PaymentMethod | '';
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

interface InvoiceEntry {
  file: File;
  invoiceStatus: 'confirmed' | 'waiting';
  value: string;
  currency: string;
  previewUrl: string | null;
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
  paymentMethod: ManualPaymentMethod;
  paidAmount: string;
  remainingAmount: string;
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
  remainingAmount: '',
};

// ── Form caching ────────────────────────────────────────────────────────
// The form state is cached in sessionStorage so the admin doesn't lose
// their data when they close and reopen the modal. The cache is cleared
// after a successful order creation.
const FORM_CACHE_KEY = 'manualOrder.formCache';

function loadCachedForm(): FormState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(FORM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FormState;
    // Basic validation — ensure it has the expected shape
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveCachedForm(form: FormState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FORM_CACHE_KEY, JSON.stringify(form));
  } catch {
    // ignore
  }
}

function clearCachedForm(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FORM_CACHE_KEY);
  } catch {
    // ignore
  }
}

interface UserSuggestion {
  _id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  appId: string;
}

interface OrderResult {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  fullAmount: number;
  paidAmount: number;
  remainingAmount: number;
  isPartialPayment: boolean;
  currency: string;
  status: string;
  checkoutUrl: string | null;
  createdUser?: { email: string; password: string } | null;
}

interface UIState {
  products: Product[];
  loadingProducts: boolean;
  referrals: Referral[];
  loadingReferrals: boolean;
  creating: boolean;
  invoices: InvoiceEntry[];
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
  recentProductIds: string[];
  paymentEditField: 'paid' | 'remaining' | null;
}

type UIAction =
  | { type: 'SET_PRODUCTS'; products: Product[] }
  | { type: 'SET_LOADING_PRODUCTS'; loading: boolean }
  | { type: 'SET_REFERRALS'; referrals: Referral[] }
  | { type: 'SET_LOADING_REFERRALS'; loading: boolean }
  | { type: 'SET_CREATING'; creating: boolean }
  | { type: 'ADD_INVOICE'; invoice: InvoiceEntry }
  | { type: 'REMOVE_INVOICE'; index: number }
  | { type: 'UPDATE_INVOICE'; index: number; patch: Partial<InvoiceEntry> }
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
  | { type: 'ADD_RECENT_PRODUCT'; productId: string }
  | { type: 'SET_RECENT_PRODUCT_IDS'; productIds: string[] }
  | { type: 'SET_PAYMENT_EDIT_FIELD'; field: 'paid' | 'remaining' | null }
  | { type: 'RESET_UI' };

const RECENT_PRODUCTS_STORAGE_KEY = 'manualOrder_recentProductIds';
const MAX_RECENT_PRODUCTS = 10;

function loadRecentProductIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentProductIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_PRODUCTS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

const UI_INITIAL_STATE: UIState = {
  products: [],
  loadingProducts: false,
  referrals: [],
  loadingReferrals: false,
  creating: false,
  invoices: [],
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
  recentProductIds: [],
  paymentEditField: null,
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
    case 'ADD_INVOICE':
      return { ...state, invoices: [...state.invoices, action.invoice] };
    case 'REMOVE_INVOICE': {
      const removed = state.invoices[action.index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return { ...state, invoices: state.invoices.filter((_, i) => i !== action.index) };
    }
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map((inv, i) =>
          i === action.index ? { ...inv, ...action.patch } : inv,
        ),
      };
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
    case 'ADD_RECENT_PRODUCT': {
      const next = [action.productId, ...state.recentProductIds.filter((id) => id !== action.productId)].slice(0, MAX_RECENT_PRODUCTS);
      saveRecentProductIds(next);
      return { ...state, recentProductIds: next };
    }
    case 'SET_RECENT_PRODUCT_IDS':
      return { ...state, recentProductIds: action.productIds };
    case 'SET_PAYMENT_EDIT_FIELD':
      return { ...state, paymentEditField: action.field };
    case 'RESET_UI':
      return { ...UI_INITIAL_STATE, recentProductIds: state.recentProductIds };
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
  const [form, setForm] = useState<FormState>(() => {
    const cached = loadCachedForm();
    if (cached) {
      // Ensure the referral ID is correct for the current user
      const initialReferralId =
        user?.role !== 'super_admin' && user?.ref ? user.ref : cached.referralId;
      return { ...cached, referralId: initialReferralId };
    }
    const initialReferralId =
      user?.role !== 'super_admin' && user?.ref ? user.ref : '';
    return { ...DEFAULT_FORM, referralId: initialReferralId };
  });
  const [ui, dispatch] = useReducer(uiReducer, UI_INITIAL_STATE);
  const {
    products,
    loadingProducts,
    referrals,
    creating,
    invoices,
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
    recentProductIds,
    paymentEditField,
  } = ui;
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const priceInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastLookupRef = useRef<{ phone: string; email: string; source: string }>({ phone: '', email: '', source: '' });
  const skipBlurValidationRef = useRef(false);
  const pendingInvoiceStatusRef = useRef<'confirmed' | 'waiting' | null>(null);
  const [pendingInvoiceStatus, setPendingInvoiceStatus] = useState<'confirmed' | 'waiting' | null>(null);
  // invoiceInputRef → for files (PDF, DOC, TXT)
  // invoiceImageInputRef → for images (JPG, PNG, WebP)
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceImageInputRef = useRef<HTMLInputElement | null>(null);

  const invoicesRef = useRef<InvoiceEntry[]>([]);
  invoicesRef.current = invoices;

  const resetForm = useCallback(() => {
    const initialReferralId =
      user?.role !== 'super_admin' && user?.ref ? user.ref : '';
    setForm({ ...DEFAULT_FORM, referralId: initialReferralId });
    // Revoke any invoice preview URLs before resetting
    invoicesRef.current.forEach((inv) => {
      if (inv.previewUrl) URL.revokeObjectURL(inv.previewUrl);
    });
    dispatch({ type: 'RESET_UI' });
    lastLookupRef.current = { phone: '', email: '', source: '' };
    pendingInvoiceStatusRef.current = null;
    setPendingInvoiceStatus(null);
    clearCachedForm();
  }, [user]);

  // Save form to cache whenever it changes (so reopening preserves data)
  useEffect(() => {
    saveCachedForm(form);
  }, [form]);

  // Load recently used product IDs from localStorage on mount
  useEffect(() => {
    const ids = loadRecentProductIds();
    if (ids.length > 0) {
      dispatch({ type: 'SET_RECENT_PRODUCT_IDS', productIds: ids });
    }
  }, []);

  useEffect(() => {
    return () => {
      invoices.forEach((inv) => {
        if (inv.previewUrl) URL.revokeObjectURL(inv.previewUrl);
      });
    };
  }, [invoices]);

  useEffect(() => {
    if (isOpen) {
      // Don't reset the form — the cached form is loaded from the
      // useState initializer. Only load products and referrals.
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
  }, [isOpen, t]);

  const productOptions = useMemo(() => {
    const base = products.map((p) => ({
      label: locale === 'ar' ? p.name.ar || p.name.en : p.name.en || p.name.ar,
      value: p._id,
    }));
    // Sort so recently used products appear first
    if (recentProductIds.length === 0) return base;
    const recentSet = new Map(recentProductIds.map((id, i) => [id, i]));
    return [...base].sort((a, b) => {
      const ai = recentSet.has(a.value) ? recentSet.get(a.value)! : Infinity;
      const bi = recentSet.has(b.value) ? recentSet.get(b.value)! : Infinity;
      return ai - bi;
    });
  }, [products, locale, recentProductIds]);

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

  // Default currency: use first product's currency, or EGP
  useEffect(() => {
    if (!form.currency) {
      const firstProductCurrency = products.find((p) => p.baseCurrency)?.baseCurrency;
      setForm((prev) => ({ ...prev, currency: firstProductCurrency || 'EGP' }));
    }
  }, [products, form.currency]);

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
      { label: t('createManualPayment.selectPaymentMethod') || 'Select payment method', value: '' as ManualPaymentMethod },
      ...MANUAL_PAYMENT_METHODS.map((method) => {
        const keyMap = {
          easykash: 'createManualPayment.easykash',
          insta_pay: 'createManualPayment.instaPay',
          vodafone_cash: 'createManualPayment.vodafoneCash',
          bank_transfer: 'createManualPayment.bankTransfer',
          paypal: 'createManualPayment.paypal',
          binance: 'createManualPayment.binance',
        } as const;
        return {
          label: t(keyMap[method as keyof typeof keyMap]),
          value: method as ManualPaymentMethod,
        };
      }),
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

  const isEasykash = form.paymentMethod === EASYKASH_PAYMENT_METHOD;

  const getLoadedUnitPrice = useCallback(
    (item: OrderItemForm) => {
      if (item.type !== 'existing' || !item.productId) return 0;
      const product = getProduct(item.productId);
      if (!product) return 0;
      const size = product.sizes?.[item.sizeIndex];
      if (!size) return 0;
      // Manual price is EGP-only — use it when currency is EGP,
      // otherwise fall back to the regular multi-currency price.
      if (typeof size.manualPrice === 'number' && size.manualPrice > 0 && form.currency === 'EGP') {
        return size.manualPrice;
      }
      // Try prices[] first (source of truth), then fall back to deprecated price field
      const currencyPrice = size.prices?.find(
        (p: { currencyCode: string; amount: number }) => p.currencyCode === form.currency,
      );
      if (currencyPrice) return currencyPrice.amount;
      // If currency matches base currency, use base price from prices[] or legacy field
      if (form.currency === product.baseCurrency) {
        const baseEntry = size.prices?.find(
          (p: { currencyCode: string; amount: number }) =>
            p.currencyCode === product.baseCurrency,
        );
        return baseEntry?.amount ?? size.price ?? 0;
      }
      return size.price ?? 0;
    },
    [getProduct, form.currency],
  );

  // Shared currency change handler — updates all auto-priced items to the new currency
  const handleCurrencyChange = useCallback(
    (val: string) => {
      setForm((prev) => {
        const updatedItems = prev.items.map((item, index) => {
          if (item.type !== 'existing' || !item.productId) return item;
          if (priceEditIndices.includes(index)) return item;
          const product = getProduct(item.productId);
          if (!product) return item;
          const size = product.sizes?.[item.sizeIndex];
          if (!size) return item;
          let unitPrice = 0;
          // Manual price is EGP-only — use it when currency is EGP,
          // otherwise fall back to the regular multi-currency price.
          if (typeof size.manualPrice === 'number' && size.manualPrice > 0 && val === 'EGP') {
            unitPrice = size.manualPrice;
          } else {
            const currencyPrice = size.prices?.find(
              (p: { currencyCode: string; amount: number }) => p.currencyCode === val,
            );
            if (currencyPrice) {
              unitPrice = currencyPrice.amount;
            } else if (val === product.baseCurrency) {
              const baseEntry = size.prices?.find(
                (p: { currencyCode: string; amount: number }) =>
                  p.currencyCode === product.baseCurrency,
              );
              unitPrice = baseEntry?.amount ?? size.price ?? 0;
            } else {
              unitPrice = size.price ?? 0;
            }
          }
          return {
            ...item,
            overridePrice: unitPrice > 0 ? unitPrice.toFixed(2) : '',
          };
        });
        return { ...prev, currency: val, items: updatedItems };
      });
    },
    [getProduct, priceEditIndices],
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

  // When the order total changes (e.g. product changed, quantity changed,
  // or price override), recalculate the paid/remaining amounts so they
  // stay consistent with the new total. If the paid amount now exceeds the
  // new total, clear both fields so the admin re-enters them.
  useEffect(() => {
    if (fullOrderTotal <= 0) return;
    setForm((prev) => {
      const paid = parseFloat(prev.paidAmount);
      const remaining = parseFloat(prev.remainingAmount);

      // If the paid amount exceeds the new order total, clear both fields
      // — the admin needs to re-enter the paid amount for the new product.
      if (Number.isFinite(paid) && paid > fullOrderTotal) {
        if (prev.paidAmount === '' && prev.remainingAmount === '') return prev;
        return { ...prev, paidAmount: '', remainingAmount: '' };
      }

      if (paymentEditField === 'paid') {
        // Admin was editing paid → keep paid, recalc remaining
        if (!Number.isFinite(paid) || paid <= 0) return prev; // nothing to recalc
        const newRemaining = Math.max(0, fullOrderTotal - paid);
        const newRemainingStr = newRemaining > 0 ? newRemaining.toFixed(2) : '';
        if (prev.remainingAmount === newRemainingStr) return prev;
        return { ...prev, remainingAmount: newRemainingStr };
      }

      if (paymentEditField === 'remaining') {
        // Admin was editing remaining → keep remaining, recalc paid
        if (!Number.isFinite(remaining) || remaining <= 0) return prev;
        const newPaid = Math.max(0, fullOrderTotal - remaining);
        const newPaidStr = newPaid > 0 ? newPaid.toFixed(2) : '';
        if (prev.paidAmount === newPaidStr) return prev;
        return { ...prev, paidAmount: newPaidStr };
      }

      // No field was explicitly edited yet — if both are empty, leave them
      // (placeholders will show the correct values). If the admin had
      // previously entered values that are now stale, reset them.
      if (prev.paidAmount || prev.remainingAmount) {
        const prevPaid = parseFloat(prev.paidAmount);
        if (Number.isFinite(prevPaid) && prevPaid > 0) {
          // Had a paid amount → recalc remaining from it
          const newRemaining = Math.max(0, fullOrderTotal - prevPaid);
          return {
            ...prev,
            remainingAmount: newRemaining > 0 ? newRemaining.toFixed(2) : '',
          };
        }
      }
      return prev;
    });
  }, [fullOrderTotal]); // eslint-disable-line react-hooks/exhaustive-deps -- paymentEditField and setForm are stable enough; we only want to fire when the total changes

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
    if (!isEasykash && invoices.length === 0) {
      errors.invoice = t('createManualOrder.errors.invoiceRequired');
    }
    if (!isEasykash) {
      invoices.forEach((invoice, index) => {
        if (invoice.value.trim() === '') {
          errors[`invoice_${index}_value`] = t('createManualOrder.errors.invoiceValueRequired') || 'Invoice value is required';
        } else if (!Number.isFinite(parseFloat(invoice.value))) {
          errors[`invoice_${index}_value`] = t('createManualOrder.errors.invoiceValueInvalid') || 'Invoice value must be a number';
        } else if (parseFloat(invoice.value) <= 0) {
          errors[`invoice_${index}_value`] = t('createManualOrder.errors.invoiceValueInvalid') || 'Invoice value must be greater than 0';
        }
      });
    }
    if (form.paidAmount.trim() === '' || !Number.isFinite(parseFloat(form.paidAmount))) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountRequired');
    } else if (paidAmountNum <= 0) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountRequired');
    } else if (paidAmountNum > fullOrderTotal) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountInvalid') || 'Paid amount must not exceed the order total';
    }
    return errors;
  }, [form, isEasykash, invoices, paidAmountNum, fullOrderTotal, phoneWhatsappClicked, t]);

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

  // Handler for invoice file selection — uses the pending invoice status
  // (confirmed/waiting) that the admin selected before picking the file.
  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const invoiceStatus = pendingInvoiceStatusRef.current ?? 'waiting';

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(t('editOrder.invalidInvoice') || 'Invalid file type');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('editOrder.invoiceTooLarge') || 'File too large');
        continue;
      }

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      dispatch({
        type: 'ADD_INVOICE',
        invoice: {
          file,
          invoiceStatus,
          value: '',
          currency: form.currency || 'EGP',
          previewUrl,
        },
      });
    }

    // Reset the pending status and the input so the same file can be selected again
    pendingInvoiceStatusRef.current = null;
    setPendingInvoiceStatus(null);
    if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    if (invoiceImageInputRef.current) invoiceImageInputRef.current.value = '';
  };

  // Toggle invoice status between confirmed and waiting, then
  // recalculate the paid amount from confirmed invoices.
  const handleToggleInvoiceStatus = (index: number) => {
    const current = invoices[index];
    if (!current) return;
    const newStatus = current.invoiceStatus === 'confirmed' ? 'waiting' : 'confirmed';
    handleUpdateInvoice(index, { invoiceStatus: newStatus });
  };

  // Remove an invoice. The paidAmount is NOT recalculated from invoices —
  // it's an independent user-entered field.
  const handleRemoveInvoice = (index: number) => {
    dispatch({ type: 'REMOVE_INVOICE', index });
  };

  // Update an invoice field. The paidAmount is NOT recalculated from
  // invoices — it's an independent user-entered field.
  const handleUpdateInvoice = (index: number, patch: Partial<InvoiceEntry>) => {
    dispatch({ type: 'UPDATE_INVOICE', index, patch });
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

  const handleRemovePhoto = async () => {
    const photoUrl = form.reservationData.photo;
    if (!photoUrl) return;

    setForm((prev) => ({
      ...prev,
      reservationData: { ...prev.reservationData, photo: '' },
    }));

    // Delete from R2 storage
    deleteOldImage(photoUrl).catch((error: unknown) => {
      console.warn('Failed to delete customer photo from R2:', error);
    });
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

        // Auto-select only on an exact match (phone digits or email).
        // The backend already does prefix matching, so the results are
        // clean — no need for fuzzy similarity here.
        const bestMatch = users.find((u) => {
          const userPhoneDigits = u.phone ? extractDigits(u.phone) : '';
          const userEmail = u.email ? u.email.toLowerCase().trim() : '';
          const phoneExact = inputPhoneDigits.length > 0 && userPhoneDigits === inputPhoneDigits;
          const emailExact = inputEmail.length > 0 && userEmail === inputEmail;
          return phoneExact || emailExact;
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
    // Don't run user lookup when the modal is closed — the cached form
    // data may have phone/email from a previous session, but we don't
    // want to fire API calls or show toasts until the modal is actually
    // open and the admin is interacting with it.
    if (!isOpen) return;

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
  }, [isOpen, form.billingData.phone, form.billingData.email, form.source, lookupUser]);

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
      let invoiceUrls: { url: string; invoiceStatus: string; value: number; currency: string }[] = [];
      if (!isEasykash && invoices.length > 0) {
        dispatch({ type: 'SET_UPLOADING_INVOICE', uploading: true });
        try {
          const uploaded = await Promise.all(
            invoices.map(async (inv) => {
              const url = await uploadInvoiceToR2(inv.file);
              return {
                url,
                invoiceStatus: inv.invoiceStatus,
                value: parseFloat(inv.value) || 0,
                currency: inv.currency || 'EGP',
              };
            }),
          );
          invoiceUrls = uploaded;
        } catch (uploadError) {
          console.error('Invoice upload failed:', uploadError);
          throw new Error(
            t('createManualOrder.invoiceUploadFailed') ||
            'Failed to upload invoice file. Please check your connection and try again.',
          );
        } finally {
          dispatch({ type: 'SET_UPLOADING_INVOICE', uploading: false });
        }
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

      // Use an AbortController with a generous timeout. The backend route
      // does user creation, product lookups, order creation, and potentially
      // an EasyKash API call — all of which can take time. Without this,
      // the browser gives up silently and throws a "Failed to fetch" error.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 110_000); // 110s

      let res: Response;
      try {
        res = await fetch('/api/orders/create', {
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
            invoiceUrls: invoiceUrls.length > 0 ? invoiceUrls : undefined,
            locale: 'ar',
            userId: linkedUserId || undefined,
            paidAmount: paidAmountNum,
          }),
          signal: controller.signal,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Distinguish between our timeout and a genuine network error
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          throw new Error('TIMEOUT');
        }
        // Browser-level "Failed to fetch" — server crashed or unreachable
        throw new Error('NETWORK');
      }
      clearTimeout(timeoutId);

      // Parse the response body safely — the server may return non-JSON
      // (e.g. HTML error page from a proxy, or the connection may drop).
      let data: {
        success?: boolean;
        error?: string | { message?: string; details?: unknown };
        data?: {
          order: {
            orderNumber: string;
            totalAmount: number;
            fullAmount: number;
            paidAmount: number;
            remainingAmount: number;
            isPartialPayment: boolean;
            currency: string;
          };
          checkoutUrl: string | null;
          createdUser?: { email: string; password: string } | null;
        };
      };
      try {
        data = await res.json();
      } catch {
        if (!res.ok) {
          throw new Error(
            res.status === 502 || res.status === 504
              ? t('createManualOrder.serverTimeout') || 'Server is not responding. Please try again.'
              : t('createManualOrder.serverError') || `Server error (${res.status}). Please try again.`,
          );
        }
        throw new Error(t('createManualOrder.invalidResponse') || 'Received an invalid response from the server.');
      }

      if (!data.success) {
        // The backend returns errors in two formats:
        //   { error: "string message" }  — from direct NextResponse.json calls
        //   { error: { code, message, details } }  — from parseJsonBody/ApiError
        const rawError = data.error;
        let message: string;
        if (typeof rawError === 'string') {
          message = rawError;
        } else if (rawError && typeof rawError === 'object' && rawError.message) {
          message = rawError.message;
          // Zod validation errors include field-level details
          const details = (rawError as { details?: unknown }).details;
          if (typeof details === 'string' && details.trim()) {
            message = `${message}: ${details}`;
          }
        } else {
          message = t('createManualOrder.failed') || 'Failed to create order';
        }
        throw new Error(message);
      }

      if (!data.data?.order) {
        throw new Error(t('createManualOrder.invalidResponse') || 'Received an invalid response from the server.');
      }

      const { order, checkoutUrl, createdUser } = data.data as {
        order: { _id: string; orderNumber: string; totalAmount: number; fullAmount: number; paidAmount: number; remainingAmount: number; isPartialPayment: boolean; currency: string; status: string };
        checkoutUrl: string | null;
        createdUser?: { email: string; password: string } | null;
      };
      dispatch({
        type: 'SET_RESULT',
        result: {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          fullAmount: order.fullAmount,
          paidAmount: order.paidAmount,
          remainingAmount: order.remainingAmount,
          isPartialPayment: order.isPartialPayment,
          currency: order.currency,
          status: order.status,
          checkoutUrl,
          createdUser: createdUser || null,
        },
      });

      onSuccess();
    } catch (error) {
      // Map our sentinel error codes to user-friendly messages
      if (error instanceof Error) {
        if (error.message === 'TIMEOUT') {
          toast.error(
            t('createManualOrder.timeoutError') ||
            'The request is taking too long. The order may still be processing — please check the orders list before trying again.',
          );
        } else if (error.message === 'NETWORK') {
          toast.error(
            t('createManualOrder.networkError') ||
            'Network error — the server is not responding. Please check your connection and verify the order was not already created before trying again.',
          );
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error(t('createManualOrder.failed') || 'Failed to create order');
      }
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

  const [whatsappLoading, setWhatsappLoading] = useState(false);

  // Fetch the full order from the API and build the same WhatsApp
  // message used by the execution table's "Start Chat" button.
  const handleStartWhatsappChat = async () => {
    if (!result?._id) return;
    setWhatsappLoading(true);
    try {
      const res = await fetch(`/api/orders/${result._id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch order');
      }
      const fullOrder = data.data as Order;
      const message = buildOrderWhatsappMessageFromOrder(fullOrder);
      const whatsappPhone = normalizeWhatsappPhone(fullOrder.billingData?.phone);
      if (!whatsappPhone) {
        toast.error(t('copyWhatsapp.invalidPhone') || 'Invalid phone number');
        return;
      }
      const whatsappUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error starting WhatsApp chat:', error);
      toast.error(t('copyWhatsapp.failed') || 'Failed to start WhatsApp chat');
    } finally {
      setWhatsappLoading(false);
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
    // Don't reset the form — the data is cached in sessionStorage so
    // the admin can reopen the modal and continue where they left off.
    // The form is only reset after a successful order creation.
    // Revoke invoice preview URLs since the file objects won't be
    // valid after the modal closes.
    invoicesRef.current.forEach((inv) => {
      if (inv.previewUrl) URL.revokeObjectURL(inv.previewUrl);
    });
    dispatch({ type: 'RESET_UI' });
    // Reset the lookup ref so the user lookup fires again when the
    // modal reopens (restoring linkedUserId from the cached phone/email).
    lastLookupRef.current = { phone: '', email: '', source: '' };
    // Reset the pending invoice status
    pendingInvoiceStatusRef.current = null;
    setPendingInvoiceStatus(null);
    onClose();
  };

  const handleCloseAfterSuccess = () => {
    // After a successful order creation, reset everything and clear the cache
    resetForm();
    onClose();
  };

  if (result) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleCloseAfterSuccess}
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

          {form.billingData.phone && (
            <Button
              type="button"
              variant="custom"
              className="w-full bg-green-500! hover:bg-green-600! text-white flex items-center justify-center gap-2"
              onClick={handleStartWhatsappChat}
              disabled={whatsappLoading}
            >
              {whatsappLoading
                ? <LuRefreshCw size={18} className="animate-spin" />
                : <FaWhatsapp size={18} />}
              {t('createManualOrder.startWhatsappChat') || 'Start WhatsApp Chat'}
            </Button>
          )}

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

            {result.checkoutUrl && (
              <Button
                variant="primary"
                onClick={() => window.open(result.checkoutUrl!, '_blank')}
                className="flex-1"
              >
                <LuLink size={16} className="me-2" />
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
      contentClassName="flex flex-col gap-4 pr-1 px-4"
    >
      {/* Source */}
      <Dropdown
        value={form.source}
        options={sourceOptions}
        onChange={(val) => setForm((prev) => ({ ...prev, source: val }))}
        placeholder={t('createManualOrder.selectSource')}
      />

      {/* Referral */}
      <div className="flex flex-col gap-2">
        <div className="overflow-x-auto">
          <Tabs
            value={form.referralId}
            options={referralOptions}
            onChange={(val) => setForm((prev) => ({ ...prev, referralId: val ?? '' }))}
            size="md"
          />
        </div>
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
                    <div className="flex flex-row gap-2 sm:gap-3 items-center">
                      <div className="shrink-0 w-20 sm:w-28 self-stretch">
                        <QuantityInput
                          compact
                          value={item.quantity}
                          min={0}
                          onChange={(val) => updateItem(index, { quantity: val })}
                          error={formErrors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className={`flex-1 min-w-0 ${locale === 'ar' ? 'mr-2' : 'ml-2'}`}>
                        <Dropdown
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
                            if (val) dispatch({ type: 'ADD_RECENT_PRODUCT', productId: val });
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
                    </div>
                    {sizeOpts.length > 1 && (
                      <div className="mt-3">
                        <Dropdown
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
                      </div>
                    )}
                    <div className="flex flex-row gap-2 sm:gap-3 items-center mt-3">
                      <div className="flex-1 min-w-0">
                        <Input
                          ref={(el) => {
                            if (el) priceInputRefs.current.set(index, el);
                            else priceInputRefs.current.delete(index);
                          }}
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
                          tabIndex={priceEditIndices.includes(index) ? 0 : -1}
                          className={priceEditIndices.includes(index)
                            ? ''
                            : 'focus:ring-0 focus:border-stroke cursor-default'
                          }
                          suffix={
                            <button
                              type="button"
                              onClick={() => {
                                const willEdit = !priceEditIndices.includes(index);
                                dispatch({ type: 'TOGGLE_PRICE_EDIT', index });
                                if (willEdit) {
                                  setTimeout(() => priceInputRefs.current.get(index)?.focus(), 0);
                                }
                              }}
                              className={`transition-colors ${priceEditIndices.includes(index)
                                ? 'text-success hover:text-success/80'
                                : 'text-secondary hover:text-foreground'
                                }`}
                              aria-label={priceEditIndices.includes(index) ? 'Lock price' : 'Edit price'}
                            >
                              <LuPencil size={16} />
                            </button>
                          }
                        />
                      </div>
                      <div className="shrink-0 w-24 sm:w-28">
                        <CurrencySelector
                          value={form.currency}
                          onChange={handleCurrencyChange}
                        />
                      </div>
                    </div>
                    {customPriceBlurred.includes(index) && priceWarnings.find((w) => w.index === index) && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 -mt-1">
                        {priceWarnings.find((w) => w.index === index)?.message}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex flex-row gap-2 sm:gap-3 items-center">
                      <div className="shrink-0 w-20 sm:w-28 self-stretch">
                        <QuantityInput
                          compact
                          value={item.quantity}
                          min={0}
                          onChange={(val) => updateItem(index, { quantity: val })}
                          error={formErrors[`item_${index}_quantity`]}
                        />
                      </div>
                      <div className={`flex-1 min-w-0 ${locale === 'ar' ? 'mr-2' : 'ml-2'}`}>
                        <Input
                          value={item.customName}
                          placeholder={t('createManualOrder.customNamePlaceholder') || 'Product name'}
                          onChange={(e) =>
                            updateItem(index, { customName: e.target.value })
                          }
                          error={formErrors[`item_${index}_name`]}
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Input
                        value={item.customSize}
                        placeholder={t('createManualOrder.customSizePlaceholder') || 'Size (optional)'}
                        onChange={(e) =>
                          updateItem(index, { customSize: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-row gap-2 sm:gap-3 items-center mt-3">
                      <div className="flex-1 min-w-0">
                        <Input
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
                      </div>
                      <div className="shrink-0 w-24 sm:w-28">
                        <CurrencySelector
                          value={form.currency}
                          onChange={handleCurrencyChange}
                        />
                      </div>
                    </div>
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

      {/* Payment */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.payment')}
        </h4>
        <div className="flex flex-col gap-4">
          {/* Order total summary */}
          {fullOrderTotal > 0 && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary">
                  {t('createManualOrder.fullAmount') || 'Full Order Total'}
                </span>
                <span className="font-bold text-orange-500 dark:text-orange-400">
                  {fullOrderTotal.toFixed(2)} {form.currency}
                </span>
              </div>

              {/* Paid + Remaining side by side */}
              <div className="grid grid-cols-2 gap-3">
                {/* Paid — green */}
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    fullWidth={false}
                    value={form.paidAmount}
                    placeholder={fullOrderTotal > 0 ? `${t('createManualOrder.paid') || 'Paid'}: ${fullOrderTotal.toFixed(2)}` : '0.00'}
                    readOnly={paymentEditField === 'remaining'}
                    onChange={(e) => {
                      const paid = e.target.value;
                      const paidNum = parseFloat(paid);
                      const rem = Number.isFinite(paidNum) && paidNum >= 0
                        ? Math.max(0, fullOrderTotal - paidNum)
                        : 0;
                      setForm((prev) => ({
                        ...prev,
                        paidAmount: paid,
                        remainingAmount: rem > 0 ? rem.toFixed(2) : '',
                      }));
                      dispatch({ type: 'SET_PAYMENT_EDIT_FIELD', field: 'paid' });
                    }}
                    onFocus={() => {
                      // Swapping from remaining → paid: reset both fields
                      if (paymentEditField === 'remaining') {
                        setForm((prev) => ({ ...prev, paidAmount: '', remainingAmount: '' }));
                      }
                      dispatch({ type: 'SET_PAYMENT_EDIT_FIELD', field: 'paid' });
                    }}
                    className={`px-3 py-2 text-sm font-bold ${paymentEditField === 'remaining'
                      ? 'border-success/30 bg-success/5 text-success cursor-not-allowed'
                      : 'border-success/40 bg-success/5 text-success focus:ring-success/20 focus:border-success'
                      }`}
                  />
                  {formErrors.paidAmount && (
                    <span className="text-xs text-red-500">{formErrors.paidAmount}</span>
                  )}
                </div>
                {/* Remaining — red */}
                <div className="flex flex-col gap-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    fullWidth={false}
                    value={form.remainingAmount}
                    placeholder={fullOrderTotal > 0 ? `${t('createManualOrder.remaining') || 'Remaining'}: ${(fullOrderTotal - paidAmountNum).toFixed(2)}` : `0.00 ${form.currency}`}
                    readOnly={paymentEditField === 'paid'}
                    onChange={(e) => {
                      const rem = e.target.value;
                      const remNum = parseFloat(rem);
                      const paid = Number.isFinite(remNum) && remNum >= 0
                        ? Math.max(0, fullOrderTotal - remNum)
                        : 0;
                      setForm((prev) => ({
                        ...prev,
                        remainingAmount: rem,
                        paidAmount: paid > 0 ? paid.toFixed(2) : '',
                      }));
                      dispatch({ type: 'SET_PAYMENT_EDIT_FIELD', field: 'remaining' });
                    }}
                    onFocus={() => {
                      // Swapping from paid → remaining: reset both fields
                      if (paymentEditField === 'paid') {
                        setForm((prev) => ({ ...prev, paidAmount: '', remainingAmount: '' }));
                      }
                      dispatch({ type: 'SET_PAYMENT_EDIT_FIELD', field: 'remaining' });
                    }}
                    className={`px-3 py-2 text-sm font-bold ${paymentEditField === 'paid'
                      ? 'border-error/30 bg-error/5 text-error cursor-not-allowed'
                      : 'border-error/40 bg-error/5 text-error focus:ring-error/20 focus:border-error'
                      }`}
                  />
                  {formErrors.remainingAmount && (
                    <span className="text-xs text-red-500">{formErrors.remainingAmount}</span>
                  )}
                </div>
              </div>

              {isPartialPayment && (
                <p className="text-xs text-orange-600 dark:text-orange-400">
                  {t('createManualOrder.partialPaymentHint') || 'Order will be created as partial-paid. The remaining amount can be collected later via a payment link or another invoice.'}
                </p>
              )}
            </div>
          )}

          <Dropdown
            value={form.paymentMethod}
            options={paymentMethodOptions}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, paymentMethod: val }))
            }
            placeholder={t('createManualOrder.paymentMethod')}
            error={formErrors.paymentMethod}
          />

          {!isEasykash && (
            <div className="flex flex-col gap-3">
              {/* Upload buttons — two-step flow: first pick status, then pick file type */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
                {uploadingInvoice ? (
                  <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke text-secondary">
                    <LuRefreshCw size={16} className="animate-spin" />
                    {t('createManualOrder.uploadingInvoice') || 'Uploading...'}
                  </span>
                ) : pendingInvoiceStatus !== null ? (
                  <div className="flex flex-wrap items-center gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => invoiceImageInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-sm"
                    >
                      <LuImage size={16} />
                      {t('createManualOrder.uploadAsImage') || 'Image'}
                    </button>
                    <button
                      type="button"
                      onClick={() => invoiceInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-sm"
                    >
                      <LuFileText size={16} />
                      {t('createManualOrder.uploadAsFile') || 'File'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pendingInvoiceStatusRef.current = null;
                        setPendingInvoiceStatus(null);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-2 rounded-lg text-secondary hover:text-foreground transition-colors text-sm"
                    >
                      <LuX size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`flex-1 min-w-35 text-xs sm:text-sm ${formErrors.invoice ? 'border-error text-error hover:text-error hover:border-error' : ''}`}
                      onClick={() => {
                        pendingInvoiceStatusRef.current = 'confirmed';
                        setPendingInvoiceStatus('confirmed');
                      }}
                    >
                      <LuUpload size={14} className="me-1.5 shrink-0" />
                      {t('createManualOrder.uploadConfirmedInvoice') || 'Confirmed Invoice'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`flex-1 min-w-35 text-xs sm:text-sm ${formErrors.invoice ? 'border-error text-error hover:text-error hover:border-error' : ''}`}
                      onClick={() => {
                        pendingInvoiceStatusRef.current = 'waiting';
                        setPendingInvoiceStatus('waiting');
                      }}
                    >
                      <LuUpload size={14} className="me-1.5 shrink-0" />
                      {t('createManualOrder.uploadWaitingInvoice') || 'Waiting Invoice'}
                    </Button>
                  </>
                )}
              </div>

              {/* Hidden file inputs for invoice selection */}
              <input
                ref={invoiceInputRef}
                type="file"
                multiple
                accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={handleInvoiceFileChange}
              />
              <input
                ref={invoiceImageInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleInvoiceFileChange}
              />

              {/* Invoice list */}
              {invoices.length > 0 && (
                <div className="flex flex-col gap-3">
                  {invoices.map((invoice, index) => (
                    <div key={index} className="rounded-lg border border-stroke p-3 flex flex-col gap-2 bg-background">
                      {/* File info + remove */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleInvoiceStatus(index)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer ${invoice.invoiceStatus === 'confirmed' ? 'text-success bg-success/10 hover:bg-success/20' : 'text-warning bg-warning/10 hover:bg-warning/20'}`}
                          title={t('createManualOrder.toggleInvoiceStatus') || 'Click to toggle status'}
                        >
                          {invoice.invoiceStatus === 'confirmed'
                            ? (<><LuCheck size={10} /> {t('createManualOrder.uploadConfirmedInvoice') || 'Confirmed'}</>)
                            : (<><LuClock size={10} /> {t('createManualOrder.uploadWaitingInvoice') || 'Waiting'}</>)}
                        </button>
                        <span className="text-sm text-foreground truncate flex-1 min-w-0">{invoice.file.name}</span>
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          {invoice.value ? `${parseFloat(invoice.value).toFixed(2)} ${invoice.currency}` : '—'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvoice(index)}
                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-error hover:bg-error/10 transition-colors"
                          aria-label="Remove invoice"
                        >
                          <LuX size={16} />
                        </button>
                      </div>
                      {/* Preview */}
                      {invoice.previewUrl ? (
                        <div className="w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element -- previewUrl is a blob URL from File, not optimizable by next/image */}
                          <img
                            src={invoice.previewUrl}
                            alt="Invoice preview"
                            className="h-24 rounded-lg border border-stroke object-contain bg-background"
                          />
                        </div>
                      ) : (
                        <div className="w-fit h-24 px-4 flex items-center justify-center rounded-lg border border-stroke bg-background">
                          <LuFileText size={32} className="text-secondary" />
                        </div>
                      )}
                      {/* Value + currency (editable inline) */}
                      <div className="flex flex-row gap-2 items-start">
                        <div className="flex-1 min-w-0">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={invoice.value}
                            placeholder={t('createManualOrder.invoiceValue') || 'Invoice Value'}
                            onChange={(e) =>
                              handleUpdateInvoice(index, { value: e.target.value })
                            }
                            error={formErrors[`invoice_${index}_value`]}
                          />
                        </div>
                        <div className="shrink-0 w-28 pt-px">
                          <CurrencySelector
                            value={invoice.currency}
                            onChange={(val) =>
                              handleUpdateInvoice(index, { currency: val })
                            }
                          />
                        </div>
                      </div>
                      {/* Exchange rate display when invoice currency differs from order currency */}
                      <ExchangeRateDisplay
                        fromCurrency={invoice.currency}
                        toCurrency={form.currency || 'EGP'}
                        amount={parseFloat(invoice.value) || 0}
                        namespace="orders"
                      />
                    </div>
                  ))}
                </div>
              )}

              {formErrors.invoice && (
                <p className="text-xs text-error">{formErrors.invoice}</p>
              )}
            </div>
          )}

          {isEasykash && isPartialPayment && (
            <p className="text-xs text-secondary">
              {t('createManualOrder.easykashPartialHint') || 'An EasyKash payment link will be generated for the remaining amount. The paid portion will be recorded as a manual payment.'}
            </p>
          )}
        </div>
      </div>

      {/* Reservation Data */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.reservationData')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
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
            <Textarea
              value={form.reservationData.shortDuaa}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  reservationData: { ...prev.reservationData, shortDuaa: value },
                }))
              }
              placeholder={t('createManualOrder.shortDuaa')}
              rows={2}
              maxLength={250}
              showCount
            />
          </div>

          <div className="sm:col-span-2 mb-3">
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
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided URL with custom fallback handling */}
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

      {/* Customer Info */}
      <div className="border-t border-stroke pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">
            {t('createManualOrder.customerInfo')}
          </h4>
          {linkedUserId && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">
                <LuUserCheck size={12} />
                {t('createManualOrder.userLinked') || 'User linked'}
              </span>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'SET_LINKED_USER_ID', userId: null });
                  setForm((prev) => ({
                    ...prev,
                    billingData: { fullName: '', email: '', phone: '', country: '' },
                  }));
                  dispatch({ type: 'PATCH_FORM_ERRORS', errors: { fullName: '', phone: '', email: '', country: '' } });
                  toast.info(t('createManualOrder.userUnlinked') || 'User link removed');
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-error hover:text-error/80 bg-error/10 hover:bg-error/20 px-2 py-1 rounded-full transition-colors"
                aria-label={t('createManualOrder.removeSelection') || 'Remove selection'}
              >
                <LuX size={12} />
                {t('createManualOrder.removeSelection') || 'Remove'}
              </button>
            </div>
          )}
        </div>
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
            <div className="flex items-start gap-2">
              <Input
                placeholder={t('createManualOrder.phonePlaceholder')}
                value={form.billingData.phone}
                onChange={(e) => {
                  const newPhone = e.target.value;
                  setForm((prev) => {
                    // Auto-detect country from the full international phone
                    // number. Only set the country if it's currently empty
                    // or the detected country differs — this avoids
                    // overriding a manual selection with the same value.
                    const detectedCountry = detectCountryFromPhone(newPhone);
                    const currentCountry = prev.billingData.country;
                    const country =
                      detectedCountry && detectedCountry !== currentCountry
                        ? detectedCountry
                        : currentCountry;
                    return {
                      ...prev,
                      billingData: {
                        ...prev.billingData,
                        phone: newPhone,
                        country,
                      },
                    };
                  });
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
                className="w-full"
              />
              <div className="flex items-center gap-1 shrink-0 pt-1">
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
                  disabled={form.billingData.phone.replace(/\D/g, '').length === 0}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${phoneWhatsappClicked
                    ? 'border-success text-success bg-success/5'
                    : 'border-stroke text-success hover:bg-success/5 hover:border-success'
                    }`}
                  aria-label="Open WhatsApp chat"
                >
                  <FaWhatsapp size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const phone = form.billingData.phone;
                    if (!phone) return;
                    navigator.clipboard.writeText(phone);
                    toast.success(t('createManualOrder.phoneCopied') || 'Phone number copied');
                  }}
                  disabled={form.billingData.phone.replace(/\D/g, '').length === 0}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-stroke text-secondary hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Copy phone number"
                >
                  <LuCopy size={16} />
                </button>
              </div>
            </div>
            {!phoneWhatsappClicked && form.billingData.phone.replace(/\D/g, '').length > 0 && (
              <p className="text-xs text-secondary">
                {t('createManualOrder.whatsappClickHint') || 'Click the WhatsApp icon to validate the phone number'}
              </p>
            )}
            {focusedField === 'phone' && foundUsers.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-stroke bg-card-bg shadow-xl max-h-60 overflow-y-auto p-1">
                {foundUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectUser(user);
                    }}
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
            <div className="flex items-start gap-2">
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
                className="w-full"
              />
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
                disabled={!(!form.billingData.email.trim() && form.billingData.phone.trim())}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border border-stroke text-secondary hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-px"
                aria-label="Use phone as Gmail"
              >
                <LuAtSign size={16} />
              </button>
            </div>
            {focusedField === 'email' && foundUsers.length > 0 && (
              <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-stroke bg-card-bg shadow-xl max-h-60 overflow-y-auto p-1">
                {foundUsers.map((user) => (
                  <button
                    key={user._id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectUser(user);
                    }}
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
