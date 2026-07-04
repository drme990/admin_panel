'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LuCheck, LuClock, LuCircle, LuX, LuChevronDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { InvoiceStatus } from '@/types/Order';
import type { InvoiceRow } from '../lib/invoice-utils';

interface Props {
  invoice: InvoiceRow;
  onStatusChange: (invoice: InvoiceRow, status: InvoiceStatus) => void;
}

const STATUS_LIST: InvoiceStatus[] = ['confirmed', 'waiting', 'pending', 'rejected'];

function statusIcon(status: InvoiceStatus, size: number = 24): React.ReactNode {
  const colorClass = {
    confirmed: 'text-green-600 dark:text-green-400',
    waiting: 'text-orange-500 dark:text-orange-400',
    pending: 'text-blue-600 dark:text-blue-400',
    rejected: 'text-red-600 dark:text-red-400',
  }[status];

  const iconClass = `shrink-0 ${colorClass}`;

  switch (status) {
    case 'confirmed':
      return <LuCheck size={size} className={iconClass} />;
    case 'waiting':
      return <LuClock size={size} className={iconClass} />;
    case 'pending':
      return <LuCircle size={size} className={iconClass} />;
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
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const status = invoice.invoiceStatus as InvoiceStatus;
  const label = t(`status.${status}`);

  return (
    <div className="relative inline-flex flex-col items-center" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={label}
        className={cn(
          'flex flex-col items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-lg',
          'border border-stroke bg-background hover:bg-foreground/5 transition-colors',
          'min-w-18 sm:min-w-20'
        )}
      >
        <span className="scale-90 sm:scale-100">{statusIcon(status)}</span>
        <span className={cn('text-[10px] sm:text-xs font-medium', STATUS_TEXT_COLORS[status])}>
          {label}
        </span>
        <LuChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 z-30 min-w-32 sm:min-w-35 rounded-lg border border-stroke bg-card-bg shadow-lg p-1">
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
                'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                s === status
                  ? 'bg-foreground/10 text-foreground'
                  : 'text-foreground hover:bg-foreground/5'
              )}
            >
              <span className={STATUS_TEXT_COLORS[s]}>{t(`status.${s}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
