const EGYPT_TIMEZONE = 'Africa/Cairo';

/**
 * Summer-time override type.
 *
 * - `true`  → force UTC+3 (Egypt DST / summer time)
 * - `false` → auto-detect (same as null/undefined — the admin has NOT
 *   explicitly forced summer time, so we trust the system tzdata)
 * - `null`/`undefined` → auto-detect using the `Africa/Cairo` IANA
 *   timezone (which follows the OS tzdata).
 */
type SummerTimeOverride = boolean | null | undefined;

/**
 * Get the effective UTC offset in minutes for Egypt, respecting the
 * manual summer-time override.
 *
 * - `true`  → 180 (UTC+3, forced summer time)
 * - `false`/`null`/`undefined` → auto-detect from `Africa/Cairo` IANA
 *   timezone. This correctly returns UTC+3 during summer and UTC+2
 *   during winter, as long as the system tzdata is up to date.
 */
function getEgyptOffsetMinutes(summerTime: SummerTimeOverride): number {
  if (summerTime === true) return 180;

  // Auto-detect (covers false, null, undefined) from Africa/Cairo IANA
  // timezone. This respects the system's tzdata, which may or may not
  // include Egypt's latest DST decision.
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TIMEZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(now);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  if (offsetPart) {
    const match = offsetPart.value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const sign = match[1] === '+' ? 1 : -1;
      const hours = parseInt(match[2], 10);
      const minutes = match[3] ? parseInt(match[3], 10) : 0;
      return sign * (hours * 60 + minutes);
    }
  }
  return 120;
}

/**
 * Convert a Date to a YYYY-MM-DD string in Egypt time, respecting the
 * summer-time override.
 */
function toEgyptDateString(date: Date, summerTime: SummerTimeOverride = undefined): string {
  const offsetMs = getEgyptOffsetMinutes(summerTime) * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a Date to an HH:mm string in Egypt time, respecting the
 * summer-time override.
 */
function toEgyptTimeString(date: Date, summerTime: SummerTimeOverride = undefined): string {
  const offsetMs = getEgyptOffsetMinutes(summerTime) * 60 * 1000;
  const local = new Date(date.getTime() + offsetMs);
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Get the current date in Egypt as a YYYY-MM-DD string.
 */
function getEgyptToday(summerTime: SummerTimeOverride = undefined): string {
  return toEgyptDateString(new Date(), summerTime);
}

/**
 * Add days to a YYYY-MM-DD string and return the new YYYY-MM-DD string.
 */
function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if the current time is at or after the cutoff on the given execution date.
 * cutoffTime is HH:mm. baseDate is YYYY-MM-DD.
 */
function isAtOrAfterCutoff(
  cutoffTime: string | null | undefined,
  baseDate: string,
  summerTime: SummerTimeOverride = undefined,
): boolean {
  if (!cutoffTime || !baseDate) return false;

  const egyptToday = getEgyptToday(summerTime);
  const egyptNowTime = toEgyptTimeString(new Date(), summerTime);

  if (egyptToday > baseDate) return true;
  if (egyptToday < baseDate) return false;

  const [ah, am] = egyptNowTime.split(':').map(Number);
  const [bh, bm] = cutoffTime.split(':').map(Number);
  return (ah * 60 + am) - (bh * 60 + bm) >= 0;
}

/**
 * Skip blocked dates by adding days until a non-blocked date is found.
 */
function skipBlockedDates(
  dateStr: string,
  blockedDates: Set<string>,
): string {
  let candidate = dateStr;
  let iterations = 0;
  const MAX_ITERATIONS = 365;
  while (blockedDates.has(candidate) && iterations < MAX_ITERATIONS) {
    candidate = addDays(candidate, 1);
    iterations += 1;
  }
  return candidate;
}

/**
 * Check if lastDayEndAt is for the current Egypt day.
 */
function isDayEndedToday(
  lastDayEndAt: string | null | undefined,
  summerTime: SummerTimeOverride = undefined,
): boolean {
  if (!lastDayEndAt) return false;
  const endedDate = new Date(lastDayEndAt);
  if (Number.isNaN(endedDate.getTime())) return false;

  const egyptToday = getEgyptToday(summerTime);
  const endedEgyptDate = toEgyptDateString(endedDate, summerTime);

  return endedEgyptDate === egyptToday;
}

export interface BookingSettings {
  blockedExecutionDates: string[];
  cutoffTime: string | null;
  lastDayEndAt: string | null;
  defaultExecutionDate: string | null;
  summerTimeEnabled?: boolean;
}

/**
 * Compute the default execution date.
 *
 * Rules:
 * 1. Start from the stored defaultExecutionDate, or tomorrow if none.
 * 2. If the stored date is in the past (<= today), catch up to tomorrow.
 * 3. If the stored date is "tomorrow" and the cutoff on that date has passed → push forward.
 * 4. If the admin manually ended the day today → push one more day forward.
 * 5. Skip any blocked dates.
 */
export function computeDefaultExecutionDate(
  settings: BookingSettings,
): string {
  const summerTime = settings.summerTimeEnabled;
  const today = getEgyptToday(summerTime);
  const tomorrow = addDays(today, 1);
  const blockedDates = new Set(
    (settings.blockedExecutionDates ?? []).filter((d) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d),
    ),
  );

  let base = settings.defaultExecutionDate || tomorrow;

  if (base <= today) {
    base = tomorrow;
  }

  if (base === tomorrow && isAtOrAfterCutoff(settings.cutoffTime, base, summerTime)) {
    base = addDays(base, 1);
  }

  base = skipBlockedDates(base, blockedDates);

  if (isDayEndedToday(settings.lastDayEndAt, summerTime)) {
    base = addDays(base, 1);
    base = skipBlockedDates(base, blockedDates);
  }

  return base;
}

/**
 * Return the default cutoff time as HH:mm.
 */
export function getDefaultCutoffTime(): string {
  return '02:00';
}
