'use client';

import { useState } from 'react';
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

interface MultiMediaUploadProps {
  media: string[];
  onChange: (media: string[]) => void;
  maxMedia?: number;
}

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

const backendBaseUrl = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
};

const getUploadEndpoint = (isVideo: boolean) => {
  if (backendBaseUrl) {
    return isVideo ? '/api/admin/upload/video' : '/api/admin/upload/image';
  }

  // Fallback to admin-panel rewrite rules in next.config.ts.
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const getDeleteEndpoint = (isVideo: boolean) => {
  if (backendBaseUrl) {
    return isVideo ? '/api/admin/upload/video' : '/api/admin/upload/image';
  }

  // Fallback to admin-panel rewrite rules in next.config.ts.
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const isVideoUrl = (url: string) => {
  return /\.(mp4|webm|mov|qt)(\?.*)?$/i.test(url) || url.includes('/videos/');
};

export default function MultiMediaUpload({
  media,
  onChange,
  maxMedia = 10,
}: MultiMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const t = useTranslations('admin.products');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxMedia - media.length;
    if (remaining <= 0) {
      toast.error(t('messages.maxMediaReached'));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);

    // Enforce first media is an image
    if (media.length === 0) {
      const hasImage = filesToUpload.some((f) => f.type.startsWith('image/'));
      if (!hasImage) {
        toast.error(t('messages.firstMediaMustBeImage'));
        return;
      }

      // Ensure the first file in queue is an image
      filesToUpload.sort((a, b) => {
        if (a.type.startsWith('image/') && !b.type.startsWith('image/'))
          return -1;
        if (!a.type.startsWith('image/') && b.type.startsWith('image/'))
          return 1;
        return 0;
      });
    }

    try {
      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const isVideo = file.type.startsWith('video/');

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          toast.error(
            t('messages.videoTooLarge', {
              size: '50MB',
            }),
          );
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        if (!isVideo) {
          formData.append('folder', 'products');
        }

        const endpoint = buildApiUrl(getUploadEndpoint(isVideo));

        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            body: formData,
            credentials: 'include',
            signal: AbortSignal.timeout(5 * 60 * 1000),
          });

          const contentType = res.headers.get('content-type') || '';
          if (!contentType.includes('application/json')) {
            const text = await res.text();
            throw new Error(
              `Upload failed with status ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
            );
          }

          const data = await res.json();
          if (res.ok && data.success) {
            uploadedUrls.push(data.data.url);
          } else {
            throw new Error(
              data.error || `Upload failed with status ${res.status}`,
            );
          }
        } catch (fileError) {
          const errorMsg =
            fileError instanceof Error ? fileError.message : 'Upload failed';
          console.error(`Error uploading ${file.name}:`, errorMsg);
          toast.error(`${file.name}: ${errorMsg}`);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...media, ...uploadedUrls]);
        toast.success(
          t('messages.mediaUploaded', { count: uploadedUrls.length }),
        );
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error(t('messages.uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const updated = media.filter((_, i) => i !== index);

    if (updated.length > 0 && isVideoUrl(updated[0])) {
      toast.error(t('messages.primaryMediaMustStayImage'));
      return;
    }

    const removedUrl = media[index];
    onChange(updated);

    // Optional: Call delete API in background to clean up storage
    try {
      const isVideo = isVideoUrl(removedUrl);
      const endpoint = buildApiUrl(getDeleteEndpoint(isVideo));
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: removedUrl }),
      });
    } catch (e) {
      console.error('Failed to delete from storage', e);
    }
  };

  const handleMoveMedia = (fromIndex: number, toIndex: number) => {
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
    <div className="space-y-3">
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

                {/* Overlay Options */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-2 rounded-md">
                  <div className="flex gap-2">
                    {index > 0 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, index - 1)}
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
                      className="p-1.5 bg-error/90 text-white hover:bg-error"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Main badge */}
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
