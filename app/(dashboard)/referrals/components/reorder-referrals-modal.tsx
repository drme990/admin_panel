'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { toast } from 'react-toastify';
import type { Referral } from '@/types/Referral';
import { LuGripVertical } from 'react-icons/lu';
import {
  defaultRefAppId,
  fetchDefaultRefPositions,
  mergeDefaultRefs,
} from '@/lib/default-refs';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Referrals to reorder (should be the full list, already sorted) */
  referrals: Referral[];
  /** Called after the new order is saved successfully */
  onSaved?: () => void;
}

/**
 * Modal for reordering referrals via drag-and-drop.
 *
 * Uses native HTML5 drag-and-drop (no external library needed).
 * The new order is saved as `filterOrder` values (0, 1, 2, ...)
 * via the bulk reorder API.
 */
export default function ReorderReferralsModal({
  isOpen,
  onClose,
  referrals,
  onSaved,
}: Props) {
  const t = useTranslations('admin.referrals');
  const [items, setItems] = useState<Referral[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Reset items when the modal opens — merge the virtual default refs
  // (MNK-D / GHD-D) in at their saved positions so they can be dragged
  // like any other referral.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setHasChanges(false);
    fetchDefaultRefPositions().then((positions) => {
      if (cancelled) return;
      setItems(
        mergeDefaultRefs(referrals, positions, (id) => ({
          _id: id,
          name: id,
          referralId: id,
          phone: '',
          appId: defaultRefAppId(id),
          createdAt: '',
          updatedAt: '',
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, referrals]);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex.current;
    dragIndex.current = null;
    setDragOverIndex(null);

    if (fromIndex === null || fromIndex === dropIndex) return;

    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    setHasChanges(true);
  };

  const handleDragEnd = () => {
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const orders = items.map((item, idx) => ({
        id: item._id,
        filterOrder: idx,
      }));

      const res = await fetch('/api/referrals/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success(t('messages.reorderSuccess'));
        onSaved?.();
        onClose();
      } else {
        toast.error(data.error || t('messages.reorderFailed'));
      }
    } catch {
      toast.error(t('messages.reorderFailed'));
    } finally {
      setSaving(false);
    }
  }, [items, t, onSaved, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('reorderTitle')}
      size="md"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-secondary">
            {hasChanges
              ? t('reorderUnsavedHint')
              : t('reorderDragHint')}
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancelButton')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? t('reorderSaving') : t('reorderSave')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-secondary text-center py-8">
            {t('emptyMessage')}
          </p>
        ) : (
          items.map((referral, index) => (
            <div
              key={referral._id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 rounded-lg border bg-background p-3 transition-all ${dragOverIndex === index
                ? 'border-primary ring-2 ring-primary/20 scale-[1.01]'
                : 'border-stroke hover:border-primary/40'
                } ${dragIndex.current === index ? 'opacity-50' : ''}`}
            >
              <div
                className="cursor-grab active:cursor-grabbing text-secondary hover:text-foreground"
                title={t('reorderDragHint')}
              >
                <LuGripVertical size={18} />
              </div>

              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {referral.name}
                </p>
                <p className="truncate text-xs text-secondary font-mono">
                  {referral.referralId}
                </p>
              </div>

              <span className="shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {referral.appId === 'manasik' ? 'Manasik' : 'Ghadaq'}
              </span>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
