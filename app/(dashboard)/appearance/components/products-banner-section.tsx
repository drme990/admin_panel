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
import { ProductBanner, ProductBannerTarget } from '@/types/Appearance';
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
  linkLabel: string;
  linkPlaceholder: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
  deleteLabel: string;
  targetOptions: Array<{ value: ProductBannerTarget; label: string }>;
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
  linkLabel,
  linkPlaceholder,
  moveEarlierLabel,
  moveLaterLabel,
  deleteLabel,
  targetOptions,
}: ProductsBannerSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const tooltipPosition = isRtl ? 'left' : 'right';

  return (
    <div className="space-y-5 border border-stroke rounded-xl p-5 bg-card-bg">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-secondary mt-0.5">{description}</p>
        </div>

        <div>
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
          >
            <LuUpload className="w-4 h-4" />
            {uploading ? uploadingLabel : addLabel}
          </Button>
        </div>
      </div>

      {banners.length === 0 ? (
        <div className="flex items-center justify-center py-12 border border-dashed border-stroke rounded-lg">
          <p className="text-sm text-secondary">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div
              key={banner.id}
              className="border border-stroke rounded-xl p-4 bg-background"
            >
              <div className="flex flex-row gap-4">
                <div className="relative w-5/12 aspect-15/7 rounded-site overflow-hidden border border-stroke bg-card-bg">
                  <Image
                    src={banner.imageUrl}
                    alt={`Products banner ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 800px"
                  />

                  <div className="absolute inset-x-0 top-0 p-2 bg-linear-to-b from-black/60 to-transparent">
                    <div
                      className={`flex items-center gap-2 ${isRtl ? 'justify-start' : 'justify-end'}`}
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
                          className="w-8 h-8 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                        >
                          <LuArrowLeft
                            className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`}
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
                          className="w-8 h-8 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                        >
                          <LuArrowRight
                            className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      </Tooltip>

                      <Tooltip content={deleteLabel} position={tooltipPosition}>
                        <Button
                          variant="icon-danger"
                          size="custom"
                          onClick={() => onDelete(banner.id)}
                          aria-label={deleteLabel}
                        >
                          <LuTrash2 className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <span className="absolute top-2 left-2 text-base bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                    #{index + 1}
                  </span>
                </div>

                <div className="flex flex-col gap-4 w-7/12">
                  <Dropdown
                    label={targetLabel}
                    options={targetOptions}
                    value={banner.target}
                    onChange={(value) =>
                      onUpdate(banner.id, {
                        target: value as ProductBannerTarget,
                      })
                    }
                  />

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
    </div>
  );
}
