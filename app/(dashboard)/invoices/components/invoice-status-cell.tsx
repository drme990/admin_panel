'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LuCheck, LuClock, LuX, LuChevronDown, LuHand } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types/Order';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow;
  onStatusChange: (invoice: InvoiceRow, status: InvoiceStatus) => void;
}

const STATUS_LIST: InvoiceStatus[] = [
  'confirmed',
  'waiting',
  'pending',
  'rejected',
];

function statusIcon(status: InvoiceStatus, size: number = 24): React.ReactNode {
  const colorClass = {
    confirmed: 'text-success',
    waiting: 'text-warning',
    pending: 'text-info',
    rejected: 'text-error',
  }[status];

  const iconClass = `shrink-0 ${colorClass}`;

  switch (status) {
    case 'confirmed':
      return <LuCheck size={size} className={iconClass} />;
    case 'waiting':
      return <LuClock size={size} className={iconClass} />;
    case 'pending':
      return <LuHand size={size} className={iconClass} />;
    case 'rejected':
      return <LuX size={size} className={iconClass} />;
  }
}

export const STATUS_TEXT_COLORS: Record<InvoiceStatus, string> = {
  confirmed: 'text-success',
  waiting: 'text-warning',
  pending: 'text-info',
  rejected: 'text-error',
};

export default function InvoiceStatusCell({ invoice, onStatusChange }: Props) {
  const t = useTranslations('admin.invoices');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const status = invoice.invoiceStatus as InvoiceStatus;
  const label = t(`status.${status}`);

  return (
    <div
      className="relative inline-flex flex-col items-center"
      ref={containerRef}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={label}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
          'border border-stroke bg-background hover:bg-foreground/5 transition-colors',
          'text-xs font-medium',
          STATUS_TEXT_COLORS[status],
        )}
      >
        {statusIcon(status, 16)}
        <span>{label}</span>
        <LuChevronDown className="w-3 h-3 text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-30 flex flex-row gap-1 rounded-lg border border-stroke bg-card-bg shadow-lg p-1">
          {STATUS_LIST.map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onStatusChange(invoice, s);
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-md transition-colors min-w-14',
                s === status
                  ? 'bg-foreground/10'
                  : 'hover:bg-foreground/5',
              )}
              aria-label={t(`status.${s}`)}
              title={t(`status.${s}`)}
            >
              {statusIcon(s, 16)}
              <span className={cn('text-[10px] font-medium', STATUS_TEXT_COLORS[s])}>
                {t(`status.${s}`)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
