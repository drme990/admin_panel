'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';

interface MultiImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export default function MultiImageUpload({
  images,
  onChange,
  maxImages = 10,
}: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const t = useTranslations('admin.products');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      toast.error(t('messages.maxImagesReached'));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);

    try {
      setUploading(true);
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'products');

        const res = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (data.success) {
          uploadedUrls.push(data.data.url);
        } else {
          toast.error(data.error || t('messages.uploadFailed'));
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls]);
        toast.success(
          t('messages.imagesUploaded', { count: uploadedUrls.length }),
        );
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(t('messages.uploadFailed'));
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const updated = [...images];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {t('form.productImages')}
        </label>
        <span className="text-xs text-secondary">
          {images.length}/{maxImages}
        </span>
      </div>

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, index) => (
            <div
              key={`${img}-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden border border-stroke"
            >
              <Image
                src={img}
                alt={`Product ${index + 1}`}
                fill
                className="object-cover"
                unoptimized
              />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => handleMoveImage(index, 0)}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                    title={t('form.setAsMain')}
                  >
                    <GripVertical size={14} className="text-gray-700" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="p-1.5 bg-error/90 text-white rounded-lg hover:bg-error transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {/* Main badge */}
              {index === 0 && (
                <span className="absolute top-1 inset-s-1 text-[10px] bg-success text-white px-1.5 py-0.5 rounded-full">
                  {t('form.mainImage')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < maxImages && (
        <label className="cursor-pointer block">
          <div className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-stroke rounded-lg hover:border-success transition-colors">
            {uploading ? (
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-5 h-5 border-2 border-success border-t-transparent rounded-full animate-spin" />
                <span>{t('buttons.uploading')}</span>
              </div>
            ) : (
              <>
                <Plus size={20} className="text-secondary" />
                <span className="text-secondary">{t('form.addImages')}</span>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
            multiple
            disabled={uploading}
          />
        </label>
      )}

      <p className="text-xs text-secondary">{t('form.imageHelp')}</p>
    </div>
  );
}
