'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { LuCalendarRange as CalendarRange } from 'react-icons/lu';
import Button from '@/components/ui/button';
import CustomDatePicker from '@/components/ui/custom-date-picker';

function formatDateForDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
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

  const sortedDates = useMemo(
    () => [...blockedDates].sort((a, b) => a.localeCompare(b)),
    [blockedDates],
  );

  const pendingRangeDates = useMemo(
    () => enumerateDateRange(rangeStartDate, rangeEndDate),
    [rangeEndDate, rangeStartDate],
  );

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

  const saveChanges = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockedExecutionDates: sortedDates }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'save failed');
      }

      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

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

      <div className="bg-card-bg border border-stroke rounded-site p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CalendarRange size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('blockedDates')}</h2>
            <p className="text-sm text-secondary">{t('calendarHint')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rounded-site border border-stroke bg-background p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t('singleDateTitle')}
              </h3>
              <p className="text-sm text-secondary">
                {t('singleDateDescription')}
              </p>
            </div>

            <CustomDatePicker
              locale={locale}
              label={t('singleDateLabel')}
              placeholder={t('pickDate')}
              value={singleDate}
              onChange={setSingleDate}
              markedDates={sortedDates}
              helperText={t('markedDateHint')}
            />

            <Button type="button" variant="primary" onClick={addDate}>
              {t('addDate')}
            </Button>
          </div>

          <div className="rounded-site border border-stroke bg-background p-4 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {t('rangeTitle')}
              </h3>
              <p className="text-sm text-secondary">{t('rangeDescription')}</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <CustomDatePicker
                locale={locale}
                label={t('rangeStart')}
                placeholder={t('pickDate')}
                value={rangeStartDate}
                onChange={setRangeStartDate}
                markedDates={sortedDates}
              />

              <CustomDatePicker
                locale={locale}
                label={t('rangeEnd')}
                placeholder={t('pickDate')}
                value={rangeEndDate}
                onChange={setRangeEndDate}
                markedDates={sortedDates}
              />
            </div>

            <div className="rounded-lg border border-dashed border-stroke bg-card-bg px-4 py-3 text-sm text-secondary">
              {pendingRangeDates.length > 0
                ? t('rangeSummary', { count: pendingRangeDates.length })
                : t('rangeSummaryEmpty')}
            </div>

            <Button type="button" variant="primary" onClick={addDateRange}>
              {t('addRange')}
            </Button>
          </div>
        </div>

        {sortedDates.length === 0 ? (
          <p className="text-sm text-secondary">{t('noDates')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedDates.map((date) => (
              <div
                key={date}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-stroke bg-background"
              >
                <span className="text-sm font-medium">
                  {formatDateForDisplay(date)}
                </span>
                <Button
                  type="button"
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
        )}
      </div>
    </div>
  );
}
