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
    label: { ar: 'حي', en: 'Is Alive' },
    options: [
      { ar: 'حي', en: 'Alive' },
      { ar: 'متوفي', en: 'dead' },
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

    return [
      {
        key: preset.key,
        type: preset.type,
        label: preset.label,
        options: preset.options,
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
