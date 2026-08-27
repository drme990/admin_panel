'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** When true, the section shows a red error dot/badge */
  hasError?: boolean;
  /** Error count to display in the badge */
  errorCount?: number;
  /** Default expanded state on first mount */
  defaultOpen?: boolean;
  /** Controlled open state — if provided, the component is controlled */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
  /** Optional id for scroll targeting */
  sectionId?: string;
}

export default function CollapsibleSection({
  title,
  description,
  icon,
  hasError = false,
  errorCount = 0,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  children,
  sectionId,
}: CollapsibleSectionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(
    undefined,
  );

  const handleToggle = () => {
    const next = !isOpen;
    if (controlledOpen === undefined) {
      setUncontrolledOpen(next);
    }
    onToggle?.(next);
  };

  // Measure content height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return;
    if (isOpen) {
      setContentHeight(contentRef.current.scrollHeight);
    } else {
      setContentHeight(0);
    }
  }, [isOpen, children]);

  // Update height when window resizes or content changes
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const observer = new ResizeObserver(() => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.scrollHeight);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  return (
    <div
      id={sectionId}
      className={cn(
        'rounded-xl border bg-card-bg overflow-hidden transition-colors',
        hasError ? 'border-error/40' : 'border-stroke',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-start hover:bg-muted/40 transition-colors"
      >
        {icon && (
          <span
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors',
              hasError
                ? 'bg-error/10 text-error'
                : 'bg-primary/10 text-primary',
            )}
          >
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {title}
            </h3>
            {hasError && errorCount > 0 && (
              <span className="shrink-0 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-error text-white text-xs font-bold">
                {errorCount}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-secondary mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
        <LuChevronDown
          size={18}
          className={cn(
            'shrink-0 text-secondary transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Content */}
      <div
        style={{
          maxHeight: isOpen
            ? contentHeight !== undefined
              ? `${contentHeight}px`
              : 'none'
            : '0px',
        }}
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
      >
        <div
          ref={contentRef}
          className="px-4 pb-4 pt-1 space-y-4"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
