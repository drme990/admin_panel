'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'react-toastify';
import {
  LuPercent as PercentIcon,
  LuCircleDollarSign as FixedIcon,
  LuX as XIcon,
  LuBan as NoneIcon,
} from 'react-icons/lu';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/order';
import type { PaymentMethod } from '@/types/Order';

interface PaymentToleranceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ToleranceType = 'percentage' | 'fixnumber';

interface ToleranceDraft {
  type: ToleranceType;
  value: string;
}

export default function PaymentToleranceModal({
  isOpen,
  onClose,
}: PaymentToleranceModalProps) {
  const t = useTranslations('admin.countries');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ToleranceDraft>>({});
  // Track which methods are in "editing" mode (input visible) vs "none" mode (None button visible)
  const [editingMethods, setEditingMethods] = useState<Set<string>>(new Set());

  const fetchTolerances = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/booking');
      const data = await res.json();
      if (data.success) {
        const tolerances = data.data?.paymentMethodTolerances ?? {};
        const newDrafts: Record<string, ToleranceDraft> = {};
        const newEditing = new Set<string>();
        for (const method of PAYMENT_METHODS) {
          const existing = tolerances[method];
          if (existing && (existing.type === 'percentage' || existing.type === 'fixnumber') && existing.value > 0) {
            newDrafts[method] = { type: existing.type, value: String(existing.value) };
            newEditing.add(method); // has existing tolerance → start in editing mode
          } else {
            newDrafts[method] = { type: 'percentage', value: '' };
            // no existing tolerance → start in none mode
          }
        }
        setDrafts(newDrafts);
        setEditingMethods(newEditing);
      }
    } catch {
      toast.error(t('tolerance.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      void fetchTolerances();
    }
  }, [isOpen, fetchTolerances]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tolerances: Record<string, { type: 'percentage' | 'fixnumber'; value: number }> = {};
      for (const method of PAYMENT_METHODS) {
        const draft = drafts[method];
        // No value = no tolerance (none)
        if (draft && draft.value.trim() !== '') {
          const numValue = parseFloat(draft.value) || 0;
          if (numValue > 0) {
            tolerances[method] = { type: draft.type, value: numValue };
          }
        }
      }

      const res = await fetch('/api/booking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodTolerances: tolerances }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save tolerances');
      }
      toast.success(t('tolerance.saveSuccess'));
      onClose();
    } catch {
      toast.error(t('tolerance.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (method: string, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [method]: { ...prev[method], value },
    }));
  };

  const updateType = (method: string, type: ToleranceType) => {
    setDrafts((prev) => ({
      ...prev,
      [method]: { ...prev[method], type },
    }));
  };

  const startEditing = (method: string) => {
    setEditingMethods((prev) => new Set(prev).add(method));
  };

  const clearTolerance = (method: string) => {
    setDrafts((prev) => ({
      ...prev,
      [method]: { type: 'percentage', value: '' },
    }));
    setEditingMethods((prev) => {
      const next = new Set(prev);
      next.delete(method);
      return next;
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={t('tolerance.title')}
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('tolerance.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? '...' : t('tolerance.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t('tolerance.description')}
          </p>
          <p className="text-xs text-secondary mt-1">
            {t('tolerance.hint')}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-secondary">...</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
            {PAYMENT_METHODS.map((method: PaymentMethod) => {
              const draft = drafts[method] ?? { type: 'percentage' as ToleranceType, value: '' };
              const label = PAYMENT_METHOD_LABELS[method];
              const displayName = locale === 'ar' ? label.ar : label.en;
              const hasValue = draft.value.trim() !== '';
              const isEditing = editingMethods.has(method);

              return (
                <div
                  key={method}
                  className="flex items-center gap-2 rounded-lg border border-stroke bg-background px-3 py-2"
                >
                  {/* Method name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">
                      {displayName}
                    </span>
                  </div>

                  {!isEditing ? (
                    /* ── None button — click to start editing ── */
                    <button
                      type="button"
                      onClick={() => startEditing(method)}
                      className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-secondary transition-colors hover:bg-muted/80 hover:text-foreground"
                    >
                      <NoneIcon size={14} />
                      <span className="whitespace-nowrap">{t('tolerance.none')}</span>
                    </button>
                  ) : (
                    /* ── Editing mode: input + type toggles + clear ── */
                    <>
                      {/* Value input */}
                      <div className="w-24 sm:w-28 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={draft.value}
                          placeholder="0"
                          onChange={(e) => updateValue(method, e.target.value)}
                          className="text-center text-sm"
                        />
                      </div>

                      {/* Type toggle — two buttons stacked vertically */}
                      <div className="flex flex-col shrink-0 gap-0.5">
                        <Tooltip
                          content={t('tolerance.percentage')}
                          position={locale === 'ar' ? 'right' : 'left'}
                        >
                          <button
                            type="button"
                            onClick={() => updateType(method, 'percentage')}
                            className={`flex h-6 w-9 items-center justify-center rounded text-xs font-bold transition-colors ${draft.type === 'percentage' && hasValue
                              ? 'bg-primary text-primary-foreground'
                              : draft.type === 'percentage'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-secondary hover:bg-muted/80'
                              }`}
                          >
                            <PercentIcon size={13} />
                          </button>
                        </Tooltip>
                        <Tooltip
                          content={t('tolerance.fixnumber')}
                          position={locale === 'ar' ? 'right' : 'left'}
                        >
                          <button
                            type="button"
                            onClick={() => updateType(method, 'fixnumber')}
                            className={`flex h-6 w-9 items-center justify-center rounded text-xs font-bold transition-colors ${draft.type === 'fixnumber' && hasValue
                              ? 'bg-primary text-primary-foreground'
                              : draft.type === 'fixnumber'
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-secondary hover:bg-muted/80'
                              }`}
                          >
                            <FixedIcon size={13} />
                          </button>
                        </Tooltip>
                      </div>

                      {/* Clear / back to None */}
                      <Tooltip
                        content={t('tolerance.none')}
                        position={locale === 'ar' ? 'right' : 'left'}
                      >
                        <button
                          type="button"
                          onClick={() => clearTolerance(method)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-secondary transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <XIcon size={15} />
                        </button>
                      </Tooltip>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Legend / hint at bottom */}
        <div className="flex items-center gap-4 text-xs text-secondary pt-1">
          <span className="flex items-center gap-1">
            <PercentIcon size={12} /> {t('tolerance.percentage')}
          </span>
          <span className="flex items-center gap-1">
            <FixedIcon size={12} /> {t('tolerance.fixnumber')}
          </span>
          <span className="ms-auto">{t('tolerance.emptyHint')}</span>
        </div>
      </div>
    </Modal>
  );
}
