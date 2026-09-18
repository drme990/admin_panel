export type ReservationFieldKey =
  | 'intention'
  | 'sacrificeFor'
  | 'gender'
  | 'isAlive'
  | 'shortDuaa'
  | 'photo'
  | 'executionDate';

export type ReservationFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'picture';

export interface ReservationFieldOption {
  ar: string;
  en: string;
}

export interface ReservationField {
  key: ReservationFieldKey;
  type: ReservationFieldType;
  label: { ar: string; en: string };
  required: boolean;
  maxLength?: number;
  options?: ReservationFieldOption[];
  supportsMulti?: boolean;
}

export interface ReservationFieldPreset {
  key: ReservationFieldKey;
  type: ReservationFieldType;
  label: { ar: string; en: string };
  options?: ReservationFieldOption[];
  supportsMulti?: boolean;
}

export const RESERVATION_FIELD_PRESETS: ReservationFieldPreset[] = [
  {
    key: 'intention',
    type: 'select',
    label: { ar: 'النية', en: 'Intention' },
    options: [
      { ar: 'عقيقة', en: 'Aqeeqah' },
      { ar: 'أُضحيــَــة', en: 'Sacrifice' },
      { ar: 'صدقة', en: 'Charity' },
      { ar: 'نذر', en: 'Vow (Nadhr)' },
      { ar: 'فدو', en: 'Protective Sacrifice' },
    ],
  },
  {
    key: 'sacrificeFor',
    type: 'text',
    label: {
      ar: 'اسم الشخص المؤدى عنه',
      en: 'The person on whose behalf',
    },
  },
  {
    key: 'gender',
    type: 'radio',
    label: { ar: 'الجنس', en: 'Gender' },
    options: [
      { ar: 'ذكر', en: 'male' },
      { ar: 'انثى', en: 'female' },
      { ar: 'ذكور و اناث', en: 'Males and females' },
    ],
  },
  {
    key: 'isAlive',
    type: 'radio',
    label: { ar: 'الحالة', en: 'Status' },
    options: [
      { ar: 'حي', en: 'Alive' },
      { ar: 'متوفي', en: 'Dead' },
      { ar: 'احياء و متوفين', en: 'Alive and dead' },
    ],
  },
  {
    key: 'shortDuaa',
    type: 'textarea',
    label: { ar: 'دعاء مختصر', en: 'Short Duaa' },
  },
  {
    key: 'photo',
    type: 'picture',
    label: { ar: 'صورة', en: 'Photo' },
  },
  {
    key: 'executionDate',
    type: 'date',
    label: {
      ar: 'تاريخ التنفيذ (بدون تحديد = يتم التنفيذ في اليوم التالي تلقائيا)',
      en: 'Execution Date (Leave blank to schedule automatically for the next day).',
    },
  },
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getReservationPreset(key: ReservationFieldKey) {
  return RESERVATION_FIELD_PRESETS.find((field) => field.key === key);
}

export function normalizeReservationFields(input: unknown): ReservationField[] {
  const fields = Array.isArray(input) ? input : [];

  return RESERVATION_FIELD_PRESETS.flatMap((preset) => {
    const matched = fields.find((field) => {
      if (!field || typeof field !== 'object') return false;
      const typedField = field as {
        key?: unknown;
        label?: { ar?: unknown; en?: unknown };
      };

      if (typedField.key === preset.key) return true;

      const ar =
        typeof typedField.label?.ar === 'string'
          ? normalizeText(typedField.label.ar)
          : '';
      const en =
        typeof typedField.label?.en === 'string'
          ? normalizeText(typedField.label.en)
          : '';

      return (
        normalizeText(preset.label.ar) === ar ||
        normalizeText(preset.label.en) === en
      );
    }) as ReservationField | undefined;

    if (!matched) return [];

    // Preserve custom options from the matched field if available
    const customOptions = (matched as { options?: ReservationFieldOption[] }).options;

    return [
      {
        key: preset.key,
        type: preset.type,
        label: preset.label,
        options: customOptions ?? preset.options,
        required: Boolean(matched.required),
        maxLength:
          preset.type === 'text' || preset.type === 'textarea'
            ? matched.maxLength
            : undefined,
        supportsMulti: Boolean(matched.supportsMulti),
      },
    ];
  });
}

/* ────────────────────────────────────────────────────────────────────
 * Manual-order helpers — shared by the create-manual-order and
 * create-sub-order modals. They mirror the storefront checkout: the
 * modal renders exactly the reservation fields the selected product(s)
 * accept, with the same option restrictions and value semantics.
 * ────────────────────────────────────────────────────────────────── */

export interface ReservationFieldProductLike {
  workAsSacrifice?: boolean;
  reservationFields?: Array<{
    key: string;
    type: string;
    label: { ar: string; en: string };
    required?: boolean;
    options?: ReservationFieldOption[];
    maxLength?: number;
    supportsMulti?: boolean;
  }>;
}

export interface MergedReservationField {
  key: string;
  type: string;
  label: { ar: string; en: string };
  required: boolean;
  options: ReservationFieldOption[];
  maxLength?: number;
  supportsMulti: boolean;
  /** True when عقيقة must be hidden from an `intention` field — the
   * field's source product is not configured as a sacrifice. */
  hideAqeeqah: boolean;
}

export function isExecutionDateKey(key: string): boolean {
  return key === 'executionDate';
}

function normalizeIntentionValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ً-ْ]/g, '')
    .replace(/\s+/g, ' ');
}

export function isAqeeqahIntentionValue(value: string): boolean {
  if (!value.trim()) return false;
  const normalized = normalizeIntentionValue(value);
  const aqeeqahMarkers = ['aqeeqah', 'aqiqah', 'aqeqa', 'akeekah', 'عقيقة'];
  return aqeeqahMarkers.some((marker) => normalized.includes(marker));
}

/**
 * Merge the reservation field configs of all selected products into a
 * single display list — the union of fields any selected product
 * accepts, deduplicated by key.
 *
 * Merge rules:
 * - Field order follows the canonical preset order (same as checkout).
 * - The first product contributing a key wins for type/label/options/
 *   maxLength/supportsMulti (main-product precedence).
 * - `required` is the OR across contributing products (the backend
 *   requires the union too).
 * - عقيقة options are hidden on `intention` when the field's source
 *   product is not a sacrifice product (checkout's
 *   `hideAqeeqahIntentionOptions`).
 */
export function mergeProductReservationFields(
  products: ReservationFieldProductLike[],
): MergedReservationField[] {
  const byKey = new Map<string, MergedReservationField>();

  for (const product of products) {
    for (const field of product.reservationFields ?? []) {
      const existing = byKey.get(field.key);
      if (existing) {
        if (field.required) existing.required = true;
        continue;
      }

      byKey.set(field.key, {
        key: field.key,
        type: field.type,
        label: field.label,
        required: Boolean(field.required),
        options: field.options ?? [],
        maxLength: field.maxLength,
        supportsMulti: Boolean(field.supportsMulti),
        hideAqeeqah:
          field.key === 'intention' ? !product.workAsSacrifice : false,
      });
    }
  }

  const orderIndex = new Map(
    RESERVATION_FIELD_PRESETS.map((preset, index) => [preset.key, index]),
  );

  return [...byKey.values()].sort((a, b) => {
    const ao = orderIndex.get(a.key as ReservationFieldKey) ?? Number.MAX_SAFE_INTEGER;
    const bo = orderIndex.get(b.key as ReservationFieldKey) ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });
}

/**
 * Options visible for a select/radio field — filters عقيقة out of
 * `intention` fields on non-sacrifice products (checkout parity).
 */
export function getVisibleFieldOptions(
  field: MergedReservationField,
): ReservationFieldOption[] {
  if (field.key !== 'intention' || !field.hideAqeeqah) {
    return field.options;
  }
  return field.options.filter(
    (opt) => !isAqeeqahIntentionValue(`${opt.en} ${opt.ar}`),
  );
}

/**
 * Parse a stored picture value — either the checkout-style JSON array
 * of URLs or a legacy single-URL string.
 */
export function parsePictureUrls(value: string): string[] {
  const trimmed = (value || '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
    }
  } catch {
    // Not JSON — treat as a single URL (legacy format).
  }
  return [trimmed];
}

/** Serialize picture URLs in the same JSON-array format checkout stores. */
export function serializePictureUrls(urls: string[]): string {
  const clean = urls.filter(Boolean);
  return clean.length > 0 ? JSON.stringify(clean) : '';
}

export function toIsoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
