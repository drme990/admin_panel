/**
 * Customer name validation matching the storefront checkout
 * (`manasik-v2/lib/customer-name.ts`) and the backend rule
 * (`backend/lib/utils/name.ts`). EasyKash's `onlyNumbersAndCharacters`
 * rejects names with punctuation, symbols or emojis during payment-link
 * creation, so they must be rejected at input time.
 */
const CUSTOMER_NAME_PATTERN =
  /^[\p{L}\p{N}]+(?:[\p{L}\p{N} ]*[\p{L}\p{N}])?$/u;

export function isValidCustomerName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && CUSTOMER_NAME_PATTERN.test(trimmed);
}
