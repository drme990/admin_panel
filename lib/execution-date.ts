const EGYPT_TIMEZONE = 'Africa/Cairo';

/**
 * Get the current date in Egypt as a YYYY-MM-DD string.
 */
function getEgyptToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: EGYPT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Get current time-of-day in Egypt as HH:mm string.
 */
function getEgyptTime(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EGYPT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
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
 * Check if the current Egypt time is at or after the given cutoff HH:mm.
 */
function isAtOrAfterCutoff(cutoffTime: string | null | undefined): boolean {
  if (!cutoffTime) return false;

  const [cutoffHours, cutoffMinutes] = cutoffTime.split(':').map(Number);
  const [egyptHours, egyptMinutes] = getEgyptTime().split(':').map(Number);

  if (egyptHours > cutoffHours) return true;
  if (egyptHours < cutoffHours) return false;
  return egyptMinutes >= cutoffMinutes;
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
function isDayEndedToday(lastDayEndAt: string | null | undefined): boolean {
  if (!lastDayEndAt) return false;
  const endedDate = new Date(lastDayEndAt);
  if (Number.isNaN(endedDate.getTime())) return false;

  const egyptToday = getEgyptToday();
  const endedEgyptDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: EGYPT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(endedDate);

  return endedEgyptDate === egyptToday;
}

export interface BookingSettings {
  blockedExecutionDates: string[];
  cutoffTime: string | null;
  lastDayEndAt: string | null;
  defaultExecutionDate: string | null;
}

/**
 * Compute the default execution date.
 *
 * Rules:
 * 1. Start from the stored defaultExecutionDate, or tomorrow if none.
 * 2. If the stored date is in the past (<= today), catch up to tomorrow.
 * 3. If the stored date is "tomorrow" and the daily cutoff has passed → push to day-after-tomorrow.
 * 4. If the admin manually ended the day today → push one more day forward.
 * 5. Skip any blocked dates.
 */
export function computeDefaultExecutionDate(
  settings: BookingSettings,
): string {
  const today = getEgyptToday();
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

  if (base === tomorrow && isAtOrAfterCutoff(settings.cutoffTime)) {
    base = addDays(base, 1);
  }

  base = skipBlockedDates(base, blockedDates);

  if (isDayEndedToday(settings.lastDayEndAt)) {
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
