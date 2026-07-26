'use client';

import Image from 'next/image';
import { LuDownload, LuPencil } from 'react-icons/lu';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { downloadFile } from '@/lib/download-utils';

interface DesignPreviewModalProps {
  /** Design image URL to preview. null = modal closed. */
  url: string | null;
  /** Order number — used for the download filename. */
  orderNumber?: string;
  /** Called when the modal is closed (click outside, Escape, X button). */
  onClose: () => void;
  /** Called when the "edit" button is clicked. */
  onEdit?: () => void;
}

/**
 * Design preview modal — uses the shared Modal component to show an
 * order's design image with download + edit actions in the footer.
 */
export default function DesignPreviewModal({
  url,
  orderNumber,
  onClose,
  onEdit,
}: DesignPreviewModalProps) {
  const t = useTranslations('execution.table');
  const isOpen = !!url;

  const handleDownload = () => {
    if (!url) return;
    const filename = orderNumber ? `design-${orderNumber}` : 'design';
    void downloadFile(url, filename);
  };

  const handleEdit = () => {
    onClose();
    onEdit?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('viewDesign')}
      size="xl"
      contentClassName="flex items-center justify-center min-h-100"
      footer={
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <LuDownload size={16} className="mr-1" />
            {t('downloadDesign')}
          </Button>
          {onEdit && (
            <Button variant="primary" size="sm" onClick={handleEdit}>
              <LuPencil size={16} className="mr-1" />
              {t('editDesign')}
            </Button>
          )}
        </div>
      }
    >
      {url && (
        <Image
          src={url}
          alt={t('design')}
          className="max-h-[70vh] max-w-full rounded-lg object-contain"
          width={1200}
          height={900}
          unoptimized
        />
      )}
    </Modal>
  );
}
