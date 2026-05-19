'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';

import {
  BannerText,
  WorksImages,
  ProjectName,
  AudioReview,
  DocumentationAnswer,
  ProductBanner,
  ProductBannerTarget,
} from '@/types/Appearance';
import { PageLoading } from '@/components/ui/loading';
import Button from '@/components/ui/button';
import Tabs from '@/components/ui/tabs';
import { setAudioAsMain } from '@/lib/audio-main-logic';
import UploadProgressDisplay from '@/components/admin/upload-progress-display';
import AudioReviewsSection from './components/audio-reviews-section';
import BannerTextEditor from './components/banner-text-editor';
import WhatsAppMessageEditor from './components/whatsapp-message-editor';
import WorksImagesSection from './components/works-images-section';
import DocumentationSection from './components/documentation-section';
import ProductsBannerSection from './components/products-banner-section';
import { useMultipleAudioUpload } from '@/hooks/use-multiple-audio-upload';

import { toast } from 'react-toastify';

import { LuSave as Save } from 'react-icons/lu';

type AppearanceApiResponse = {
  success?: boolean;
  data?: {
    worksImages?: WorksImages;
    whatsAppDefaultMessage?: string;
    bannerText?: unknown;
    audioReviews?: unknown;
    documentationAnswer?: unknown;
    productsBanners?: unknown;
  };
};

const PROJECTS: { key: ProjectName; label: string }[] = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
  { key: 'shared', label: 'Shared' },
];

const PROJECT_TAB_OPTIONS: Array<{ value: ProjectName; label: string }> =
  PROJECTS.map((project) => ({
    value: project.key,
    label: project.label,
  }));

const EMPTY_BANNER_TEXT: BannerText = { ar: '', en: '' };
const EMPTY_DOCUMENTATION_ANSWER: DocumentationAnswer = { ar: '', en: '' };

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

function normalizeAudioReviews(value: unknown): AudioReview[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AudioReview =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as AudioReview).id === 'string' &&
      typeof (item as AudioReview).url === 'string',
  );
}

function normalizeProductsBanners(value: unknown): ProductBanner[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const raw = item as {
        id?: unknown;
        imageUrl?: unknown;
        target?: unknown;
        link?: unknown;
      };

      const id = typeof raw.id === 'string' ? raw.id.trim() : '';
      const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl : '';
      const target =
        raw.target === 'ghadaq' ||
        raw.target === 'manasik' ||
        raw.target === 'both'
          ? raw.target
          : 'both';
      const link = typeof raw.link === 'string' ? raw.link : '';

      if (!id || !imageUrl) return null;

      return {
        id,
        imageUrl,
        target,
        link,
      } as ProductBanner;
    })
    .filter((item): item is ProductBanner => Boolean(item));
}

function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export default function AppearancePage() {
  const t = useTranslations('admin.appearance');
  const [activeProject, setActiveProject] = useState<ProjectName>('ghadaq');
  const [images, setImages] = useState<Record<ProjectName, WorksImages>>({
    ghadaq: { row1: [], row2: [] },
    manasik: { row1: [], row2: [] },
    shared: { row1: [], row2: [] },
  });
  const [audioReviews, setAudioReviews] = useState<AudioReview[]>([]);
  const [defaultMessages, setDefaultMessages] = useState<
    Record<ProjectName, string>
  >({
    ghadaq: '',
    manasik: '',
    shared: '',
  });
  const [bannerTexts, setBannerTexts] = useState<
    Record<ProjectName, BannerText>
  >({
    ghadaq: EMPTY_BANNER_TEXT,
    manasik: EMPTY_BANNER_TEXT,
    shared: EMPTY_BANNER_TEXT,
  });
  const [documentationAnswers, setDocumentationAnswers] = useState<
    Record<ProjectName, DocumentationAnswer>
  >({
    ghadaq: EMPTY_DOCUMENTATION_ANSWER,
    manasik: EMPTY_DOCUMENTATION_ANSWER,
    shared: EMPTY_DOCUMENTATION_ANSWER,
  });
  const [productsBanners, setProductsBanners] = useState<ProductBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingRow, setUploadingRow] = useState<'row1' | 'row2' | null>(
    null,
  );
  const [uploadingProductBanner, setUploadingProductBanner] = useState(false);

  const handleAudioUploaded = useCallback((url: string) => {
    setAudioReviews((prev) => [
      ...prev,
      {
        id: generateId(),
        url,
        nameAr: 'مستخدم',
        nameEn: 'User',
        userImage: '',
        platform: 'shared',
        language: 'shared',
        isMain: false,
      },
    ]);
  }, []);

  const {
    uploading: uploadingAudio,
    uploadState: audioUploadProgress,
    handleFileSelect: handleMultipleAudioUpload,
    cancelUpload: handleCancelAudioUpload,
  } = useMultipleAudioUpload({
    t,
    onUploaded: handleAudioUploaded,
  });

  const loadAppearance = useCallback(async () => {
    setLoading(true);
    try {
      const projectKeys = PROJECTS.map((project) => project.key);
      const responses = await Promise.all(
        projectKeys.map((project) => fetch(`/api/appearance/${project}`)),
      );
      const payloads = (await Promise.all(
        responses.map((response) => response.json()),
      )) as AppearanceApiResponse[];

      const byProject = projectKeys.reduce(
        (acc, project, index) => {
          acc[project] = payloads[index];
          return acc;
        },
        {} as Record<ProjectName, AppearanceApiResponse>,
      );

      setImages({
        ghadaq:
          byProject.ghadaq?.success && byProject.ghadaq.data?.worksImages
            ? byProject.ghadaq.data.worksImages
            : { row1: [], row2: [] },
        manasik:
          byProject.manasik?.success && byProject.manasik.data?.worksImages
            ? byProject.manasik.data.worksImages
            : { row1: [], row2: [] },
        shared:
          byProject.shared?.success && byProject.shared.data?.worksImages
            ? byProject.shared.data.worksImages
            : { row1: [], row2: [] },
      });

      // Combine audio reviews from all projects into a single array
      const allAudioReviews: AudioReview[] = [];
      (['ghadaq', 'manasik', 'shared'] as ProjectName[]).forEach((project) => {
        const projectData = byProject[project];
        if (projectData?.success && projectData.data?.audioReviews) {
          const normalized = normalizeAudioReviews(
            projectData.data.audioReviews,
          );
          // If audio doesn't have platform set, default to the project it came from
          normalized.forEach((audio) => {
            if (!audio.platform) {
              audio.platform = project === 'shared' ? 'shared' : project;
            }
          });
          allAudioReviews.push(...normalized);
        }
      });
      setAudioReviews(allAudioReviews);

      setDefaultMessages({
        ghadaq:
          byProject.ghadaq?.success &&
          typeof byProject.ghadaq.data?.whatsAppDefaultMessage === 'string'
            ? byProject.ghadaq.data.whatsAppDefaultMessage
            : '',
        manasik:
          byProject.manasik?.success &&
          typeof byProject.manasik.data?.whatsAppDefaultMessage === 'string'
            ? byProject.manasik.data.whatsAppDefaultMessage
            : '',
        shared:
          byProject.shared?.success &&
          typeof byProject.shared.data?.whatsAppDefaultMessage === 'string'
            ? byProject.shared.data.whatsAppDefaultMessage
            : '',
      });

      setBannerTexts({
        ghadaq: byProject.ghadaq?.success
          ? normalizeBannerText(byProject.ghadaq.data?.bannerText)
          : EMPTY_BANNER_TEXT,
        manasik: byProject.manasik?.success
          ? normalizeBannerText(byProject.manasik.data?.bannerText)
          : EMPTY_BANNER_TEXT,
        shared: byProject.shared?.success
          ? normalizeBannerText(byProject.shared.data?.bannerText)
          : EMPTY_BANNER_TEXT,
      });

      setDocumentationAnswers({
        ghadaq: byProject.ghadaq?.success
          ? normalizeBannerText(byProject.ghadaq.data?.documentationAnswer)
          : EMPTY_DOCUMENTATION_ANSWER,
        manasik: byProject.manasik?.success
          ? normalizeBannerText(byProject.manasik.data?.documentationAnswer)
          : EMPTY_DOCUMENTATION_ANSWER,
        shared: byProject.shared?.success
          ? normalizeBannerText(byProject.shared.data?.documentationAnswer)
          : EMPTY_DOCUMENTATION_ANSWER,
      });

      setProductsBanners(
        byProject.shared?.success
          ? normalizeProductsBanners(byProject.shared.data?.productsBanners)
          : [],
      );
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
  const isSharedTab = activeProject === 'shared';

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

  const handleDeleteImage = (row: 'row1' | 'row2', index: number) => {
    setImages((prev) => ({
      ...prev,
      [activeProject]: {
        ...prev[activeProject],
        [row]: prev[activeProject][row].filter((_, i) => i !== index),
      },
    }));
  };

  const handleDeleteAudio = async (id: string) => {
    const audio = audioReviews.find((a) => a.id === id);
    if (!audio) return;

    setAudioReviews((prev) => prev.filter((a) => a.id !== id));

    try {
      await fetch('/api/upload/audio', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: audio.url }),
      });
    } catch {
      // best effort cleanup
    }
  };

  const handleAudioUpdate = (id: string, updates: Partial<AudioReview>) => {
    setAudioReviews((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };

  const handleAudioSetMain = (id: string) => {
    setAudioReviews((prev) => setAudioAsMain(prev, id));
  };

  const handleUploadProductBanner = useCallback(
    async (file: File) => {
      setUploadingProductBanner(true);
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

        setProductsBanners((prev) => [
          ...prev,
          {
            id: generateId(),
            imageUrl: data.data.url,
            target: 'both',
            link: '',
          },
        ]);
      } catch {
        toast.error(t('uploadFailed'));
      } finally {
        setUploadingProductBanner(false);
      }
    },
    [t],
  );

  const handleDeleteProductBanner = useCallback((id: string) => {
    setProductsBanners((prev) => prev.filter((banner) => banner.id !== id));
  }, []);

  const handleUpdateProductBanner = useCallback(
    (id: string, updates: Partial<ProductBanner>) => {
      setProductsBanners((prev) =>
        prev.map((banner) =>
          banner.id === id ? { ...banner, ...updates } : banner,
        ),
      );
    },
    [],
  );

  const handleMoveProductBanner = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setProductsBanners((prev) => {
        const index = prev.findIndex((banner) => banner.id === id);
        if (index === -1) return prev;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= prev.length) return prev;

        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    },
    [],
  );

  const productBannerTargetOptions: Array<{
    value: ProductBannerTarget;
    label: string;
  }> = [
    { value: 'ghadaq', label: t('productsBannerTargetGhadaq') },
    { value: 'manasik', label: t('productsBannerTargetManasik') },
    { value: 'both', label: t('productsBannerTargetBoth') },
  ];

  const handleMoveImage = (fromRow: 'row1' | 'row2', index: number) => {
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

  const handleReorderImage = (
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
      const responses = await Promise.all(
        PROJECTS.map(async ({ key }) => {
          const isShared = key === 'shared';
          const res = await fetch(`/api/appearance/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              worksImages: images[key],
              // Save all audio reviews to the shared project only,
              // and explicitly clear from others to avoid old data lingering
              audioReviews: isShared ? audioReviews : [],
              whatsAppDefaultMessage: defaultMessages[key],
              bannerText: bannerTexts[key],
              documentationAnswer: documentationAnswers[key],
              productsBanners: isShared ? productsBanners : [],
            }),
          });

          const data = await res.json();
          return { key, ok: res.ok, data };
        }),
      );

      const failed = responses.find(
        (result) => !result.ok || !result.data?.success,
      );

      if (failed) {
        throw new Error(failed.key);
      }

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

      <div className="border-b border-stroke pb-3">
        <Tabs
          value={activeProject}
          options={PROJECT_TAB_OPTIONS}
          onChange={setActiveProject}
        />
      </div>

      {!isSharedTab && (
        <WorksImagesSection
          images={currentImages}
          uploadingRow={uploadingRow}
          onUploadRow1={(file) => handleUpload(file, 'row1')}
          onUploadRow2={(file) => handleUpload(file, 'row2')}
          onDeleteRow1={(i) => handleDeleteImage('row1', i)}
          onDeleteRow2={(i) => handleDeleteImage('row2', i)}
          onMoveRow1={(i) => handleMoveImage('row1', i)}
          onMoveRow2={(i) => handleMoveImage('row2', i)}
          onReorderUpRow1={(i) => handleReorderImage('row1', i, 'up')}
          onReorderDownRow1={(i) => handleReorderImage('row1', i, 'down')}
          onReorderUpRow2={(i) => handleReorderImage('row2', i, 'up')}
          onReorderDownRow2={(i) => handleReorderImage('row2', i, 'down')}
          title={t('worksImages')}
          description={t('worksDescription')}
          row1Label={t('row1')}
          row2Label={t('row2')}
          moveToRow2Label={t('moveToRow2')}
          moveToRow1Label={t('moveToRow1')}
          moveEarlierLabel={t('moveEarlier')}
          moveLaterLabel={t('moveLater')}
          noImagesLabel={t('noImages')}
          addImageLabel={t('addImage')}
          uploadingLabel={t('uploading')}
        />
      )}

      {isSharedTab && (
        <>
          <UploadProgressDisplay
            uploadProgress={audioUploadProgress}
            onCancel={handleCancelAudioUpload}
            cancelDisabled={!uploadingAudio}
          />

          <AudioReviewsSection
            audioReviews={audioReviews}
            uploading={uploadingAudio}
            onUpload={handleMultipleAudioUpload}
            onDelete={handleDeleteAudio}
            onUpdate={handleAudioUpdate}
            onSetMain={handleAudioSetMain}
            onRemoveImage={(id) => handleAudioUpdate(id, { userImage: '' })}
            t={t}
          />

          <ProductsBannerSection
            banners={productsBanners}
            uploading={uploadingProductBanner}
            onUpload={handleUploadProductBanner}
            onDelete={handleDeleteProductBanner}
            onUpdate={handleUpdateProductBanner}
            onMove={handleMoveProductBanner}
            title={t('productsBannerTitle')}
            description={t('productsBannerDescription')}
            emptyText={t('productsBannerEmpty')}
            addLabel={t('productsBannerAddImage')}
            uploadingLabel={t('uploading')}
            targetLabel={t('productsBannerTargetLabel')}
            linkLabel={t('productsBannerLinkLabel')}
            linkPlaceholder={t('productsBannerLinkPlaceholder')}
            moveEarlierLabel={t('moveEarlier')}
            moveLaterLabel={t('moveLater')}
            deleteLabel={t('productsBannerDelete')}
            targetOptions={productBannerTargetOptions}
          />

          <DocumentationSection
            value={documentationAnswers[activeProject]}
            onChange={(value) =>
              setDocumentationAnswers((prev) => ({
                ...prev,
                [activeProject]: value,
              }))
            }
            title={t('documentationTitle')}
            description={t('documentationDescription')}
            labelAr={t('documentationLabelAr')}
            labelEn={t('documentationLabelEn')}
            placeholderAr={t('documentationPlaceholderAr')}
            placeholderEn={t('documentationPlaceholderEn')}
          />
        </>
      )}

      {!isSharedTab && (
        <>
          <BannerTextEditor
            value={bannerTexts[activeProject]}
            onChange={(value) =>
              setBannerTexts((prev) => ({
                ...prev,
                [activeProject]: value,
              }))
            }
            title={t('bannerTitle')}
            description={t('bannerDescription')}
            labelAr={t('bannerLabelAr')}
            labelEn={t('bannerLabelEn')}
            placeholderAr={t('bannerPlaceholderAr')}
            placeholderEn={t('bannerPlaceholderEn')}
          />

          <WhatsAppMessageEditor
            value={defaultMessages[activeProject]}
            onChange={(value) =>
              setDefaultMessages((prev) => ({
                ...prev,
                [activeProject]: value,
              }))
            }
            title={t('whatsAppTitle')}
            description={t('whatsAppDescription')}
            labelMessage={t('whatsAppDefaultMessageLabel')}
            placeholder={t('whatsAppDefaultMessagePlaceholder')}
          />
        </>
      )}
    </div>
  );
}
