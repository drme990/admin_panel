'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { uploadImageToR2, uploadInvoiceToR2 } from '../../../../lib/image-upload-utils';
import { LuCopy, LuCheck, LuRefreshCw, LuUpload, LuDownload, LuPlus, LuX, LuAtSign } from 'react-icons/lu';
import { FaWhatsapp } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { COUNTRIES } from '@/lib/countries';

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

type PaymentMethod = 'easykash' | 'insta_pay' | 'vodafone_cash';
type Source = 'manasik' | 'ghadaq';

interface OrderItemForm {
  productId: string;
  sizeIndex: number;
  quantity: number;
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
  productId: '',
  sizeIndex: 0,
  quantity: 0,
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
  paymentMethod: 'easykash',
  paidAmount: '',
};

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
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [useCustomExecutionDate, setUseCustomExecutionDate] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    orderNumber: string;
    totalAmount: number;
    fullAmount: number;
    paidAmount: number;
    remainingAmount: number;
    isPartialPayment: boolean;
    currency: string;
    checkoutUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [foundUsers, setFoundUsers] = useState<Array<{
    _id: string;
    name: string;
    email: string;
    phone: string;
    country: string;
    appId: string;
  }>>([]);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const lastLookupRef = useRef<{ phone: string; email: string }>({ phone: '', email: '' });

  const resetForm = useCallback(() => {
    const initialReferralId =
      user?.role !== 'super_admin' && user?.ref ? user.ref : '';
    setForm({ ...DEFAULT_FORM, referralId: initialReferralId });
    setInvoiceFile(null);
    setResult(null);
    setCopied(false);
    setUseCustomExecutionDate(false);
    setLinkedUserId(null);
    setFoundUsers([]);
    setFormErrors({});
    lastLookupRef.current = { phone: '', email: '' };
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      setLoadingProducts(true);
      fetch('/api/products?status=Active', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setProducts(data.data.products || []);
          }
        })
        .catch(() => {
          toast.error(t('createManualOrder.loadProductsFailed'));
        })
        .finally(() => setLoadingProducts(false));

      setLoadingReferrals(true);
      fetch('/api/referrals?limit=100', { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setReferrals(data.data.referrals || []);
          }
        })
        .catch(() => {
          toast.error(t('createManualOrder.loadReferralsFailed'));
        })
        .finally(() => setLoadingReferrals(false));
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
    setFormErrors({});
  }, [form]);

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
      { label: t('createManualPayment.easykash'), value: 'easykash' as PaymentMethod },
      { label: t('createManualPayment.instaPay'), value: 'insta_pay' as PaymentMethod },
      { label: t('createManualPayment.vodafoneCash'), value: 'vodafone_cash' as PaymentMethod },
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

  const isEasykash = form.paymentMethod === 'easykash';

  // Compute the full order total based on selected items + currency
  const fullOrderTotal = useMemo(() => {
    let total = 0;
    for (const item of form.items) {
      if (!item.productId || item.quantity <= 0) continue;
      const product = getProduct(item.productId);
      if (!product) continue;
      const size = product.sizes?.[item.sizeIndex];
      if (!size) continue;
      let unitPrice = size.price ?? 0;
      const currencyPrice = size.prices?.find(
        (p) => p.currencyCode === form.currency,
      );
      if (currencyPrice) unitPrice = currencyPrice.amount;
      total += unitPrice * item.quantity;
    }
    return total;
  }, [form.items, form.currency, getProduct]);

  const paidAmountNum = useMemo(() => {
    const n = parseFloat(form.paidAmount);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [form.paidAmount]);

  const isPartialPayment = paidAmountNum > 0 && paidAmountNum < fullOrderTotal;
  const remainingAmount = isPartialPayment
    ? Math.max(0, fullOrderTotal - paidAmountNum)
    : 0;

  const validateForm = useCallback((): Record<string, string> => {
    const errors: Record<string, string> = {};
    if (form.items.length === 0) {
      errors.items = t('createManualOrder.errors.itemsRequired');
    }
    form.items.forEach((item, index) => {
      if (!item.productId) {
        errors[`item_${index}_product`] = t('createManualOrder.errors.productRequired');
      }
      if (item.quantity <= 0) {
        errors[`item_${index}_quantity`] = t('createManualOrder.errors.quantityRequired');
      }
    });
    if (!form.currency) {
      errors.currency = t('createManualOrder.errors.currencyRequired');
    }
    if (!form.billingData.fullName.trim()) {
      errors.fullName = t('createManualOrder.errors.fullNameRequired');
    }
    if (!form.billingData.email.trim()) {
      errors.email = t('createManualOrder.errors.emailRequired');
    }
    if (!form.billingData.phone.trim()) {
      errors.phone = t('createManualOrder.errors.phoneRequired');
    } else if (!validatePhoneNumber(form.billingData.phone, form.billingData.country)) {
      errors.phone = t('createManualOrder.errors.phoneInvalid') || 'Invalid phone number';
    }
    if (!form.billingData.country.trim()) {
      errors.country = t('createManualOrder.errors.countryRequired');
    }
    if (!isEasykash && !invoiceFile) {
      errors.invoice = t('createManualOrder.errors.invoiceRequired');
    }
    if (isPartialPayment && paidAmountNum <= 0) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountRequired');
    }
    if (isPartialPayment && paidAmountNum >= fullOrderTotal) {
      errors.paidAmount = t('createManualOrder.errors.paidAmountInvalid');
    }
    return errors;
  }, [form, isEasykash, invoiceFile, isPartialPayment, paidAmountNum, fullOrderTotal, t]);

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

    setInvoiceFile(file);
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
      setUploadingPhoto(true);
      const url = await uploadImageToR2(file);
      setForm((prev) => ({
        ...prev,
        reservationData: { ...prev.reservationData, photo: url },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('editOrder.uploadFailed');
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const lookupUser = useCallback(async (phone: string, email: string) => {
    if (!phone && !email) return;
    if (lastLookupRef.current.phone === phone && lastLookupRef.current.email === email) return;

    lastLookupRef.current = { phone, email };
    try {
      const params = new URLSearchParams();
      if (phone) params.set('phone', phone);
      if (email) params.set('email', email);
      const res = await fetch(`/api/orders/lookup-user?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setFoundUsers(data.data);
      } else {
        setFoundUsers([]);
      }
    } catch {
      toast.error(t('createManualOrder.userLookupFailed') || 'Failed to lookup user');
      setFoundUsers([]);
    }
  }, [t]);

  const selectUser = (user: {
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
      phone: user.phone.trim(),
      email: user.email.trim(),
    };
    setLinkedUserId(user._id);
    setFoundUsers([]);
    setFormErrors((prev) => ({ ...prev, phone: '', email: '' }));
    toast.success(t('createManualOrder.userSelected') || 'User selected');
  };

  useEffect(() => {
    const phone = form.billingData.phone.trim();
    const email = form.billingData.email.trim();

    if (!phone && !email) {
      setLinkedUserId(null);
      setFoundUsers([]);
      lastLookupRef.current = { phone: '', email: '' };
      return;
    }

    if (lastLookupRef.current.phone === phone && lastLookupRef.current.email === email) {
      return;
    }

    setFoundUsers([]);
    const timer = setTimeout(() => {
      lookupUser(phone, email);
    }, 800);

    return () => clearTimeout(timer);
  }, [form.billingData.phone, form.billingData.email, lookupUser]);

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error(t('createManualOrder.errors.fixForm') || 'Please fix the errors above');
      return;
    }
    setFormErrors({});
    setCreating(true);
    try {
      let invoiceUrl = '';
      if (!isEasykash && invoiceFile) {
        setUploadingInvoice(true);
        invoiceUrl = await uploadInvoiceToR2(invoiceFile);
        setUploadingInvoice(false);
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
          items: form.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            sizeIndex: item.sizeIndex,
          })),
          currency: form.currency,
          referralId: form.referralId || undefined,
          billingData: form.billingData,
          reservationData,
          paymentMethod: form.paymentMethod,
          invoiceUrl: invoiceUrl || undefined,
          locale: 'ar',
          userId: linkedUserId || undefined,
          paidAmount: isPartialPayment ? paidAmountNum : undefined,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      setResult({
        orderNumber: data.data.order.orderNumber,
        totalAmount: data.data.order.totalAmount,
        fullAmount: data.data.order.fullAmount,
        paidAmount: data.data.order.paidAmount,
        remainingAmount: data.data.order.remainingAmount,
        isPartialPayment: data.data.order.isPartialPayment,
        currency: data.data.order.currency,
        checkoutUrl: data.data.checkoutUrl,
      });

      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('createManualOrder.failed');
      toast.error(message);
    } finally {
      setCreating(false);
      setUploadingInvoice(false);
    }
  };

  const handleCopyLink = async () => {
    if (!result?.checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(result.checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg border border-stroke bg-background/50 items-end"
              >
                <div className="sm:col-span-4">
                  <Dropdown
                    label={index === 0 ? t('createManualOrder.product') : undefined}
                    value={item.productId}
                    options={productOptions}
                    onChange={(val) => updateItem(index, { productId: val, sizeIndex: 0 })}
                    placeholder={t('createManualOrder.selectProduct')}
                    disabled={loadingProducts}
                    error={formErrors[`item_${index}_product`]}
                  />
                </div>
                <div className="sm:col-span-3">
                  {sizeOpts.length > 0 && (
                    <Dropdown
                      label={index === 0 ? t('createManualOrder.size') : undefined}
                      value={item.sizeIndex}
                      options={sizeOpts}
                      onChange={(val) => updateItem(index, { sizeIndex: val })}
                    />
                  )}
                </div>
                <div className="sm:col-span-3">
                  <QuantityInput
                    label={index === 0 ? t('createManualOrder.quantity') : undefined}
                    value={item.quantity}
                    min={0}
                    onChange={(val) => updateItem(index, { quantity: val })}
                    error={formErrors[`item_${index}_quantity`]}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end pb-1">
                  <Button
                    variant="ghost"
                    size="custom"
                    className="h-8 w-8 p-0 text-secondary hover:text-error"
                    onClick={() => removeItem(index)}
                    disabled={form.items.length === 1}
                    aria-label={t('createManualOrder.removeItem')}
                  >
                    <LuX size={16} />
                  </Button>
                </div>
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

      {/* Global Currency */}
      <div className="border-t border-stroke pt-4">
        <Dropdown
          label={t('createManualOrder.currency')}
          value={form.currency}
          options={currencyOptions}
          onChange={(val) => setForm((prev) => ({ ...prev, currency: val }))}
          placeholder={t('createManualOrder.selectCurrency')}
          error={formErrors.currency}
        />
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
          <Input
            placeholder={t('createManualOrder.phonePlaceholder')}
            value={form.billingData.phone}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, phone: e.target.value },
              }));
              setLinkedUserId(null);
              setFormErrors((prev) => ({ ...prev, phone: '' }));
            }}
            onBlur={() => {
              const phone = form.billingData.phone.trim();
              if (!phone) {
                setFormErrors((prev) => ({
                  ...prev,
                  phone: t('createManualOrder.errors.phoneRequired'),
                }));
              } else if (!validatePhoneNumber(form.billingData.phone, form.billingData.country)) {
                setFormErrors((prev) => ({
                  ...prev,
                  phone: t('createManualOrder.errors.phoneInvalid') || 'Invalid phone number',
                }));
              }
            }}
            error={formErrors.phone}
            suffix={
              form.billingData.phone.replace(/\D/g, '').length > 0 ? (
                <a
                  href={`https://wa.me/${form.billingData.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-success hover:text-foreground transition-colors"
                  aria-label="Open WhatsApp chat"
                >
                  <FaWhatsapp size={18} />
                </a>
              ) : null
            }
          />
          <Input
            placeholder={t('createManualOrder.emailPlaceholder')}
            type="email"
            value={form.billingData.email}
            onChange={(e) => {
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, email: e.target.value },
              }));
              setLinkedUserId(null);
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
                        email: `${prev.billingData.phone.trim()}@gmail.com`,
                      },
                    }));
                    setLinkedUserId(null);
                    setFoundUsers([]);
                  }}
                  className="text-secondary hover:text-foreground transition-colors"
                  aria-label="Use phone as Gmail"
                >
                  <LuAtSign size={16} />
                </button>
              ) : null
            }
          />
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

        {foundUsers.length > 0 && (
          <div className="mt-4 rounded-lg border border-stroke bg-background p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">
                {t('createManualOrder.foundUsers')}
              </span>
              <button
                type="button"
                onClick={() => setFoundUsers([])}
                className="text-xs text-secondary hover:text-foreground transition-colors"
              >
                <LuX size={14} />
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {foundUsers.map((user) => (
                <div
                  key={user._id}
                  className={cn(
                    'flex items-center justify-between rounded-md border p-2 transition-colors',
                    linkedUserId === user._id
                      ? 'border-success bg-success/5'
                      : 'border-stroke bg-background hover:border-success/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">
                      {user.name || '-'}
                    </div>
                    <div className="text-xs text-secondary truncate">
                      {user.email || '-'}
                    </div>
                    <div className="text-xs text-secondary truncate">
                      {user.phone || '-'}
                    </div>
                    {user.country && (
                      <div className="text-xs text-secondary truncate">
                        {user.country}
                      </div>
                    )}
                  </div>
                  <Button
                    variant={linkedUserId === user._id ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => selectUser(user)}
                    className="ml-2 shrink-0"
                  >
                    {linkedUserId === user._id
                      ? t('createManualOrder.userSelected') || 'Selected'
                      : t('createManualOrder.selectUser') || 'Select'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
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
                setUseCustomExecutionDate(checked);
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
            label={t('createManualOrder.paymentMethod')}
            value={form.paymentMethod}
            options={paymentMethodOptions}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, paymentMethod: val }))
            }
          />

          {!isEasykash && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                {t('createManualOrder.invoiceUpload')}
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="custom"
                  className={`px-3 py-2 ${formErrors.invoice ? 'border-error text-error hover:text-error hover:border-error' : ''}`}
                  onClick={() => invoiceInputRef.current?.click()}
                  disabled={uploadingInvoice}
                >
                  {uploadingInvoice ? (
                    <LuRefreshCw size={16} className="animate-spin me-2" />
                  ) : (
                    <LuUpload size={16} className="me-2" />
                  )}
                  {invoiceFile ? t('createManualOrder.changeInvoice') : t('createManualOrder.uploadInvoice')}
                </Button>
                {invoiceFile && (
                  <span className="text-sm text-secondary">{invoiceFile.name}</span>
                )}
              </div>
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
    </Modal>
  );
}
