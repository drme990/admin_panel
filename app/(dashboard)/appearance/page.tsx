'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import { LuSave as Save } from 'react-icons/lu';
import { PageLoading } from '@/components/ui/loading';
import Button from '@/components/ui/button';
import Tabs from '@/components/ui/tabs';
import UploadProgressDisplay from '@/components/admin/upload-progress-display';
import { useAudioUpload } from '@/hooks/use-audio-upload';
import { BannerText, WorksImages, ProjectName } from '@/types/Appearance';
import { AudioReviewsSection } from './components/AudioReviewsSection';
import { BannerTextEditor } from './components/BannerTextEditor';
import { WhatsAppMessageEditor } from './components/WhatsAppMessageEditor';
import { WorksImagesSection } from './components/WorksImagesSection';

type AppearanceApiResponse = {
  success?: boolean;
  data?: {
    worksImages?: WorksImages;
    whatsAppDefaultMessage?: string;
    bannerText?: unknown;
    audioReviews?: unknown;
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

function normalizeAudioReviews(value: unknown): { ar: string[]; en: string[] } {
  const raw = value as { ar?: unknown; en?: unknown } | undefined;

  const ar = Array.isArray(raw?.ar)
    ? raw.ar.filter((item): item is string => typeof item === 'string')
    : [];

  const en = Array.isArray(raw?.en)
    ? raw.en.filter((item): item is string => typeof item === 'string')
    : [];

  // Fallback for old format (array of strings)
  if (Array.isArray(value) && ar.length === 0 && en.length === 0) {
    return {
      ar: value.filter((item): item is string => typeof item === 'string'),
      en: [],
    };
  }

  return { ar, en };
}

function getAllAudiosForLang(
  audioReviews: Record<ProjectName, { ar: string[]; en: string[] }>,
  lang: 'ar' | 'en',
) {
  return PROJECTS.flatMap((project) =>
    audioReviews[project.key][lang].map((url) => ({
      url,
      project: project.key,
      lang,
    })),
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
  const [audioReviews, setAudioReviews] = useState<
    Record<ProjectName, { ar: string[]; en: string[] }>
  >({
    ghadaq: { ar: [], en: [] },
    manasik: { ar: [], en: [] },
    shared: { ar: [], en: [] },
  });
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingRow, setUploadingRow] = useState<'row1' | 'row2' | null>(
    null,
  );

  const onAudioUploadedRef = useRef<(url: string) => void>(() => {});

  const handleAudioUploaded = useCallback((url: string, lang: 'ar' | 'en') => {
    setAudioReviews((prev) => ({
      ...prev,
      shared: {
        ...prev.shared,
        [lang]: [...prev.shared[lang], url],
      },
    }));
  }, []);

  const {
    uploading: uploadingAudio,
    uploadState: audioUploadState,
    handleFileSelect: handleAudioFileSelect,
    cancelUpload: cancelAudioUpload,
  } = useAudioUpload({
    t,
    onUploaded: (url) => onAudioUploadedRef.current(url),
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

      setAudioReviews({
        ghadaq: byProject.ghadaq?.success
          ? normalizeAudioReviews(byProject.ghadaq.data?.audioReviews)
          : { ar: [], en: [] },
        manasik: byProject.manasik?.success
          ? normalizeAudioReviews(byProject.manasik.data?.audioReviews)
          : { ar: [], en: [] },
        shared: byProject.shared?.success
          ? normalizeAudioReviews(byProject.shared.data?.audioReviews)
          : { ar: [], en: [] },
      });

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

  const handleDeleteAudio = async (globalIndex: number, lang: 'ar' | 'en') => {
    const allAudios = getAllAudiosForLang(audioReviews, lang);
    const audio = allAudios[globalIndex];
    if (!audio) return;

    setAudioReviews((prev) => ({
      ...prev,
      [audio.project]: {
        ...prev[audio.project],
        [lang]: prev[audio.project][lang].filter((url) => url !== audio.url),
      },
    }));

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

  const handleAudioPlatformChange = (
    globalIndex: number,
    targetProject: ProjectName,
    lang: 'ar' | 'en',
  ) => {
    const allAudios = getAllAudiosForLang(audioReviews, lang);
    const audio = allAudios[globalIndex];
    if (!audio || audio.project === targetProject) return;

    setAudioReviews((prev) => ({
      ...prev,
      [audio.project]: {
        ...prev[audio.project],
        [lang]: prev[audio.project][lang].filter((url) => url !== audio.url),
      },
      [targetProject]: {
        ...prev[targetProject],
        [lang]: [...prev[targetProject][lang], audio.url],
      },
    }));
  };

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
          const res = await fetch(`/api/appearance/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              worksImages: images[key],
              audioReviews: audioReviews[key],
              whatsAppDefaultMessage: defaultMessages[key],
              bannerText: bannerTexts[key],
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
      <UploadProgressDisplay
        uploadProgress={audioUploadState}
        onCancel={cancelAudioUpload}
        cancelDisabled={!uploadingAudio}
      />

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
        <div className="space-y-8">
          <AudioReviewsSection
            audioReviews={
              Object.fromEntries(
                PROJECTS.map((p) => [p.key, audioReviews[p.key].ar]),
              ) as Record<ProjectName, string[]>
            }
            uploading={uploadingAudio}
            onUpload={(e) => {
              onAudioUploadedRef.current = (url) =>
                handleAudioUploaded(url, 'ar');
              handleAudioFileSelect(e);
            }}
            onDelete={(i) => handleDeleteAudio(i, 'ar')}
            onPlatformChange={(i, p) => handleAudioPlatformChange(i, p, 'ar')}
            title={t('audioReviewsArTitle')}
            description={t('audioReviewsDescription')}
            addLabel={t('addAudio')}
            uploadingLabel={t('uploading')}
            noAudioText={t('noAudioReviews')}
            audioSingular={t('audioSingular')}
            audioPlural={t('audioPlural')}
            deleteLabel={t('deleteAudio')}
            platformLabel={t('audioPlatformLabel')}
          />

          <AudioReviewsSection
            audioReviews={
              Object.fromEntries(
                PROJECTS.map((p) => [p.key, audioReviews[p.key].en]),
              ) as Record<ProjectName, string[]>
            }
            uploading={uploadingAudio}
            onUpload={(e) => {
              onAudioUploadedRef.current = (url) =>
                handleAudioUploaded(url, 'en');
              handleAudioFileSelect(e);
            }}
            onDelete={(i) => handleDeleteAudio(i, 'en')}
            onPlatformChange={(i, p) => handleAudioPlatformChange(i, p, 'en')}
            title={t('audioReviewsEnTitle')}
            description={t('audioReviewsDescription')}
            addLabel={t('addAudio')}
            uploadingLabel={t('uploading')}
            noAudioText={t('noAudioReviews')}
            audioSingular={t('audioSingular')}
            audioPlural={t('audioPlural')}
            deleteLabel={t('deleteAudio')}
            platformLabel={t('audioPlatformLabel')}
          />
        </div>
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
