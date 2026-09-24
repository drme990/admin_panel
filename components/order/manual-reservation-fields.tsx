'use client';

import { useRef } from 'react';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import Input from '@/components/ui/input';
import MultiNameInput from '@/components/ui/multi-name-input';
import RadioButton from '@/components/ui/radio-button';
import Textarea from '@/components/ui/textarea';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import { LuRefreshCw, LuUpload, LuX } from 'react-icons/lu';
import {
  getVisibleFieldOptions,
  isExecutionDateKey,
  parsePictureUrls,
  toIsoLocalDate,
  type MergedReservationField,
} from '@/lib/reservation-fields';

const MAX_PICTURE_IMAGES = 4;

interface ManualReservationFieldsProps {
  /** Merged reservation fields for the currently selected products
   * (already ordered; `executionDate` entries are skipped here — the
   * manual flow handles it via the custom-date switch). */
  fields: MergedReservationField[];
  values: Record<string, string>;
  errors: Record<string, string | undefined>;
  locale: string;
  t: (key: string, values?: Record<string, string | number>) => string;
  uploadingField: string | null;
  blockedExecutionDates?: string[];
  onValueChange: (key: string, value: string) => void;
  onUploadPictures: (key: string, files: File[]) => void;
  onRemovePicture: (key: string, url: string) => void;
  /** Extra content rendered under a specific field (e.g. warnings). */
  fieldFooters?: Partial<Record<string, React.ReactNode>>;
}

function PictureFieldInput({
  value,
  uploading,
  t,
  onUpload,
  onRemove,
}: {
  value: string;
  uploading: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
  onUpload: (files: File[]) => void;
  onRemove: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const urls = parsePictureUrls(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        {urls.length < MAX_PICTURE_IMAGES && (
          <Button
            variant="outline"
            size="custom"
            className="px-3 py-2"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <LuRefreshCw size={16} className="animate-spin me-2" />
            ) : (
              <LuUpload size={16} className="me-2" />
            )}
            {urls.length > 0
              ? t('createManualOrder.addPhoto') || 'Add Photo'
              : t('createManualOrder.uploadPhoto') || 'Upload Photo'}
          </Button>
        )}
      </div>

      {urls.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {urls.map((url) => (
            <div
              key={url}
              className="relative w-24 h-24 rounded-lg overflow-hidden border border-stroke shrink-0 group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic user-provided URL */}
              <img
                src={url}
                alt="Reservation"
                className="w-full h-full object-cover"
              />
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors"
                title={t('createManualOrder.viewPhoto') || 'View Photo'}
              />
              <button
                type="button"
                onClick={() => onRemove(url)}
                className="absolute top-1 inset-e-1 inline-flex items-center justify-center w-6 h-6 rounded-md bg-black/60 text-white hover:bg-error transition-colors"
                title={t('createManualOrder.removePhoto') || 'Remove Photo'}
              >
                <LuX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onUpload(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function ManualReservationFields({
  fields,
  values,
  errors,
  locale,
  t,
  uploadingField,
  blockedExecutionDates,
  onValueChange,
  onUploadPictures,
  onRemovePicture,
  fieldFooters,
}: ManualReservationFieldsProps) {
  const isRTL = locale === 'ar';

  // executionDate is rendered separately (custom-date switch) in the
  // manual flow — the backend always resolves one for every order.
  const displayFields = fields.filter((f) => !isExecutionDateKey(f.key));
  const requiredFields = displayFields.filter((f) => f.required);
  const optionalFields = displayFields.filter((f) => !f.required);

  const renderInput = (field: MergedReservationField) => {
    const value = values[field.key] || '';

    if (field.type === 'select') {
      const options = getVisibleFieldOptions(field).map((opt) => ({
        label: isRTL ? opt.ar || opt.en : opt.en || opt.ar,
        value: opt.ar || opt.en,
      }));
      return (
        <Dropdown
          value={value}
          options={options}
          onChange={(val) => onValueChange(field.key, val)}
          placeholder="-"
        />
      );
    }

    if (field.type === 'radio') {
      const options = getVisibleFieldOptions(field);
      return (
        <div className="flex flex-wrap gap-4">
          {options.map((opt, oi) => {
            const optionValue = opt.ar || opt.en;
            const optionLabel = isRTL ? opt.ar || opt.en : opt.en || opt.ar;
            return (
              <RadioButton
                key={`${field.key}-${oi}`}
                id={`${field.key}-${oi}`}
                name={`reservation_${field.key}`}
                value={optionValue}
                label={optionLabel}
                checked={value === optionValue}
                onChange={(val) => onValueChange(field.key, val)}
              />
            );
          })}
        </div>
      );
    }

    if (field.type === 'text' && field.supportsMulti) {
      return (
        <MultiNameInput
          value={value}
          onChange={(val) => onValueChange(field.key, val)}
          placeholder={
            isRTL ? 'أدخل اسمًا ثم اضغط +' : 'Enter a name then press +'
          }
          maxLength={field.maxLength}
          isRTL={isRTL}
        />
      );
    }

    if (field.type === 'textarea') {
      return (
        <Textarea
          value={value}
          onChange={(val) => onValueChange(field.key, val)}
          placeholder={isRTL ? field.label.ar : field.label.en}
          rows={2}
          maxLength={field.maxLength}
          showCount={Boolean(field.maxLength)}
        />
      );
    }

    if (field.type === 'picture') {
      return (
        <PictureFieldInput
          value={value}
          uploading={uploadingField === field.key}
          t={t}
          onUpload={(files) => onUploadPictures(field.key, files)}
          onRemove={(url) => onRemovePicture(field.key, url)}
        />
      );
    }

    if (field.type === 'date') {
      const isExecutionField = isExecutionDateKey(field.key);
      const minDate = isExecutionField
        ? (() => {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return toIsoLocalDate(tomorrow);
        })()
        : undefined;
      return (
        <CustomDatePicker
          value={value}
          onChange={(val) => onValueChange(field.key, val)}
          locale={locale}
          placeholder={isRTL ? field.label.ar : field.label.en}
          minDate={minDate}
          disabledDates={isExecutionField ? blockedExecutionDates : undefined}
        />
      );
    }

    return (
      <Input
        type={field.type}
        value={value}
        onChange={(e) => onValueChange(field.key, e.target.value)}
        maxLength={field.type === 'text' ? field.maxLength : undefined}
      />
    );
  };

  const renderField = (field: MergedReservationField) => {
    const label = isRTL ? field.label.ar : field.label.en;
    const error = errors[`reservation_${field.key}`];
    const wide = field.type === 'textarea' || field.type === 'picture';

    return (
      <div
        key={field.key}
        data-error-key={`reservation_${field.key}`}
        className={wide ? 'sm:col-span-2' : ''}
      >
        <label className="text-xs font-medium text-secondary mb-1.5 block">
          {label}
          {field.required ? (
            <span className="text-error ms-0.5">*</span>
          ) : (
            <span className="text-secondary text-xs ms-1">
              ({t('createManualOrder.optional') || 'Optional'})
            </span>
          )}
        </label>
        {renderInput(field)}
        {error && <p className="text-xs text-error mt-1">{error}</p>}
        {fieldFooters?.[field.key]}
        {(field.type === 'text' || field.type === 'textarea') &&
          field.maxLength && (
            <p className="text-xs text-secondary mt-1">
              {t('createManualOrder.reservationMaxChars', {
                max: field.maxLength,
              })}
            </p>
          )}
      </div>
    );
  };

  if (displayFields.length === 0) {
    return (
      <p className="text-sm text-secondary">
        {t('createManualOrder.noReservationFields') ||
          'The selected product has no reservation data fields.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {requiredFields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {requiredFields.map(renderField)}
        </div>
      )}

      {optionalFields.length > 0 && (
        <div className="pt-2 border-t border-stroke/70">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {optionalFields.map(renderField)}
          </div>
        </div>
      )}
    </div>
  );
}
