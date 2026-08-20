'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LuUpload, LuImage, LuFileText, LuX, LuCheck, LuClock } from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';

export type InvoiceStatus = 'confirmed' | 'waiting';

export interface InvoiceUploadResult {
  file: File;
  invoiceStatus: InvoiceStatus;
  value: string;
  currency: string;
  previewUrl: string | null;
}

interface InvoiceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: InvoiceUploadResult) => void;
  /** Order total for showing the remaining amount hint */
  orderTotal: number;
  /** Currency options for the dropdown */
  currencyOptions: Array<{ label: string; value: string }>;
  /** Default currency */
  defaultCurrency: string;
  /** Translation namespace ('orders' or 'execution') */
  namespace?: 'orders' | 'execution';
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_FILE_TYPES];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function InvoiceUploadModal({
  isOpen,
  onClose,
  onConfirm,
  orderTotal,
  currencyOptions,
  defaultCurrency,
  namespace = 'orders',
}: InvoiceUploadModalProps) {
  const t = useTranslations(`${namespace}.createManualOrder`);
  // Use orders.editOrder for error messages since execution.editOrder
  // is just a string label, not an object with error keys.
  const tEdit = useTranslations('orders.editOrder');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus>('confirmed');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup preview URL on unmount. The parent remounts this component
  // with a fresh key each time the modal opens, so state resets naturally
  // without needing a setState-in-effect pattern.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);

    if (!ALL_ALLOWED_TYPES.includes(selectedFile.type)) {
      setError(tEdit('invalidInvoice') || 'Invalid file type');
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(tEdit('invoiceTooLarge') || 'File size exceeds 10MB limit');
      return;
    }

    // Revoke previous preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selectedFile);
    const newPreviewUrl = selectedFile.type.startsWith('image/')
      ? URL.createObjectURL(selectedFile)
      : null;
    setPreviewUrl(newPreviewUrl);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFileSelect(selected);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleRemoveFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  };

  const handleConfirm = () => {
    if (!file) {
      setError(t('errors.invoiceRequired') || 'Please select a file');
      return;
    }

    const numValue = parseFloat(value);
    if (!value.trim() || !Number.isFinite(numValue)) {
      setError(t('errors.invoiceValueRequired') || 'Invoice value is required');
      return;
    }
    if (numValue <= 0) {
      setError(t('errors.invoiceValueInvalid') || 'Invoice value must be greater than 0');
      return;
    }

    onConfirm({
      file,
      invoiceStatus: status,
      value,
      currency,
      previewUrl,
    });
  };

  const handleClose = () => {
    // Don't revoke the preview URL here — it's passed to the parent
    // component which takes ownership. The parent will revoke it when
    // the invoice is removed or the modal is closed.
    onClose();
  };

  const remainingHint = orderTotal > 0 && value.trim()
    ? parseFloat(value) > 0
      ? `${t('remaining') || 'Remaining'}: ${Math.max(0, orderTotal - parseFloat(value)).toFixed(2)} ${currency}`
      : null
    : null;

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
        {/* File upload area */}
        {!file ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer ${dragOver
              ? 'border-primary bg-primary/5'
              : 'border-stroke hover:border-primary/50 hover:bg-muted/30'
              }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex items-center gap-2 text-secondary">
              <LuUpload size={28} />
            </div>
            <p className="text-sm text-center text-secondary">
              {t('dropFileHere') || 'Click to browse or drag and drop a file here'}
            </p>
            <p className="text-xs text-center text-secondary/70">
              {t('fileTypesHint') || 'Images (JPG, PNG, WebP, GIF) or documents (PDF, DOC, DOCX, TXT) — max 10MB'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  imageInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-xs"
              >
                <LuImage size={14} />
                {t('uploadAsImage') || 'Image'}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-xs"
              >
                <LuFileText size={14} />
                {t('uploadAsFile') || 'File'}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-stroke p-4 flex flex-col gap-3 bg-background">
            {/* File info + remove */}
            <div className="flex items-center gap-2">
              {file.type.startsWith('image/') ? (
                <LuImage size={18} className="text-secondary shrink-0" />
              ) : (
                <LuFileText size={18} className="text-secondary shrink-0" />
              )}
              <span className="text-sm text-foreground truncate flex-1 min-w-0">{file.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-error hover:bg-error/10 transition-colors"
                aria-label="Remove file"
              >
                <LuX size={16} />
              </button>
            </div>
            {/* Preview */}
            {previewUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL preview */}
                <img
                  src={previewUrl}
                  alt="Invoice preview"
                  className="max-h-48 rounded-lg border border-stroke object-contain bg-background"
                />
              </div>
            )}
            {/* Change file button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-stroke hover:border-primary hover:text-primary transition-colors text-xs self-center"
            >
              <LuUpload size={14} />
              {t('changeInvoice') || 'Change File'}
            </button>
          </div>
        )}

        {/* Status selection */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">
            {t('invoiceStatus') || 'Invoice Status'}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus('confirmed')}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium ${status === 'confirmed'
                ? 'border-success text-success bg-success/10'
                : 'border-stroke text-secondary hover:border-success/50 hover:text-success/70'
                }`}
            >
              <LuCheck size={16} />
              {t('uploadConfirmedInvoice') || 'Confirmed'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('waiting')}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium ${status === 'waiting'
                ? 'border-warning text-warning bg-warning/10'
                : 'border-stroke text-secondary hover:border-warning/50 hover:text-warning/70'
                }`}
            >
              <LuClock size={16} />
              {t('uploadWaitingInvoice') || 'Waiting'}
            </button>
          </div>
        </div>

        {/* Value + currency */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">
            {t('invoiceValue') || 'Invoice Value'}
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                placeholder={t('invoiceValuePlaceholder') || 'Enter the invoice amount'}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                error={error || undefined}
                className="w-full"
              />
            </div>
            <div className="shrink-0 w-28">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-10.5 px-3 rounded-lg border border-stroke bg-background text-sm text-foreground"
              >
                {currencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {remainingHint && (
            <p className="text-xs text-secondary">{remainingHint}</p>
          )}
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALL_ALLOWED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileInputChange}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    </Modal>
  );
}
