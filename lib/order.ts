import type { PaymentMethod } from '@/types/Order';

export const EASYKASH_PAYMENT_METHOD: PaymentMethod = 'easykash';

export const MANUAL_PAYMENT_METHODS: PaymentMethod[] = [
    'easykash',
    'insta_pay',
    'vodafone_cash',
    'bank_transfer',
    'paypal',
    'binance',
];

export const PAYMENT_METHODS: PaymentMethod[] = [
    ...MANUAL_PAYMENT_METHODS,
    'card',
    'wallet',
    'fawry',
    'meeza',
    'valu',
    'other',
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { ar: string; en: string }> = {
    card: { ar: 'بطاقة', en: 'Card' },
    wallet: { ar: 'محفظة', en: 'Wallet' },
    bank_transfer: { ar: 'تحويل بنكي', en: 'Bank Transfer' },
    fawry: { ar: 'فوري', en: 'Fawry' },
    meeza: { ar: 'ميزة', en: 'Meeza' },
    valu: { ar: 'فاليو', en: 'Valu' },
    easykash: { ar: 'إيزي كاش', en: 'EasyKash' },
    insta_pay: { ar: 'إنستا باي', en: 'InstaPay' },
    vodafone_cash: { ar: 'فودافون كاش', en: 'Vodafone Cash' },
    paypal: { ar: 'باي بال', en: 'PayPal' },
    binance: { ar: 'بايننس', en: 'Binance' },
    other: { ar: 'أخرى', en: 'Other' },
};

export function getPaymentMethodLabel(method: PaymentMethod | undefined, locale: 'ar' | 'en'): string {
    if (!method) return '';
    return PAYMENT_METHOD_LABELS[method]?.[locale] || method;
}
