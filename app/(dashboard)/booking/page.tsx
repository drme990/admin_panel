'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuCalendarRange as CalendarRange,
  LuClock as ClockIcon,
  LuInfo as InfoIcon,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import CustomDatePicker from '@/components/ui/custom-date-picker';
import TimePicker from '@/components/ui/time-picker';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';

function formatDateForDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function getEgyptToday(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function enumerateDateRange(start: string, end: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return [];
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  if (startDate > endDate) {
    return [];
  }

  const out: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export default function BookingAdminPage() {
  const t = useTranslations('admin.booking');
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [singleDate, setSingleDate] = useState('');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');

  const [cutoffTime, setCutoffTime] = useState('');
  const [lastDayEndAt, setLastDayEndAt] = useState<string | null>(null);
  const [defaultExecutionDate, setDefaultExecutionDate] = useState<string>('');

  const { confirm, modalProps } = useConfirmModal();

  const sortedDates = useMemo(
    () => [...blockedDates].sort((a, b) => a.localeCompare(b)),
    [blockedDates],
  );

  const pendingRangeDates = useMemo(
    () => enumerateDateRange(rangeStartDate, rangeEndDate),
    [rangeEndDate, rangeStartDate],
  );

  const egyptToday = useMemo(() => getEgyptToday(), []);
  const tomorrow = useMemo(() => addDays(egyptToday, 1), [egyptToday]);
  const dayAfterTomorrow = useMemo(() => addDays(egyptToday, 2), [egyptToday]);

  useEffect(() => {
    const loadBooking = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/booking');
        const data = await res.json();

        if (data.success) {
          const rawDates: unknown[] = Array.isArray(
            data.data?.blockedExecutionDates,
          )
            ? (data.data.blockedExecutionDates as unknown[])
            : [];
          const dates: string[] = rawDates.filter(
            (d): d is string =>
              typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d),
          );

          setBlockedDates(Array.from(new Set(dates)).sort());
          setCutoffTime(data.data?.cutoffTime ?? '02:00');
          setLastDayEndAt(data.data?.lastDayEndAt ?? null);
          setDefaultExecutionDate(data.data?.defaultExecutionDate ?? '');
        } else {
          toast.error(t('loadFailed'));
        }
      } catch {
        toast.error(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadBooking();
  }, [t]);

  const addDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
      toast.error(t('invalidDate'));
      return;
    }

    if (blockedDates.includes(singleDate)) {
      setSingleDate('');
      return;
    }

    setBlockedDates((prev) =>
      Array.from(new Set([...prev, singleDate])).sort(),
    );
    setSingleDate('');
  };

  const addDateRange = () => {
    const rangeDates = enumerateDateRange(rangeStartDate, rangeEndDate);
    if (rangeDates.length === 0) {
      toast.error(t('invalidRange'));
      return;
    }

    setBlockedDates((prev) =>
      Array.from(new Set([...prev, ...rangeDates])).sort(),
    );
    setRangeStartDate('');
    setRangeEndDate('');
  };

  const removeDate = (date: string) => {
    setBlockedDates((prev) => prev.filter((d) => d !== date));
  };

  const handleEndDay = async () => {
    const confirmed = await confirm({
      title: t('endDayConfirmTitle'),
      message: t('endDayConfirmMessage'),
      type: 'warning',
      confirmText: t('endDay'),
      cancelText: t('cancel'),
    });
    if (!confirmed) return;

    const now = new Date();
    const iso = now.toISOString();

    setSaving(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastDayEndAt: iso }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'save failed');
      }

      setLastDayEndAt(iso);
      setDefaultExecutionDate(data.data?.defaultExecutionDate ?? '');
      toast.success(t('dayEndSuccess'));
    } catch {
      toast.error(t('dayEndFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDay = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastDayEndAt: null }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'save failed');
      }

      setLastDayEndAt(null);
      setDefaultExecutionDate(data.data?.defaultExecutionDate ?? '');
      toast.success(t('dayOpenSuccess'));
    } catch {
      toast.error(t('dayOpenFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        blockedExecutionDates: sortedDates,
        cutoffTime: cutoffTime || null,
      };

      if (defaultExecutionDate) {
        body.defaultExecutionDate = defaultExecutionDate;
      }

      const res = await fetch('/api/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'save failed');
      }

      setDefaultExecutionDate(data.data?.defaultExecutionDate ?? '');
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const isDayEnded = Boolean(lastDayEndAt);

  if (loading) {
    return <div className="text-secondary">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>

        <Button onClick={saveChanges} disabled={saving}>
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      </div>

      {/* Execution Settings Card — merged default date + cutoff + day status */}
      <div className="bg-card-bg border border-stroke rounded-site p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <InfoIcon size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('currentStatus')}</h2>
            <p className="text-sm text-secondary">{t('statusHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Default Execution Date */}
          <div className="rounded-site border border-stroke bg-background p-4 space-y-2">
            <p className="text-sm text-secondary">{t('defaultExecutionDate')}</p>
            <CustomDatePicker
              locale={locale}
              value={defaultExecutionDate}
              onChange={setDefaultExecutionDate}
              markedDates={sortedDates}
              minDate={tomorrow}
              maxDate={dayAfterTomorrow}
              disabledDates={sortedDates}
            />
          </div>

          {/* Cutoff Time */}
          <div className="rounded-site border border-stroke bg-background p-4 space-y-2">
            <p className="text-sm text-secondary">{t('cutoffTime')}</p>
            <TimePicker
              value={cutoffTime}
              onChange={(e) => setCutoffTime(e.target.value)}
              helperText={t('cutoffTimeHint')}
            />
          </div>

          {/* Day status + End/Open buttons */}
          <div className="rounded-site border border-stroke bg-background p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-secondary">{t('dayStatus')}</p>
              <p className="text-xl font-bold text-foreground">
                {isDayEnded ? (
                  <span className="text-error">{t('dayEnded')}</span>
                ) : (
                  <span className="text-success">{t('dayOpen')}</span>
                )}
              </p>
            </div>
            {lastDayEndAt && (
              <p className="text-xs text-secondary">
                {t('endedAt', {
                  time: new Date(lastDayEndAt).toLocaleTimeString(),
                })}
              </p>
            )}
            <div className="flex gap-3">
              {isDayEnded ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleOpenDay}
                  disabled={saving}
                  className="w-full"
                >
                  {t('openDay')}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleEndDay}
                  disabled={saving}
                  className="w-full"
                >
                  {t('endDay')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Blocked Dates Card */}
      <div className="bg-card-bg border border-stroke rounded-site p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarRange size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('blockedDates')}</h2>
            <p className="text-sm text-secondary">{t('blockedDatesHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {/* Single date */}
            <div className="flex gap-3">
              <div className="flex-1">
                <CustomDatePicker
                  locale={locale}
                  value={singleDate}
                  onChange={setSingleDate}
                  markedDates={sortedDates}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={addDate}
                className="self-end"
              >
                {t('addDate')}
              </Button>
            </div>

            {/* Date range */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <CustomDatePicker
                  locale={locale}
                  label={t('rangeStart')}
                  value={rangeStartDate}
                  onChange={setRangeStartDate}
                  markedDates={sortedDates}
                />
              </div>
              <div className="flex-1">
                <CustomDatePicker
                  locale={locale}
                  label={t('rangeEnd')}
                  value={rangeEndDate}
                  onChange={setRangeEndDate}
                  markedDates={sortedDates}
                />
              </div>
              <Button type="button" variant="secondary" onClick={addDateRange}>
                {t('addRange')}
              </Button>
            </div>

            {/* Pending range preview */}
            {pendingRangeDates.length > 0 && (
              <div className="bg-info/10 border border-info/20 rounded-site p-3">
                <p className="text-sm text-info font-medium">
                  {t('rangePreview', { count: pendingRangeDates.length })}
                </p>
                <p className="text-xs text-secondary mt-1">
                  {pendingRangeDates.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Date list */}
        {sortedDates.length > 0 && (
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              {t('selectedDates', { count: sortedDates.length })}
            </h3>
            <div className="flex flex-wrap gap-2">
              {sortedDates.map((date) => (
                <div
                  key={date}
                  className="inline-flex items-center gap-2 bg-background border border-stroke rounded-site px-3 py-2"
                >
                  <span className="text-sm text-foreground">
                    {formatDateForDisplay(date)}
                  </span>
                  <Button
                    variant="custom"
                    size="custom"
                    className="text-error text-sm hover:underline"
                    onClick={() => removeDate(date)}
                  >
                    {t('removeDate')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal {...modalProps} />
    </div>
  );
}
