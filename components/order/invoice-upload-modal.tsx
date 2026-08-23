'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LuUpload, LuImage, LuFileText, LuX, LuCheck, LuClock } from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { MANUAL_PAYMENT_METHODS } from '@/lib/order';
import { useExchangeRate } from '@/lib/order/use-exchange-rate';
import ExchangeRateDisplay from '@/components/order/exchange-rate-display';
import CurrencySelector from '@/components/shared/currency-selector';
import type { PaymentMethod } from '@/types/Order';

export type InvoiceStatus = 'confirmed' | 'waiting';

export interface InvoiceUploadResult {
  file: File;
  invoiceStatus: InvoiceStatus;
  /** Paid amount (the invoice value = how much the customer paid) */
  value: string;
  currency: string;
  previewUrl: string | null;
  paymentMethod: PaymentMethod;
}

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: InvoiceUploadResult) => void;
  /** Order full total (the full price, not the paid portion) */
  orderTotal: number;
  /** How much is already paid on this order (to compute remaining) */
  alreadyPaid?: number;
  /** Default currency */
  defaultCurrency: string;
  /** The order's own currency — used to show exchange rate when invoice currency differs */
  orderCurrency?: string;
  /** Translation namespace ('orders' or 'execution') */
  namespace?: 'orders' | 'execution';
}

const ALL_ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function InvoiceUploadModal({
  isOpen,
  onClose,
  onConfirm,
  orderTotal,
  alreadyPaid = 0,
  defaultCurrency,
  orderCurrency,
  namespace = 'orders',
}: InvoiceUploadModalProps) {
  const t = useTranslations(`${namespace}.createManualOrder`);
  const tPay = useTranslations(`${namespace}.createManualPayment`);
  const tEdit = useTranslations('orders.editOrder');

  // ── Invoice file state ──
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>('confirmed');
  const [invoiceValue, setInvoiceValue] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState(defaultCurrency);

  // ── Two-step upload flow state (same as create-manual-order-modal) ──
  const [pendingInvoiceStatus, setPendingInvoiceStatus] = useState<'confirmed' | 'waiting' | null>(null);
  const pendingInvoiceStatusRef = useRef<'confirmed' | 'waiting' | null>(null);

  // ── Payment method ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

  // ── Errors ──
  const [error, setError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);

  // ── Payment tolerance — fetched from booking settings by payment method ──
  const [allTolerances, setAllTolerances] = useState<Record<string, { type: 'percentage' | 'fixnumber'; value: number }>>({});
  const [allowRate, setAllowRate] = useState<{ type: 'percentage' | 'fixnumber'; value: number } | null>(null);

  // Fetch all tolerances once when modal opens
  useEffect(() => {
    if (!isOpen) {
      setAllTolerances({});
      setAllowRate(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/booking');
        const data = await res.json();
        if (cancelled || !data.success) return;
        const tolerances = data.data?.paymentMethodTolerances ?? {};
        setAllTolerances(tolerances);
      } catch {
        // Non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Update the active tolerance when the selected payment method changes
  useEffect(() => {
    if (!paymentMethod || !allTolerances[paymentMethod]) {
      setAllowRate(null);
      return;
    }
    const t = allTolerances[paymentMethod];
    if (t && t.value > 0) {
      setAllowRate(t);
    } else {
      setAllowRate(null);
    }
  }, [paymentMethod, allTolerances]);

  // ── Refs ──
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceImageInputRef = useRef<HTMLInputElement | null>(null);

  // The remaining unpaid amount on the order (read-only display only)
  const orderRemaining = Math.max(0, orderTotal - alreadyPaid);
  const orderCur = (orderCurrency || defaultCurrency).toUpperCase();
  const invoiceCur = invoiceCurrency.toUpperCase();

  // Exchange rate: convert invoice value → order currency for remaining calc
  const typedInvoiceValue = parseFloat(invoiceValue) || 0;
  const { convertedAmount: invoiceValueInOrderCurrency } = useExchangeRate(
    invoiceCur,
    orderCur,
    typedInvoiceValue,
  );
  // The invoice value expressed in the order's currency (for remaining calc + tolerance)
  const invoiceValueInOrderCur = invoiceCur === orderCur
    ? typedInvoiceValue
    : (invoiceValueInOrderCurrency ?? 0);

  // Reset invoice state when the modal opens. The paid/remaining amounts
  // are now read-only informational displays — the invoice value entered
  // by the user is the actual payment amount.
  useEffect(() => {
    if (isOpen) {
      // Reset invoice state
      setFile(null);
      setPreviewUrl(null);
      setStatus('confirmed');
      setInvoiceValue('');
      setInvoiceCurrency(defaultCurrency);
      setPaymentMethod('');
      setError(null);
      setMethodError(null);
      pendingInvoiceStatusRef.current = null;
      setPendingInvoiceStatus(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── File selection handler (same as create-manual-order-modal) ──
  const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const invoiceStatus = pendingInvoiceStatusRef.current ?? 'waiting';

    if (!ALL_ALLOWED_TYPES.includes(selected.type)) {
      setError(tEdit('invalidInvoice') || 'Invalid file type');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(tEdit('invoiceTooLarge') || 'File size exceeds 10MB limit');
      return;
    }

    // Revoke previous preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const newPreviewUrl = selected.type.startsWith('image/')
      ? URL.createObjectURL(selected)
      : null;

    setFile(selected);
    setPreviewUrl(newPreviewUrl);
    setStatus(invoiceStatus);
    setError(null);

    // Reset pending status
    pendingInvoiceStatusRef.current = null;
    setPendingInvoiceStatus(null);

    // Reset input so the same file can be selected again
    if (invoiceInputRef.current) invoiceInputRef.current.value = '';
    if (invoiceImageInputRef.current) invoiceImageInputRef.current.value = '';
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setInvoiceValue('');
    setError(null);
  };

  const handleToggleStatus = () => {
    setStatus((prev) => (prev === 'confirmed' ? 'waiting' : 'confirmed'));
  };

  // ── Confirm handler ──
  // The invoice value entered by the user is the actual payment amount.
  // The paid/remaining displays above are informational only.
  const handleConfirm = () => {
    setError(null);
    setMethodError(null);

    if (!file) {
      setError(t('errors.invoiceRequired') || 'Please select a file');
      return;
    }

    const numValue = parseFloat(invoiceValue);
    if (!invoiceValue.trim() || !Number.isFinite(numValue)) {
      setError(t('errors.invoiceValueRequired') || 'Invoice value is required');
      return;
    }
    if (numValue <= 0) {
      setError(t('errors.invoiceValueInvalid') || 'Invoice value must be greater than 0');
      return;
    }

    // NOTE: The invoice value is allowed to differ from the order's
    // remaining balance — the allowRate tolerance on the country
    // determines whether the order is marked as paid.

    if (!paymentMethod) {
      setMethodError(t('errors.paymentMethodRequired') || 'Payment method is required');
      return;
    }

    onConfirm({
      file,
      invoiceStatus: status,
      value: invoiceValue,
      currency: invoiceCurrency,
      previewUrl,
      paymentMethod: paymentMethod as PaymentMethod,
    });
  };

  const handleClose = () => {
    // Don't revoke the preview URL here — it's passed to the parent
    // component which takes ownership.
    onClose();
  };

  const paymentMethodOptions = useMemo(
    () => [
      { label: tPay('selectPaymentMethod') || 'Select payment method', value: '' as PaymentMethod | '' },
      ...MANUAL_PAYMENT_METHODS.map((method) => {
        const keyMap = {
          easykash: 'easykash',
          insta_pay: 'instaPay',
          vodafone_cash: 'vodafoneCash',
          bank_transfer: 'bankTransfer',
          paypal: 'paypal',
          binance: 'binance',
        } as const;
        return {
          label: tPay(keyMap[method as keyof typeof keyMap]),
          value: method as PaymentMethod | '',
        };
      }),
    ],
    [tPay],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('uploadInvoiceModalTitle') || 'Upload Invoice'}
      size="md"
      footer={
        <div className='flex gap-2'>
          <Button className='flex-1' variant="ghost" onClick={handleClose}>
            {t('cancel') || 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={!file}
            className='flex-1'
          >
            <LuCheck size={16} className="me-2" />
            {t('addInvoice') || 'Add Invoice'}
          </Button>
        </div>
      }
      contentClassName="overflow-visible"
       className="overflow-visible"
    >
      <div className="flex flex-col gap-4">
        {/* ── Order total (title + value only, no remaining) ── */}
        <div className="flex items-center justify-between rounded-lg border border-stroke bg-muted/30 px-4 py-3">
          <span className="text-xs text-secondary">
            {t('orderTotal') || 'Order Total'}
          </span>
          <span className="text-sm font-semibold text-foreground">
            {orderTotal.toFixed(2)} {orderCur}
          </span>
        </div>

        {/* ── Already paid + remaining (read-only, informational only) ── */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-lg border border-success/30 bg-success/5 px-3 py-2">
            <span className="text-xs text-success/80">
              {t('paid') || 'Paid'}
            </span>
            <span className="text-sm font-bold text-success">
              {alreadyPaid.toFixed(2)} {orderCur}
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg border border-error/30 bg-error/5 px-3 py-2">
            <span className="text-xs text-error/80">
              {t('remaining') || 'Remaining'}
            </span>
            <span className="text-sm font-bold text-error">
              {orderRemaining.toFixed(2)} {orderCur}
            </span>
          </div>
        </div>

        {/* ── Payment method selector ── */}
        <Dropdown
          value={paymentMethod}
          options={paymentMethodOptions}
          onChange={(val) => {
            setPaymentMethod(val as PaymentMethod | '');
            setMethodError(null);
          }}
          placeholder={t('paymentMethod') || 'Payment Method'}
          error={methodError || undefined}
        />

        {/* ── Invoice upload area ── */}
        {!file ? (
          <div className="flex flex-col gap-3">
            {/* Two-step upload buttons — always kept next to each other
                and shrink to stay visible on small screens. */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {pendingInvoiceStatus !== null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => invoiceImageInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    <LuImage size={14} className="shrink-0" />
                    {t('uploadAsImage') || 'Image'}
                  </button>
                  <button
                    type="button"
                    onClick={() => invoiceInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-xs sm:text-sm whitespace-nowrap"
                  >
                    <LuFileText size={14} className="shrink-0" />
                    {t('uploadAsFile') || 'File'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      pendingInvoiceStatusRef.current = null;
                      setPendingInvoiceStatus(null);
                    }}
                    className="inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-secondary hover:text-foreground transition-colors text-xs sm:text-sm"
                  >
                    <LuX size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`flex-1 min-w-35 text-xs sm:text-sm ${error ? 'border-error text-error hover:text-error hover:border-error' : ''}`}
                    onClick={() => {
                      pendingInvoiceStatusRef.current = 'confirmed';
                      setPendingInvoiceStatus('confirmed');
                    }}
                  >
                    <LuUpload size={14} className="me-1.5 shrink-0" />
                    {t('uploadConfirmedInvoice') || 'Confirmed Invoice'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`flex-1 min-w-35 text-xs sm:text-sm ${error ? 'border-error text-error hover:text-error hover:border-error' : ''}`}
                    onClick={() => {
                      pendingInvoiceStatusRef.current = 'waiting';
                      setPendingInvoiceStatus('waiting');
                    }}
                  >
                    <LuUpload size={14} className="me-1.5 shrink-0" />
                    {t('uploadWaitingInvoice') || 'Waiting Invoice'}
                  </Button>
                </div>
              )}
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
          </div>
        ) : (
          /* ── Invoice card (same style as create-manual-order-modal) ── */
          <div className="rounded-lg border border-stroke p-3 flex flex-col gap-2 bg-background">
            {/* File info + status badge + remove */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleStatus}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full transition-colors cursor-pointer ${status === 'confirmed' ? 'text-success bg-success/10 hover:bg-success/20' : 'text-warning bg-warning/10 hover:bg-warning/20'}`}
                title={t('toggleInvoiceStatus') || 'Click to toggle status'}
              >
                {status === 'confirmed'
                  ? (<><LuCheck size={10} /> {t('uploadConfirmedInvoice') || 'Confirmed'}</>)
                  : (<><LuClock size={10} /> {t('uploadWaitingInvoice') || 'Waiting'}</>)}
              </button>
              <span className="text-sm text-foreground truncate flex-1 min-w-0">{file.name}</span>
              <span className="text-sm font-semibold text-foreground shrink-0">
                {invoiceValue ? `${parseFloat(invoiceValue).toFixed(2)} ${invoiceCurrency}` : '—'}
              </span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-error hover:bg-error/10 transition-colors"
                aria-label="Remove invoice"
              >
                <LuX size={16} />
              </button>
            </div>
            {/* Preview or file icon placeholder */}
            {previewUrl ? (
              <div className="w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
                <img
                  src={previewUrl}
                  alt="Invoice preview"
                  className="h-24 rounded-lg border border-stroke object-contain bg-background"
                />
              </div>
            ) : (
              <div className="w-fit h-24 px-4 flex items-center justify-center rounded-lg border border-stroke bg-background">
                <LuFileText size={32} className="text-secondary" />
              </div>
            )}
            {/* Invoice value + currency — this is the actual payment amount */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-secondary">
                {t('invoiceValue') || 'Invoice Value'}
              </label>
              <div className="flex flex-row gap-2 items-start">
                <div className="flex-1 min-w-0">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={invoiceValue}
                    placeholder={t('invoiceValuePlaceholder') || 'Enter the invoice amount'}
                    onChange={(e) => {
                      setInvoiceValue(e.target.value);
                      setError(null);
                    }}
                    error={error || undefined}
                  />
                </div>
                <div className="shrink-0 w-28 pt-px">
                  <CurrencySelector
                    value={invoiceCurrency}
                    onChange={(val) => setInvoiceCurrency(val)}
                  />
                </div>
              </div>
              <p className="text-xs text-secondary">
                {t('invoicePaymentHint') || 'This amount will be recorded as the payment for this order.'}
              </p>

              {/* ── Remaining after this invoice (auto-calculated) ── */}
              {orderRemaining > 0 && (() => {
                // Use the invoice value converted to the order's currency
                const remainingAfter = Math.max(0, orderRemaining - invoiceValueInOrderCur);
                const hasTolerance = allowRate && allowRate.value > 0;
                // Tolerance is in the order's currency (EGP), so it applies directly
                const toleranceAmount = hasTolerance
                  ? allowRate!.type === 'percentage'
                    ? orderRemaining * allowRate!.value / 100
                    : allowRate!.value
                  : 0;
                const remainingWithTolerance = Math.max(0, remainingAfter - toleranceAmount);
                const isCleanExact = remainingAfter <= 0.001;
                const isCleanWithTolerance = hasTolerance && remainingAfter > 0.001 && remainingWithTolerance <= 0.001;
                const hasRemaining = remainingAfter > 0.001 && !isCleanWithTolerance;
                // Show a loading state while exchange rate is being fetched (different currencies only)
                const isConverting = invoiceCur !== orderCur && typedInvoiceValue > 0 && invoiceValueInOrderCur === 0;

                // Don't show anything if user hasn't typed a value yet
                if (typedInvoiceValue <= 0 && !isConverting) return null;

                if (isConverting) {
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary">
                      <span>...</span>
                    </div>
                  );
                }

                // Case 1: Remaining > 0 — show red X with remaining amount
                if (hasRemaining) {
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-error">
                      <LuX size={14} className="shrink-0" />
                      <span>
                        {t('remainingAfterInvoice') || 'Remaining after this invoice'}: {remainingAfter.toFixed(2)} {orderCur}
                      </span>
                    </div>
                  );
                }

                // Case 2: Clean without tolerance — green check
                if (isCleanExact) {
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                      <LuCheck size={14} className="shrink-0" />
                      <span className="font-medium">
                        {t('allClean') || 'All clean — fully paid'}
                      </span>
                    </div>
                  );
                }

                // Case 3: Clean with tolerance — green check + tolerance badge
                if (isCleanWithTolerance) {
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                      <LuCheck size={14} className="shrink-0" />
                      <span className="font-medium">
                        {t('allClean') || 'All clean — fully paid'}
                      </span>
                      <span className="rounded-full bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                        {allowRate!.type === 'percentage'
                          ? `${allowRate!.value}% ${t('toleranceApplied') || 'tolerance'}`
                          : `${allowRate!.value.toFixed(2)} ${orderCur} ${t('toleranceApplied') || 'tolerance'}`}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
            {/* Exchange rate display */}
            <ExchangeRateDisplay
              fromCurrency={invoiceCur}
              toCurrency={orderCur}
              amount={parseFloat(invoiceValue) || 0}
              namespace={namespace}
            />
          </div>
        )}

        {/* Hidden file inputs (same as create-manual-order-modal) */}
        <input
          ref={invoiceInputRef}
          type="file"
          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="hidden"
          onChange={handleInvoiceFileChange}
        />
        <input
          ref={invoiceImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInvoiceFileChange}
        />
      </div>
    </Modal>
  );
}
