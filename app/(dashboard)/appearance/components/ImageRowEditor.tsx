'use client';

import { useRef } from 'react';
import Image from 'next/image';
import {
  LuTrash2 as Trash2,
  LuUpload as Upload,
  LuMoveDown as MoveDown,
  LuMoveUp as MoveUp,
  LuArrowLeft as ArrowLeft,
  LuArrowRight as ArrowRight,
} from 'react-icons/lu';
import Button from '@/components/ui/button';

interface ImageRowEditorProps {
  label: string;
  images: string[];
  row: 'row1' | 'row2';
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (index: number) => void;
  onMove: (index: number) => void;
  onReorderUp: (index: number) => void;
  onReorderDown: (index: number) => void;
  moveLabel: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
  emptyText: string;
  addLabel: string;
  uploadingLabel: string;
}

export function ImageRowEditor({
  label,
  images,
  uploading,
  onUpload,
  onDelete,
  onMove,
  onReorderUp,
  onReorderDown,
  moveLabel,
  moveEarlierLabel,
  moveLaterLabel,
  emptyText,
  addLabel,
  uploadingLabel,
  row,
}: ImageRowEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="border border-stroke rounded-xl p-5 space-y-4 bg-card-bg">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground text-sm">{label}</h3>
        <span className="text-xs text-secondary bg-muted px-2.5 py-1 rounded-full">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="flex items-center justify-center py-12 border border-dashed border-stroke rounded-lg">
          <p className="text-sm text-secondary">{emptyText}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-3">
          {images.map((src, index) => (
            <div
              key={`${row}-${index}-${src}`}
              className="relative aspect-3/4 rounded-lg overflow-hidden border border-stroke bg-card-bg"
            >
              <Image
                src={src}
                alt={`Work image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 14vw"
              />

              <div className="absolute top-0 inset-x-0 flex items-center justify-between p-1.5 bg-linear-to-b from-black/60 to-transparent">
                <div className="flex gap-1">
                  <Button
                    variant="custom"
                    size="custom"
                    onClick={() => onReorderUp(index)}
                    title={moveEarlierLabel}
                    disabled={index === 0}
                    className="w-7 h-7 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Button>

                  <Button
                    variant="custom"
                    size="custom"
                    onClick={() => onReorderDown(index)}
                    title={moveLaterLabel}
                    disabled={index === images.length - 1}
                    className="w-7 h-7 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white disabled:opacity-40"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="custom"
                    size="custom"
                    onClick={() => onMove(index)}
                    title={moveLabel}
                    className="w-7 h-7 bg-white/90 text-gray-900 rounded-md flex items-center justify-center hover:bg-white"
                  >
                    {row === 'row1' ? (
                      <MoveDown className="w-3.5 h-3.5" />
                    ) : (
                      <MoveUp className="w-3.5 h-3.5" />
                    )}
                  </Button>

                  <Button
                    variant="custom"
                    size="custom"
                    onClick={() => onDelete(index)}
                    title="Delete"
                    className="w-7 h-7 bg-red-500 text-white rounded-md flex items-center justify-center hover:bg-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <span className="absolute bottom-1 left-1 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded font-mono">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

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
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-stroke rounded-lg hover:bg-muted disabled:opacity-50 transition-colors text-foreground"
        >
          <Upload className="w-4 h-4" />
          {uploading ? uploadingLabel : addLabel}
        </Button>
      </div>
    </div>
  );
}
