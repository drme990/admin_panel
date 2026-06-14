'use client';

import Image from 'next/image';
import Modal from './modal';
import { useTranslations } from 'next-intl';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
}

export default function PreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}: PreviewModalProps) {
  const t = useTranslations('admin.storageManager.preview');

  const getMediaType = () => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    if (
      ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)
    ) {
      return 'image';
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
      return 'audio';
    }
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
      return 'video';
    }

    return 'unsupported';
  };

  const mediaType = getMediaType();

  const renderContent = () => {
    switch (mediaType) {
      case 'image':
        return (
          <div className="flex items-center justify-center min-h-100">
            <Image
              src={fileUrl}
              alt={fileName}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
              width={800}
              height={600}
              unoptimized
            />
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center min-h-75 gap-6">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-4xl">🎵</span>
            </div>
            <audio controls src={fileUrl} className="w-full max-w-md">
              Your browser does not support the audio element.
            </audio>
            <p className="text-muted-foreground text-center">{fileName}</p>
          </div>
        );

      case 'video':
        return (
          <div className="flex items-center justify-center min-h-100">
            <video
              controls
              src={fileUrl}
              className="max-w-full max-h-[70vh] rounded-lg"
            >
              Your browser does not support the video element.
            </video>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-75 gap-4">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
              <span className="text-4xl">📄</span>
            </div>
            <p className="text-muted-foreground text-center">
              {t('unsupported')}
            </p>
            <p className="text-sm text-muted-foreground text-center">
              {fileName}
            </p>
          </div>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('title')} size="xl">
      {renderContent()}
    </Modal>
  );
}
