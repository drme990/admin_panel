'use client';

import { useEffect, useRef, useState } from 'react';
import { LuUpload, LuImage, LuFileText } from 'react-icons/lu';
import Button from '@/components/ui/button';
import Tooltip from '@/components/ui/tooltip';

export type UploadFileType = 'image' | 'file';

export interface InvoiceUploadTypeMenuProps {
  onUpload: (type: UploadFileType) => void;
  disabled?: boolean;
  tooltipPos?: 'left' | 'right';
  labels: {
    tooltip?: string;
    uploadImage: string;
    uploadFile: string;
  };
  className?: string;
}

export function InvoiceUploadTypeMenu({
  onUpload,
  disabled,
  tooltipPos,
  labels,
  className,
}: InvoiceUploadTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (type: UploadFileType) => {
    setIsOpen(false);
    onUpload(type);
  };

  return (
    <div className="relative" ref={rootRef}>
      <Tooltip position={tooltipPos || 'left'} content={labels.tooltip || ''}>
        <Button
          variant="ghost"
          size="custom"
          className={`h-6 w-6 p-0 text-secondary hover:text-foreground ${className || ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          disabled={disabled}
          aria-label={labels.tooltip}
        >
          <LuUpload size={14} />
        </Button>
      </Tooltip>
      {isOpen && (
        <div className="absolute z-30 mt-1 w-44 rounded-site border border-stroke bg-card-bg p-1 shadow-xl">
          <Button
            variant="custom"
            size="custom"
            type="button"
            className="w-full px-2 py-1.5 text-start text-sm hover:bg-background rounded-lg transition-colors flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('image');
            }}
          >
            <LuImage size={14} className="text-success" />
            {labels.uploadImage}
          </Button>
          <Button
            variant="custom"
            size="custom"
            type="button"
            className="w-full px-2 py-1.5 text-start text-sm hover:bg-background rounded-lg transition-colors flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              handleSelect('file');
            }}
          >
            <LuFileText size={14} className="text-warning" />
            {labels.uploadFile}
          </Button>
        </div>
      )}
    </div>
  );
}
