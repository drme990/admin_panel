'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { LuUpload, LuImage, LuFileText, LuX, LuCheck, LuClock } from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Dropdown from '@/components/ui/dropdown';
import { MANUAL_PAYMENT_METHODS } from '@/lib/order';
import ExchangeRateDisplay from '@/components/order/exchange-rate-display';
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
  /** Currency options for the dropdown */
  currencyOptions: Array<{ label: string; value: string }>;
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
  currencyOptions,
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

  // ── Paid/remaining state (same logic as create-manual-order-modal) ──
  const [paidAmount, setPaidAmount] = useState('');
  const [remainingAmount, setRemainingAmount] = useState('');
  const [paymentEditField, setPaymentEditField] = useState<'paid' | 'remaining' | null>(null);

  // ── Payment method ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');

  // ── Errors ──
  const [error, setError] = useState<string | null>(null);
  const [methodError, setMethodError] = useState<string | null>(null);

  // ── Refs ──
  const invoiceInputRef = useRef<HTMLInputElement | null>(null);
  const invoiceImageInputRef = useRef<HTMLInputElement | null>(null);

  // The remaining unpaid amount on the order
  const orderRemaining = Math.max(0, orderTotal - alreadyPaid);
  const orderCur = (orderCurrency || defaultCurrency).toUpperCase();
  const invoiceCur = invoiceCurrency.toUpperCase();

  // Initialize paid amount to the full remaining order value when the
  // modal opens. Paid = remaining order value, remaining = 0.
  useEffect(() => {
    if (isOpen) {
      if (orderRemaining > 0) {
        setPaidAmount(orderRemaining.toFixed(2));
        setRemainingAmount('');
        setPaymentEditField('paid');
      } else {
        setPaidAmount('');
        setRemainingAmount('');
        setPaymentEditField(null);
      }
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

  // ── Paid/remaining handlers (same as create-manual-order-modal) ──
  const handlePaidChange = (val: string) => {
    const paidNum = parseFloat(val);
    const rem = Number.isFinite(paidNum) && paidNum >= 0
      ? Math.max(0, orderRemaining - paidNum)
      : 0;
    setPaidAmount(val);
    setRemainingAmount(rem > 0 ? rem.toFixed(2) : '');
    setPaymentEditField('paid');
    setError(null);
  };

  const handleRemainingChange = (val: string) => {
    const remNum = parseFloat(val);
    const paid = Number.isFinite(remNum) && remNum >= 0
      ? Math.max(0, orderRemaining - remNum)
      : 0;
    setRemainingAmount(val);
    setPaidAmount(paid > 0 ? paid.toFixed(2) : '');
    setPaymentEditField('remaining');
    setError(null);
  };

  const handlePaidFocus = () => {
    if (paymentEditField === 'remaining') {
      setPaidAmount('');
      setRemainingAmount('');
    }
    setPaymentEditField('paid');
  };

  const handleRemainingFocus = () => {
    if (paymentEditField === 'paid') {
      setPaidAmount('');
      setRemainingAmount('');
    }
    setPaymentEditField('remaining');
  };

  // ── Confirm handler ──
  const handleConfirm = () => {
    setError(null);
    setMethodError(null);

    if (!file) {
      setError(t('errors.invoiceRequired') || 'Please select a file');
      return;
    }

    const numPaid = parseFloat(paidAmount);
    if (!paidAmount.trim() || !Number.isFinite(numPaid)) {
      setError(t('errors.invoiceValueRequired') || 'Paid amount is required');
      return;
    }
    if (numPaid <= 0) {
      setError(t('errors.invoiceValueInvalid') || 'Paid amount must be greater than 0');
      return;
    }

    // NOTE: The paid amount is allowed to exceed the order's remaining
    // balance — invoices may include fees, taxes, or tips.

    if (!paymentMethod) {
      setMethodError(t('errors.paymentMethodRequired') || 'Payment method is required');
      return;
    }

    onConfirm({
      file,
      invoiceStatus: status,
      value: paidAmount,
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
    >
      <div className="flex flex-col gap-4">
        {/* ── Order total + remaining summary ── */}
        <div className="flex items-center justify-between rounded-lg border border-stroke bg-muted/30 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs text-secondary">
              {t('orderTotal') || 'Order Total'}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {orderTotal.toFixed(2)} {orderCur}
            </span>
          </div>
          <div className="flex flex-col text-end">
            <span className="text-xs text-secondary">
              {t('remaining') || 'Remaining'}
            </span>
            <span className="text-sm font-semibold text-error">
              {orderRemaining.toFixed(2)} {orderCur}
            </span>
          </div>
        </div>

        {/* ── Paid + Remaining inputs (same as create-manual-order-modal) ── */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              {t('paid') || 'Paid'}
            </label>
            <span className="text-xs text-secondary">
              {t('remaining') || 'Remaining'}: {orderRemaining.toFixed(2)} {orderCur}
            </span>
          </div>
          <div className="flex gap-2">
            {/* Paid — green */}
            <div className="flex-1 flex flex-col gap-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={paidAmount}
                placeholder={orderRemaining > 0 ? `${orderRemaining.toFixed(2)}` : '0.00'}
                readOnly={paymentEditField === 'remaining'}
                onChange={(e) => handlePaidChange(e.target.value)}
                onFocus={handlePaidFocus}
                className={`px-3 py-2 text-sm font-bold ${paymentEditField === 'remaining'
                  ? 'border-success/30 bg-success/5 text-success cursor-not-allowed'
                  : 'border-success/40 bg-success/5 text-success focus:ring-success/20 focus:border-success'
                  }`}
              />
            </div>
            {/* Remaining — red */}
            <div className="flex-1 flex flex-col gap-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={remainingAmount}
                placeholder="0.00"
                readOnly={paymentEditField === 'paid'}
                onChange={(e) => handleRemainingChange(e.target.value)}
                onFocus={handleRemainingFocus}
                className={`px-3 py-2 text-sm font-bold ${paymentEditField === 'paid'
                  ? 'border-error/30 bg-error/5 text-error cursor-not-allowed'
                  : 'border-error/40 bg-error/5 text-error focus:ring-error/20 focus:border-error'
                  }`}
              />
            </div>
          </div>
          <p className="text-xs text-secondary">
            {t('paidAmountHint') || 'This amount will be added to the order\'s total paid amount.'}
          </p>
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
            {/* Two-step upload buttons (same as create-manual-order-modal) */}
            <div className="flex flex-wrap items-center gap-3">
              {pendingInvoiceStatus !== null ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => invoiceImageInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-sm"
                  >
                    <LuImage size={16} />
                    {t('uploadAsImage') || 'Image'}
                  </button>
                  <button
                    type="button"
                    onClick={() => invoiceInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-sm"
                  >
                    <LuFileText size={16} />
                    {t('uploadAsFile') || 'File'}
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
                    className={error ? 'border-error text-error hover:text-error hover:border-error' : ''}
                    onClick={() => {
                      pendingInvoiceStatusRef.current = 'confirmed';
                      setPendingInvoiceStatus('confirmed');
                    }}
                  >
                    <LuUpload size={16} className="me-2" />
                    {t('uploadConfirmedInvoice') || 'Confirmed Invoice'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={error ? 'border-error text-error hover:text-error hover:border-error' : ''}
                    onClick={() => {
                      pendingInvoiceStatusRef.current = 'waiting';
                      setPendingInvoiceStatus('waiting');
                    }}
                  >
                    <LuUpload size={16} className="me-2" />
                    {t('uploadWaitingInvoice') || 'Waiting Invoice'}
                  </Button>
                </>
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
            {/* Invoice value + currency (editable inline) */}
            <div className="flex flex-row gap-2 items-start">
              <div className="flex-1 min-w-0">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={invoiceValue}
                  placeholder={t('invoiceValue') || 'Invoice Value'}
                  onChange={(e) => {
                    setInvoiceValue(e.target.value);
                    // Sync paid amount with invoice value
                    handlePaidChange(e.target.value);
                  }}
                  error={error || undefined}
                />
              </div>
              <div className="shrink-0 w-24 pt-px">
                <Dropdown
                  value={invoiceCurrency}
                  options={currencyOptions}
                  onChange={(val) => setInvoiceCurrency(val)}
                />
              </div>
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
