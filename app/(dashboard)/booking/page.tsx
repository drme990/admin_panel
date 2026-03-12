'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';

function formatDateForDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function parseDisplayDate(value: string): string | null {
  const normalized = value.trim().replace(/[-.]/g, '/');
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = dayRaw.padStart(2, '0');
  const month = monthRaw.padStart(2, '0');
  const iso = `${yearRaw}-${month}-${day}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

export default function BookingAdminPage() {
  const t = useTranslations('admin.booking');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [newDateInput, setNewDateInput] = useState('');

  const sortedDates = useMemo(
    () => [...blockedDates].sort((a, b) => a.localeCompare(b)),
    [blockedDates],
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
    const parsedDate = parseDisplayDate(newDateInput);
    if (!parsedDate) {
      toast.error(t('invalidDate'));
      return;
    }

    if (blockedDates.includes(parsedDate)) {
      setNewDateInput('');
      return;
    }

    setBlockedDates((prev) => [...prev, parsedDate]);
    setNewDateInput('');
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
        <h2 className="text-lg font-semibold">{t('blockedDates')}</h2>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <Input
            type="text"
            value={newDateInput}
            onChange={(e) => setNewDateInput(e.target.value)}
            placeholder="DD/MM/YYYY"
          />
          <Button type="button" variant="secondary" onClick={addDate}>
            {t('addDate')}
          </Button>
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
                <button
                  type="button"
                  className="text-error text-sm hover:underline"
                  onClick={() => removeDate(date)}
                >
                  {t('removeDate')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
