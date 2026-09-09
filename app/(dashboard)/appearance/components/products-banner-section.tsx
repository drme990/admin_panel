'use client';

import { useRef } from 'react';
import Image from 'next/image';
import {
  LuArrowLeft,
  LuArrowRight,
  LuLink,
  LuTrash2,
  LuUpload,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import Dropdown from '@/components/ui/dropdown';
import Input from '@/components/ui/input';
import Tooltip from '@/components/ui/tooltip';
import {
  ProductBanner,
  ProductBannerLanguage,
  ProductBannerPlatform,
} from '@/types/Appearance';
import { useLocale } from 'next-intl';

interface ProductsBannerSectionProps {
  banners: ProductBanner[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ProductBanner>) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  title: string;
  description: string;
  emptyText: string;
  addLabel: string;
  uploadingLabel: string;
  targetLabel: string;
  languageLabel: string;
  linkLabel: string;
  linkPlaceholder: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
  deleteLabel: string;
  targetOptions: Array<{ value: ProductBannerPlatform; label: string }>;
  languageOptions: Array<{ value: ProductBannerLanguage; label: string }>;
}

export default function ProductsBannerSection({
  banners,
  uploading,
  onUpload,
  onDelete,
  onUpdate,
  onMove,
  title,
  description,
  emptyText,
  addLabel,
  uploadingLabel,
  targetLabel,
  languageLabel,
  linkLabel,
  linkPlaceholder,
  moveEarlierLabel,
  moveLaterLabel,
  deleteLabel,
  targetOptions,
  languageOptions,
}: ProductsBannerSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const tooltipPosition = isRtl ? 'left' : 'right';

  return (
    <section className="space-y-5 border border-stroke rounded-xl p-4 xs:p-5 bg-card-bg overflow-x-hidden">
      {/* Header: stacks on xs, inline on sm+ */}
      <div className="flex flex-col xs:flex-row gap-3 xs:gap-4 xs:justify-between xs:items-center">
        <div className="min-w-0">
          <h2 className="text-base xs:text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-xs xs:text-sm text-secondary mt-0.5">{description}</p>
        </div>

        <div className="shrink-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
                e.target.value = '';
              }
            }}
          />

          <Button
            variant="primary"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            size="sm"
            className="flex items-center gap-2 w-full xs:w-auto justify-center"
          >
            <LuUpload className="w-4 h-4 shrink-0" />
            {uploading ? uploadingLabel : addLabel}
          </Button>
        </div>
      </div>

      {banners.length === 0 ? (
        <div className="flex items-center justify-center py-12 border border-dashed border-stroke rounded-lg">
          <p className="text-sm text-secondary">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-150 overflow-y-auto">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="border border-stroke rounded-xl p-3 xs:p-4 bg-background"
            >
              {/* Banner row: stacks on xs, side-by-side on sm+ */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Image preview */}
                <div className="relative w-full sm:w-5/12 aspect-15/7 rounded-site overflow-hidden border border-stroke bg-card-bg shrink-0">
                  <Image
                    src={banner.imageUrl}
                    alt={`Products banner ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                  />

                  <div className="absolute inset-x-0 top-0 p-1.5 xs:p-2 bg-linear-to-b from-black/60 to-transparent">
                    <div
                      className={`flex items-center gap-1.5 xs:gap-2 ${isRtl ? 'justify-start' : 'justify-end'}`}
                    >
                      <Tooltip
                        content={moveEarlierLabel}
                        position={tooltipPosition}
                      >
                        <Button
                          variant="custom"
                          size="custom"
                          type="button"
                          onClick={() => onMove(banner.id, 'up')}
                          disabled={index === 0}
                          aria-label={moveEarlierLabel}
                          className="w-7 h-7 xs:w-8 xs:h-8 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                        >
                          <LuArrowLeft
                            className={`w-3.5 h-3.5 xs:w-4 xs:h-4 ${isRtl ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      </Tooltip>

                      <Tooltip
                        content={moveLaterLabel}
                        position={tooltipPosition}
                      >
                        <Button
                          variant="custom"
                          size="custom"
                          type="button"
                          onClick={() => onMove(banner.id, 'down')}
                          disabled={index === banners.length - 1}
                          aria-label={moveLaterLabel}
                          className="w-7 h-7 xs:w-8 xs:h-8 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                        >
                          <LuArrowRight
                            className={`w-3.5 h-3.5 xs:w-4 xs:h-4 ${isRtl ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      </Tooltip>

                      <Tooltip content={deleteLabel} position={tooltipPosition}>
                        <Button
                          variant="icon-danger"
                          size="custom"
                          onClick={() => onDelete(banner.id)}
                          aria-label={deleteLabel}
                          className="w-7 h-7 xs:w-8 xs:h-8"
                        >
                          <LuTrash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <span className="absolute top-1.5 xs:top-2 left-1.5 xs:left-2 text-sm xs:text-base bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                    #{index + 1}
                  </span>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-3 xs:gap-4 w-full sm:w-7/12 min-w-0">
                  {/* Dropdowns: stack on xs, 2 cols on sm+ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4">
                    <Dropdown
                      label={targetLabel}
                      options={targetOptions}
                      value={banner.platform}
                      onChange={(value) =>
                        onUpdate(banner.id, {
                          platform: value as ProductBannerPlatform,
                        })
                      }
                    />

                    <Dropdown
                      label={languageLabel}
                      options={languageOptions}
                      value={banner.language}
                      onChange={(value) =>
                        onUpdate(banner.id, {
                          language: value as ProductBannerLanguage,
                        })
                      }
                    />
                  </div>

                  <Input
                    label={linkLabel}
                    value={banner.link}
                    onChange={(e) =>
                      onUpdate(banner.id, {
                        link: e.target.value,
                      })
                    }
                    placeholder={linkPlaceholder}
                    suffix={<LuLink className="text-secondary" size={16} />}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
