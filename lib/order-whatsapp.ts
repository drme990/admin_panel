import { ReservationFieldKey } from '@/lib/reservation-fields';
import type {
  BillingData,
  Order,
  OrderItem,
  ReservationOrderField,
} from '@/types/Order';

export interface OrderWhatsappData {
  orderNumber: string;
  currency: string;
  remainingAmount?: number;
  items: OrderItem[];
  billingData: BillingData;
  reservationMap: Map<ReservationFieldKey, ReservationOrderField>;
  referralId?: string | null;
}

function normalizeReservationOptionValue(
  key: ReservationFieldKey,
  value: string,
): string {
  const normalized = value.trim().toLowerCase();

  if (key === 'gender') {
    if (normalized === 'male' || normalized === 'ذكر') return 'ذكر';
    if (normalized === 'female' || normalized === 'انثى') return 'انثى';
  }

  if (key === 'isAlive') {
    if (normalized === 'alive' || normalized === 'حي') return 'حي';
    if (
      normalized === 'alive and dead' ||
      normalized === 'alive & dead' ||
      normalized === 'احياء و متوفين' ||
      normalized === 'أحياء و متوفين'
    )
      return 'احياء و متوفين';
    if (
      normalized === 'dead' ||
      normalized === 'deceased' ||
      normalized === 'ميت' ||
      normalized === 'متوفي'
    )
      return 'متوفي';
  }

  if (key === 'intention') {
    if (normalized === 'aqeeqah' || normalized === 'عقيقة') return 'عقيقة';
    if (normalized === 'charity' || normalized === 'صدقة') return 'صدقة';
    if (normalized === 'vow (nadhr)' || normalized === 'نذر') return 'نذر';
    if (normalized === 'protective sacrifice' || normalized === 'فدو')
      return 'فدو';
  }

  return value.trim();
}

function formatExecutionDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  const weekday = date.toLocaleDateString('ar-EG', {
    weekday: 'long',
  });

  return `${weekday} ${day}/${month}/${year}`;
}

function isNextDayExecutionDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const executionDate = new Date(year, month - 1, day);
  executionDate.setHours(0, 0, 0, 0);

  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return executionDate.getTime() === tomorrow.getTime();
}

export function buildOrderWhatsappMessage(data: OrderWhatsappData): string {
  const { reservationMap } = data;

  const intention = normalizeReservationOptionValue(
    'intention',
    reservationMap.get('intention')?.value ?? '',
  );

  const sacrificeFor = reservationMap.get('sacrificeFor')?.value?.trim() ?? '';

  const gender = normalizeReservationOptionValue(
    'gender',
    reservationMap.get('gender')?.value ?? '',
  );

  const isAlive = normalizeReservationOptionValue(
    'isAlive',
    reservationMap.get('isAlive')?.value ?? '',
  );

  const shortDuaa = reservationMap.get('shortDuaa')?.value?.trim() ?? '';

  const photo = reservationMap.get('photo')?.value?.trim() ?? '';

  const executionDate =
    reservationMap.get('executionDate')?.value?.trim() ?? '';

  const firstItem = data.items?.[0];

  const productLine = firstItem
    ? `${firstItem.quantity} ${firstItem.productName.ar}${intention ? ` ${intention}` : ''}`
    : '';

  const remainingLine =
    (data.remainingAmount ?? 0) > 0
      ? `✅ باقي ${(data.remainingAmount ?? 0).toLocaleString('ar-EG')} ${data.currency}`
      : '✅ خالص';

  const memorialLine =
    isAlive === 'متوفي'
      ? `عن روح ${gender === 'انثى' ? 'المرحومة' : gender === 'ذكور و اناث' ? 'المرحومين' : 'المرحوم'} بإذن الله`
      : '';

  const DIVIDER = '------------------';
  const genderEmoji =
    gender === 'انثى' ? '♀️' : gender === 'ذكور و اناث' ? '♂️♀️' : '♂️';

  const lines: string[] = [productLine, ''];

  if (memorialLine) {
    lines.push(memorialLine, '');
  }
  if (sacrificeFor) {
    lines.push(sacrificeFor, '');
  }
  if (shortDuaa) {
    lines.push(shortDuaa, '');
  }
  if (photo) {
    lines.push(`🤳🏻صورة: ${photo}`);
    lines.push(DIVIDER);
  }
  lines.push(remainingLine);
  lines.push(DIVIDER);
  if (executionDate && !isNextDayExecutionDate(executionDate)) {
    lines.push(`🗓️  *تنفيذ ${formatExecutionDate(executionDate)}*`);
    lines.push(DIVIDER);
  }
  lines.push(
    `${genderEmoji} ${gender || '-'}${isAlive ? ` - ${isAlive}` : ''}`,
  );
  lines.push(DIVIDER);
  lines.push(`🎟️رقم الطلب: ${data.orderNumber}`);
  lines.push('📋صاحب الفاتورة:');
  lines.push(data.billingData.fullName);
  lines.push(`📨ايميل: ${data.billingData.email}`);
  lines.push(`واتساب: ${data.billingData.phone}`);
  if (data.referralId?.trim()) {
    lines.push(DIVIDER);
    lines.push(`Ref Code: ${data.referralId.trim()}`);
  } else {
    lines.push(DIVIDER);
    lines.push('Ref Code: Default');
  }

  if (firstItem && firstItem.quantity === 1 && lines[0].startsWith('1 ')) {
    lines[0] = lines[0].replace(/^1 /, '');
  }

  return lines.join('\n');
}

export function buildOrderWhatsappMessageFromOrder(order: Order): string {
  const reservationMap = new Map<ReservationFieldKey, ReservationOrderField>();
  for (const field of order.reservationData || []) {
    if (!reservationMap.has(field.key as ReservationFieldKey)) {
      reservationMap.set(field.key as ReservationFieldKey, field);
    }
  }

  return buildOrderWhatsappMessage({
    orderNumber: order.orderNumber,
    currency: order.currency,
    remainingAmount: order.remainingAmount,
    items: order.items,
    billingData: order.billingData,
    reservationMap,
    referralId: order.referralId || null,
  });
}
