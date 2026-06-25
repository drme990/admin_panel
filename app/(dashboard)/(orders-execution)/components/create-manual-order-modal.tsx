'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/components/providers/auth-provider';
import { Referral } from '@/types/Referral';
import { toast } from 'react-toastify';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import Tabs from '@/components/ui/tabs';
import Switch from '@/components/ui/switch';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { uploadImageToR2, uploadInvoiceToR2 } from '../../../../lib/image-upload-utils';
import { LuCopy, LuCheck, LuRefreshCw, LuUpload, LuDownload, LuPlus, LuX, LuSearch, LuUserCheck } from 'react-icons/lu';

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
  const [result, setResult] = useState<{
    orderNumber: string;
    totalAmount: number;
    currency: string;
    checkoutUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [lookingUpUser, setLookingUpUser] = useState(false);
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const resetForm = useCallback(() => {
    const initialReferralId =
      user?.role !== 'super_admin' && user?.ref ? user.ref : '';
    setForm({ ...DEFAULT_FORM, referralId: initialReferralId });
    setInvoiceFile(null);
    setResult(null);
    setCopied(false);
    setUseCustomExecutionDate(false);
    setLinkedUserId(null);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      resetForm();
      setLoadingProducts(true);
      fetch('/api/products', { cache: 'no-store' })
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

  const canSubmit = useMemo(() => {
    if (form.items.length === 0) return false;
    for (const item of form.items) {
      if (!item.productId) return false;
      if (item.quantity <= 0) return false;
    }
    if (!form.currency) return false;
    if (!form.billingData.fullName.trim()) return false;
    if (!form.billingData.email.trim()) return false;
    if (!form.billingData.phone.trim()) return false;
    if (!form.billingData.country.trim()) return false;
    if (!isEasykash && !invoiceFile) return false;
    return true;
  }, [form, isEasykash, invoiceFile]);

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

  const handleLookupUser = async () => {
    const phone = form.billingData.phone.trim();
    if (!phone) return;

    setLookingUpUser(true);
    try {
      const res = await fetch(`/api//orders/lookup-user?phone=${encodeURIComponent(phone)}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data) {
        const user = data.data;
        setForm((prev) => ({
          ...prev,
          billingData: {
            fullName: user.name || prev.billingData.fullName,
            email: user.email || prev.billingData.email,
            phone: user.phone || prev.billingData.phone,
            country: user.country || prev.billingData.country,
          },
        }));
        setLinkedUserId(user._id);
        toast.success(t('createManualOrder.userFound') || 'User found — data auto-filled');
      } else {
        setLinkedUserId(null);
        toast.info(t('createManualOrder.userNotFound') || 'No registered user found with this phone');
      }
    } catch {
      toast.error(t('createManualOrder.userLookupFailed') || 'Failed to lookup user');
    } finally {
      setLookingUpUser(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

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

      const res = await fetch('/api/admin/orders/create', {
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
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to create order');
      }

      setResult({
        orderNumber: data.data.order.orderNumber,
        totalAmount: data.data.order.totalAmount,
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
              {result.totalAmount.toFixed(2)} {result.currency}
            </p>
          </div>

          {result.checkoutUrl ? (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                {t('createManualOrder.paymentLink')}
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
                {t('createManualOrder.paidOrderSuccess')}
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
                  <Input
                    label={index === 0 ? t('createManualOrder.quantity') : undefined}
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(index, { quantity: Math.max(0, parseInt(e.target.value) || 0) })
                    }
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
        />
      </div>

      {/* Customer Info */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.customerInfo')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('createManualOrder.fullName')}
            value={form.billingData.fullName}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, fullName: e.target.value },
              }))
            }
            required
          />
          <Input
            label={t('createManualOrder.email')}
            type="email"
            value={form.billingData.email}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, email: e.target.value },
              }))
            }
            required
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t('createManualOrder.phone')}
                value={form.billingData.phone}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    billingData: { ...prev.billingData, phone: e.target.value },
                  }));
                  setLinkedUserId(null);
                }}
                required
              />
            </div>
            <Button
              variant="outline"
              size="custom"
              className="px-3 py-2.5 mb-0.5"
              onClick={handleLookupUser}
              disabled={lookingUpUser || !form.billingData.phone.trim()}
            >
              {lookingUpUser ? (
                <LuRefreshCw size={16} className="animate-spin" />
              ) : linkedUserId ? (
                <LuUserCheck size={16} className="text-success" />
              ) : (
                <LuSearch size={16} />
              )}
              <span className="ms-1 text-sm">
                {linkedUserId
                  ? t('createManualOrder.userLinked') || 'Linked'
                  : t('createManualOrder.findUser') || 'Find User'}
              </span>
            </Button>
          </div>
          <Input
            label={t('createManualOrder.country')}
            value={form.billingData.country}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                billingData: { ...prev.billingData, country: e.target.value },
              }))
            }
            required
          />
        </div>
      </div>

      {/* Reservation Data */}
      <div className="border-t border-stroke pt-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          {t('createManualOrder.reservationData')}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('createManualOrder.sacrificeFor')}
            value={form.reservationData.sacrificeFor}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                reservationData: { ...prev.reservationData, sacrificeFor: e.target.value },
              }))
            }
          />
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
          <Dropdown
            label={t('createManualOrder.gender')}
            value={form.reservationData.gender}
            options={genderOptions}
            onChange={(val) =>
              setForm((prev) => ({
                ...prev,
                reservationData: { ...prev.reservationData, gender: val },
              }))
            }
            placeholder={t('createManualOrder.selectGender')}
          />
          <Dropdown
            label={t('createManualOrder.isAlive')}
            value={form.reservationData.isAlive}
            options={isAliveOptions}
            onChange={(val) =>
              setForm((prev) => ({
                ...prev,
                reservationData: { ...prev.reservationData, isAlive: val },
              }))
            }
            placeholder={t('createManualOrder.selectStatus')}
          />
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
                  className="px-3 py-2"
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
              <input
                ref={invoiceInputRef}
                type="file"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={handleInvoiceFileChange}
              />
            </div>
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
          disabled={creating || !canSubmit}
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
