'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Image from 'next/image';
import {
  LuTrash2 as Trash2,
  LuUpload as Upload,
  LuMoveDown as MoveDown,
  LuMoveUp as MoveUp,
  LuArrowLeft as ArrowLeft,
  LuArrowRight as ArrowRight,
  LuSave as Save,
} from 'react-icons/lu';
import { PageLoading } from '@/components/ui/loading';
import Button from '@/components/ui/button';
import Tabs from '@/components/ui/tabs';
import { BannerText, WorksImages, ProjectName } from '@/types/Appearance';

const PROJECTS: { key: ProjectName; label: string }[] = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
];

const PROJECT_TAB_OPTIONS: Array<{ value: ProjectName; label: string }> =
  PROJECTS.map((project) => ({
    value: project.key,
    label: project.label,
  }));

const EMPTY_BANNER_TEXT: BannerText = { ar: '', en: '' };

function normalizeBannerText(value: unknown): BannerText {
  if (typeof value === 'string') {
    return { ar: value, en: value };
  }

  const raw = value as { ar?: unknown; en?: unknown } | undefined;
  return {
    ar: typeof raw?.ar === 'string' ? raw.ar : '',
    en: typeof raw?.en === 'string' ? raw.en : '',
  };
}

export default function AppearancePage() {
  const t = useTranslations('admin.appearance');
  const [activeProject, setActiveProject] = useState<ProjectName>('ghadaq');
  const [images, setImages] = useState<Record<ProjectName, WorksImages>>({
    ghadaq: { row1: [], row2: [] },
    manasik: { row1: [], row2: [] },
  });
  const [defaultMessages, setDefaultMessages] = useState<
    Record<ProjectName, string>
  >({
    ghadaq: '',
    manasik: '',
  });
  const [bannerTexts, setBannerTexts] = useState<
    Record<ProjectName, BannerText>
  >({
    ghadaq: EMPTY_BANNER_TEXT,
    manasik: EMPTY_BANNER_TEXT,
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
        ghadaq:
          ghadaqData.success && ghadaqData.data?.worksImages
            ? ghadaqData.data.worksImages
            : { row1: [], row2: [] },
        manasik:
          manasikData.success && manasikData.data?.worksImages
            ? manasikData.data.worksImages
            : { row1: [], row2: [] },
      });
      setDefaultMessages({
        ghadaq:
          ghadaqData.success &&
          typeof ghadaqData.data?.whatsAppDefaultMessage === 'string'
            ? ghadaqData.data.whatsAppDefaultMessage
            : '',
        manasik:
          manasikData.success &&
          typeof manasikData.data?.whatsAppDefaultMessage === 'string'
            ? manasikData.data.whatsAppDefaultMessage
            : '',
      });
      setBannerTexts({
        ghadaq: ghadaqData.success
          ? normalizeBannerText(ghadaqData.data?.bannerText)
          : EMPTY_BANNER_TEXT,
        manasik: manasikData.success
          ? normalizeBannerText(manasikData.data?.bannerText)
          : EMPTY_BANNER_TEXT,
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
  const currentMessage = defaultMessages[activeProject] || '';
  const currentBannerText = bannerTexts[activeProject] || EMPTY_BANNER_TEXT;

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

  const handleReorderWithinRow = (
    row: 'row1' | 'row2',
    index: number,
    direction: 'up' | 'down',
  ) => {
    setImages((prev) => {
      const currentRow = [...prev[activeProject][row]];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;

      if (targetIndex < 0 || targetIndex >= currentRow.length) {
        return prev;
      }

      const [moved] = currentRow.splice(index, 1);
      currentRow.splice(targetIndex, 0, moved);

      return {
        ...prev,
        [activeProject]: {
          ...prev[activeProject],
          [row]: currentRow,
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/appearance/${activeProject}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksImages: currentImages,
          whatsAppDefaultMessage: currentMessage,
          bannerText: {
            ar: currentBannerText.ar,
            en: currentBannerText.en,
          },
        }),
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
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 shrink-0"
        >
          <Save className="w-4 h-4" />
          {saving ? t('saving') : t('saveChanges')}
        </Button>
      </div>

      {/* Project Tabs */}
      <div className="border-b border-stroke pb-3">
        <Tabs
          value={activeProject}
          options={PROJECT_TAB_OPTIONS}
          onChange={setActiveProject}
        />
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
          onReorderUp={(i) => handleReorderWithinRow('row1', i, 'up')}
          onReorderDown={(i) => handleReorderWithinRow('row1', i, 'down')}
          moveLabel={t('moveToRow2')}
          moveEarlierLabel={t('moveEarlier')}
          moveLaterLabel={t('moveLater')}
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
          onReorderUp={(i) => handleReorderWithinRow('row2', i, 'up')}
          onReorderDown={(i) => handleReorderWithinRow('row2', i, 'down')}
          moveLabel={t('moveToRow1')}
          moveEarlierLabel={t('moveEarlier')}
          moveLaterLabel={t('moveLater')}
          emptyText={t('noImages')}
          addLabel={t('addImage')}
          uploadingLabel={t('uploading')}
        />
      </div>

      <div className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('bannerTitle')}
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            {t('bannerDescription')}
          </p>
        </div>

        <label className="block text-sm font-medium text-foreground">
          {t('bannerLabelAr')}
        </label>
        <textarea
          value={currentBannerText.ar}
          onChange={(e) =>
            setBannerTexts((prev) => ({
              ...prev,
              [activeProject]: {
                ...prev[activeProject],
                ar: e.target.value,
              },
            }))
          }
          rows={3}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={t('bannerPlaceholderAr')}
        />

        <label className="block text-sm font-medium text-foreground">
          {t('bannerLabelEn')}
        </label>
        <textarea
          value={currentBannerText.en}
          onChange={(e) =>
            setBannerTexts((prev) => ({
              ...prev,
              [activeProject]: {
                ...prev[activeProject],
                en: e.target.value,
              },
            }))
          }
          rows={3}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={t('bannerPlaceholderEn')}
        />
      </div>

      {/* WhatsApp Section */}
      <div className="space-y-3 border border-stroke rounded-xl p-5 bg-card-bg">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('whatsAppTitle')}
          </h2>
          <p className="text-sm text-secondary mt-0.5">
            {t('whatsAppDescription')}
          </p>
        </div>

        <label className="block text-sm font-medium text-foreground">
          {t('whatsAppDefaultMessageLabel')}
        </label>
        <textarea
          value={currentMessage}
          onChange={(e) =>
            setDefaultMessages((prev) => ({
              ...prev,
              [activeProject]: e.target.value,
            }))
          }
          rows={4}
          className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={t('whatsAppDefaultMessagePlaceholder')}
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
  onReorderUp: (index: number) => void;
  onReorderDown: (index: number) => void;
  moveLabel: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
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

              {/* Top Controls Bar */}
              <div className="absolute top-0 inset-x-0 flex items-center justify-between p-1.5 bg-linear-to-b from-black/60 to-transparent">
                {/* Left: Reorder */}
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

                {/* Right: Move + Delete */}
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

              {/* Index Badge */}
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
