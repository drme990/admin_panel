'use client';

import Image from 'next/image';
import {
  LuPlus as Plus,
  LuTrash2 as Trash2,
  LuGripVertical as GripVertical,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuVideo as VideoIcon,
} from 'react-icons/lu';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Button from '@/components/ui/button';
import {
  useMediaUpload,
  type UploadProgressState,
} from '@/hooks/use-media-upload';

export type { UploadProgressState } from '@/hooks/use-media-upload';

interface MultiMediaUploadProps {
  media: string[];
  onChange: (media: string[]) => void;
  maxMedia?: number;
  onUploadProgressChange?: (state: UploadProgressState) => void;
  onCancelUploadReady?: (cancelUpload: (() => void) | null) => void;
}

const backendBaseUrl = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
};

const getDeleteEndpoint = (isVideo: boolean) => {
  if (backendBaseUrl) {
    return isVideo ? '/api/admin/upload/video' : '/api/admin/upload/image';
  }
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const isVideoUrl = (url: string) => {
  return /\.(mp4|webm|mov|qt)(\?.*)?$/i.test(url) || url.includes('/videos/');
};

export default function MultiMediaUpload({
  media,
  onChange,
  maxMedia = 10,
  onUploadProgressChange,
  onCancelUploadReady,
}: MultiMediaUploadProps) {
  const t = useTranslations('admin.products');
  const { uploading, handleFileSelect } = useMediaUpload({
    media,
    onChange,
    maxMedia,
    t,
    onUploadProgressChange,
    onCancelUploadReady,
  });

  const handleRemoveMedia = async (index: number) => {
    if (uploading) return;

    const updated = media.filter((_, i) => i !== index);

    if (updated.length > 0 && isVideoUrl(updated[0])) {
      toast.error(t('messages.primaryMediaMustStayImage'));
      return;
    }

    const removedUrl = media[index];
    onChange(updated);

    try {
      const isVideo = isVideoUrl(removedUrl);
      const endpoint = buildApiUrl(getDeleteEndpoint(isVideo));
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: removedUrl }),
      });
    } catch {
      // Silently fail on deletion
    }
  };

  const handleMoveMedia = (fromIndex: number, toIndex: number) => {
    if (uploading) return;
    if (toIndex < 0 || toIndex >= media.length) return;

    const updated = [...media];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    if (updated.length > 0 && isVideoUrl(updated[0])) {
      toast.error(t('messages.firstMediaMustBeImage'));
      return;
    }

    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {t('form.productMedia')}
        </label>
        <span className="text-xs text-secondary">
          {media.length}/{maxMedia}
        </span>
      </div>

      {/* Media Grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((mediaUrl, index) => {
            const isVideo = isVideoUrl(mediaUrl);
            return (
              <div
                key={`${mediaUrl}-${index}`}
                className="relative group aspect-square rounded-lg overflow-hidden border border-stroke bg-gray-50 flex items-center justify-center p-1"
              >
                {isVideo ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black rounded-md overflow-hidden">
                    <video
                      src={mediaUrl}
                      className="object-cover w-full h-full"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                      <VideoIcon
                        size={32}
                        className="text-white drop-shadow-md"
                      />
                    </div>
                  </div>
                ) : (
                  <Image
                    src={mediaUrl}
                    alt={`Product ${index + 1}`}
                    fill
                    className="object-cover rounded-md"
                    unoptimized
                  />
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-2 rounded-md">
                  <div className="flex gap-2">
                    {index > 0 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, index - 1)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.moveLeft')}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                    )}
                    {index < media.length - 1 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, index + 1)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.moveRight')}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {index > 0 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, 0)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.setAsMain') || 'Set as Main'}
                      >
                        <GripVertical size={16} />
                      </Button>
                    )}
                    <Button
                      variant="icon-danger"
                      size="custom"
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      disabled={uploading}
                      className="p-1.5 bg-error/90 text-white hover:bg-error"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {index === 0 && (
                  <span className="absolute top-2 inset-start-2 text-[10px] bg-success text-white px-2 py-0.5 rounded-full z-10 shadow-sm pointer-events-none">
                    {t('form.mainImage') || 'Main Thumbnail'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Button */}
      {media.length < maxMedia && (
        <label className="cursor-pointer block">
          <div className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-stroke rounded-lg hover:border-success transition-colors">
            {uploading ? (
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-5 h-5 border-2 border-success border-t-transparent rounded-full animate-spin" />
                <span>{t('buttons.uploading') || 'Uploading...'}</span>
              </div>
            ) : (
              <>
                <Plus size={20} className="text-secondary" />
                <span className="text-secondary">{t('form.addMedia')}</span>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/ogg"
            onChange={handleFileSelect}
            className="hidden"
            multiple
            disabled={uploading}
          />
        </label>
      )}

      <p className="text-xs text-secondary">{t('form.mediaHelp')}</p>
    </div>
  );
}
