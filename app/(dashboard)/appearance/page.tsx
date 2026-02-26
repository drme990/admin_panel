'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { Trash2, Upload, MoveDown, MoveUp, Save } from 'lucide-react';
import { PageLoading } from '@/components/ui/loading';
import { WorksImages, ProjectName } from '@/types/Appearance';

const PROJECTS: { key: ProjectName; label: string }[] = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
];

export default function AppearancePage() {
  const t = useTranslations('admin.appearance');
  const [activeProject, setActiveProject] = useState<ProjectName>('ghadaq');
  const [images, setImages] = useState<Record<ProjectName, WorksImages>>({
    ghadaq: { row1: [], row2: [] },
    manasik: { row1: [], row2: [] },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingRow, setUploadingRow] = useState<'row1' | 'row2' | null>(
    null,
  );

  const loadAppearance = useCallback(async () => {
    setLoading(true);
    try {
      const [ghadaqRes, manasikRes] = await Promise.all([
        fetch('/api/appearance/ghadaq'),
        fetch('/api/appearance/manasik'),
      ]);
      const [ghadaqData, manasikData] = await Promise.all([
        ghadaqRes.json(),
        manasikRes.json(),
      ]);
      setImages({
        ghadaq: ghadaqData.success ? ghadaqData.data : { row1: [], row2: [] },
        manasik: manasikData.success
          ? manasikData.data
          : { row1: [], row2: [] },
      });
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAppearance();
  }, [loadAppearance]);

  const currentImages = images[activeProject];

  const handleUpload = useCallback(
    async (file: File, row: 'row1' | 'row2') => {
      setUploadingRow(row);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', 'appearance');

        const res = await fetch('/api/upload/image', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setImages((prev) => ({
          ...prev,
          [activeProject]: {
            ...prev[activeProject],
            [row]: [...prev[activeProject][row], data.data.url],
          },
        }));
      } catch {
        toast.error(t('uploadFailed'));
      } finally {
        setUploadingRow(null);
      }
    },
    [t, activeProject],
  );

  const handleDelete = (row: 'row1' | 'row2', index: number) => {
    setImages((prev) => ({
      ...prev,
      [activeProject]: {
        ...prev[activeProject],
        [row]: prev[activeProject][row].filter((_, i) => i !== index),
      },
    }));
  };

  const handleMove = (fromRow: 'row1' | 'row2', index: number) => {
    const toRow = fromRow === 'row1' ? 'row2' : 'row1';
    const imgUrl = currentImages[fromRow][index];
    setImages((prev) => ({
      ...prev,
      [activeProject]: {
        ...prev[activeProject],
        [fromRow]: prev[activeProject][fromRow].filter((_, i) => i !== index),
        [toRow]: [...prev[activeProject][toRow], imgUrl],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/appearance/${activeProject}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ worksImages: currentImages }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(t('saveSuccess'));
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {t('title')}
          </h1>
          <p className="text-secondary">{t('description')}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 gradient-site gradient-text font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? t('saving') : t('saveChanges')}
        </button>
      </div>

      {/* Project Tabs */}
      <div className="flex gap-2 border-b border-stroke">
        {PROJECTS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActiveProject(p.key)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeProject === p.key
                ? 'border-current font-bold'
                : 'border-transparent text-secondary hover:text-foreground'
            }`}
            style={
              activeProject === p.key
                ? {
                    background: 'var(--gradient-site)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }
                : undefined
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Works Images Section */}
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('worksImages')}
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            {t('worksDescription')}
          </p>
        </div>

        <ImageRowEditor
          label={t('row1')}
          images={currentImages.row1}
          row="row1"
          uploading={uploadingRow === 'row1'}
          onUpload={(file) => handleUpload(file, 'row1')}
          onDelete={(i) => handleDelete('row1', i)}
          onMove={(i) => handleMove('row1', i)}
          moveLabel={t('moveToRow2')}
          emptyText={t('noImages')}
          addLabel={t('addImage')}
          uploadingLabel={t('uploading')}
        />

        <ImageRowEditor
          label={t('row2')}
          images={currentImages.row2}
          row="row2"
          uploading={uploadingRow === 'row2'}
          onUpload={(file) => handleUpload(file, 'row2')}
          onDelete={(i) => handleDelete('row2', i)}
          onMove={(i) => handleMove('row2', i)}
          moveLabel={t('moveToRow1')}
          emptyText={t('noImages')}
          addLabel={t('addImage')}
          uploadingLabel={t('uploading')}
        />
      </div>
    </div>
  );
}

interface ImageRowEditorProps {
  label: string;
  images: string[];
  row: 'row1' | 'row2';
  uploading: boolean;
  onUpload: (file: File) => void;
  onDelete: (index: number) => void;
  onMove: (index: number) => void;
  moveLabel: string;
  emptyText: string;
  addLabel: string;
  uploadingLabel: string;
}

function ImageRowEditor({
  label,
  images,
  uploading,
  onUpload,
  onDelete,
  onMove,
  moveLabel,
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
              className="group relative aspect-3/4 rounded-lg overflow-hidden border border-stroke bg-card-bg"
            >
              <Image
                src={src}
                alt={`Work image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, 14vw"
              />
              {/* Hover overlay with actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => onMove(index)}
                  title={moveLabel}
                  className="w-8 h-8 bg-white/90 text-gray-900 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                >
                  {row === 'row1' ? (
                    <MoveDown className="w-4 h-4" />
                  ) : (
                    <MoveUp className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => onDelete(index)}
                  title="Delete"
                  className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {/* Index badge */}
              <span className="absolute top-1 inset-s-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full font-mono">
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
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-stroke rounded-lg hover:bg-muted disabled:opacity-50 transition-colors text-foreground"
        >
          <Upload className="w-4 h-4" />
          {uploading ? uploadingLabel : addLabel}
        </button>
      </div>
    </div>
  );
}
