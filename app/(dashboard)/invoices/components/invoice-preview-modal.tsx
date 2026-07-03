'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LuFileText, LuDownload, LuExternalLink } from 'react-icons/lu';

import Button from '@/components/ui/button';
import { downloadFile } from '@/lib/download-utils';
import { isImageUrl } from '../lib/invoice-utils';

interface Props {
  url: string | null;
  onClose: () => void;
}

export default function InvoicePreviewModal({ url, onClose }: Props) {
  const t = useTranslations('admin.invoices');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (url) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col items-center max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()}
      >
        {isImageUrl(url) ? (
          <img
            src={url}
            alt="Invoice preview"
            className="max-w-full max-h-[80vh] object-contain rounded-lg"
          />
        ) : (
          <div className="bg-card-bg rounded-lg p-8 flex flex-col items-center gap-4">
            <LuFileText size={48} className="text-secondary" />
            <span className="text-sm text-secondary text-center max-w-xs">
              {t('preview')}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  try {
                    const filename = new URL(url).pathname.split('/').pop() || 'invoice';
                    void downloadFile(url, filename);
                  } catch {
                    void downloadFile(url, 'invoice');
                  }
                }}
              >
                <LuDownload size={16} className="mr-1" />
                {t('download')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                <LuExternalLink size={16} className="mr-1" />
                {t('openUrl')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
