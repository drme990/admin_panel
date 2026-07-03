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

function statusIcon(status: InvoiceStatus, size: number = 28): React.ReactNode {
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

const STATUS_TEXT_COLORS: Record<InvoiceStatus, string> = {
  confirmed: 'text-green-700 dark:text-green-300',
  waiting: 'text-orange-700 dark:text-orange-300',
  pending: 'text-blue-700 dark:text-blue-300',
  rejected: 'text-red-700 dark:text-red-300',
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
        className={cn(
          'flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded-lg',
          'border border-stroke bg-background hover:bg-foreground/5 transition-colors',
          'min-w-20'
        )}
      >
        {statusIcon(status)}
        <span className={cn('text-xs font-medium', STATUS_TEXT_COLORS[status])}>
          {label}
        </span>
        <LuChevronDown size={14} className="text-secondary" />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 z-30 min-w-35 rounded-lg border border-stroke bg-card-bg shadow-lg p-1">
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
              <span className="shrink-0">{statusIcon(s, 18)}</span>
              <span>{t(`status.${s}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
