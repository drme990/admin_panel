'use client';

import { useRef, useState, useCallback } from 'react';
import {
  LuTrash2,
  LuUpload,
  LuPlay,
  LuPause,
  LuMusic,
  LuStar,
  LuUser,
  LuImage,
  LuLoader,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import { AudioReview, ProjectName, AudioLanguage } from '@/types/Appearance';
import Dropdown from '@/components/ui/dropdown';

interface AudioReviewsSectionProps {
  audioReviews: AudioReview[];
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<AudioReview>) => void;
  onSetMain: (id: string) => void;
  onRemoveImage: (id: string) => void;
}

const PLATFORM_OPTIONS = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
  { key: 'shared', label: 'Shared' },
] as const;

const LANGUAGE_OPTIONS = [
  { key: 'ar', label: 'AR' },
  { key: 'en', label: 'EN' },
  { key: 'shared', label: 'Shared' },
] as const;

function formatTime(time: number) {
  if (!time || Number.isNaN(time)) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

function MiniAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const update = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={update}
        onLoadedMetadata={update}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      <Button
        onClick={toggle}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        variant="icon"
        size="custom"
        className="text-primary bg-background border border-stroke hover:bg-primary/10 transition-colors h-10 w-10 shrink-0"
      >
        {isPlaying ? (
          <LuPause className="w-4 h-4" />
        ) : (
          <LuPlay className="w-4 h-4 ml-0.5" />
        )}
      </Button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          ref={progressRef}
          onClick={seek}
          className="flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden cursor-pointer"
        >
          <div
            className="h-full bg-primary/60 transition-[width] duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-secondary/70 leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

export function AudioReviewsSection(props: AudioReviewsSectionProps) {
  const {
    audioReviews,
    uploading,
    onUpload,
    onDelete,
    onUpdate,
    onSetMain,
    onRemoveImage,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [pendingImageId, setPendingImageId] = useState<string | null>(null);
  const total = audioReviews.length;

  const handleImageUpload = useCallback(
    async (audioId: string, file: File) => {
      setUploadingImageId(audioId);
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

        onUpdate(audioId, { userImage: data.data.url });
      } catch {
        // Best effort; user can still paste a URL manually
      } finally {
        setUploadingImageId(null);
        setPendingImageId(null);
      }
    },
    [onUpdate],
  );

  return (
    <div className="space-y-6 border border-stroke/60 rounded-2xl p-6 bg-card-bg shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Audio Reviews</h2>
          <p className="text-sm text-secondary/80 leading-relaxed">
            Manage audio reviews with names, images, platform and language assignment.
          </p>
        </div>

        <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full whitespace-nowrap">
          {total} {total === 1 ? 'audio' : 'audios'}
        </span>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stroke/40 rounded-xl bg-muted/5">
          <LuMusic className="w-12 h-12 text-secondary/30 mb-3" />
          <p className="text-secondary/70 font-medium">No audio reviews yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {audioReviews.map((audio) => (
            <div
              key={audio.id}
              className="group border border-stroke/50 rounded-xl p-5 bg-background hover:shadow-sm transition-shadow"
            >
              {/* Row 1: Controls */}
              <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-stroke/30">
                <div className="flex items-center gap-2">
                  <Button
                    variant={audio.isMain ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onSetMain(audio.id)}
                    className="flex items-center gap-1.5 text-xs"
                    title={audio.isMain ? 'Main audio (plays first)' : 'Set as main'}
                  >
                    <LuStar className="w-3.5 h-3.5" />
                    {audio.isMain ? 'Main' : 'Set Main'}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Dropdown
                    options={PLATFORM_OPTIONS.map((p) => ({
                      label: p.label,
                      value: p.key,
                    }))}
                    value={audio.platform}
                    onChange={(value) =>
                      onUpdate(audio.id, { platform: value as ProjectName })
                    }
                  />
                  <Dropdown
                    options={LANGUAGE_OPTIONS.map((l) => ({
                      label: l.label,
                      value: l.key,
                    }))}
                    value={audio.language}
                    onChange={(value) =>
                      onUpdate(audio.id, { language: value as AudioLanguage })
                    }
                  />
                  <Button
                    variant="icon-danger"
                    size="custom"
                    onClick={() => onDelete(audio.id)}
                    aria-label="Delete audio"
                    className="h-8 w-8"
                  >
                    <LuTrash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Row 2: User Image & Names */}
              <div className="flex items-start gap-4 mb-4">
                <div className="shrink-0 relative">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingImageId(audio.id);
                      imageInputRef.current?.click();
                    }}
                    disabled={uploadingImageId === audio.id}
                    className="relative cursor-pointer disabled:cursor-not-allowed group"
                    title="Upload user image"
                  >
                    {audio.userImage ? (
                      <img
                        src={audio.userImage}
                        alt={audio.nameEn}
                        className="w-14 h-14 rounded-full object-cover border border-stroke group-hover:opacity-80 transition-opacity"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border border-stroke group-hover:bg-muted/80 transition-colors">
                        {uploadingImageId === audio.id ? (
                          <LuLoader className="w-6 h-6 text-secondary animate-spin" />
                        ) : (
                          <LuUser className="w-6 h-6 text-secondary" />
                        )}
                      </div>
                    )}
                    {uploadingImageId !== audio.id && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full overflow-hidden">
                        <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center">
                          <LuImage className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    )}
                    {uploadingImageId === audio.id && audio.userImage && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-full overflow-hidden">
                        <div className="w-14 h-14 rounded-full bg-black/30 flex items-center justify-center">
                          <LuLoader className="w-5 h-5 text-white animate-spin" />
                        </div>
                      </div>
                    )}
                  </button>
                  {audio.userImage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveImage(audio.id);
                      }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-error text-white flex items-center justify-center shadow-sm hover:bg-error/80 transition-colors z-10"
                      title="Remove image"
                    >
                      <LuTrash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-secondary mb-1 block">Name (AR)</label>
                      <input
                        type="text"
                        value={audio.nameAr}
                        onChange={(e) => onUpdate(audio.id, { nameAr: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="اسم المستخدم"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-secondary mb-1 block">Name (EN)</label>
                      <input
                        type="text"
                        value={audio.nameEn}
                        onChange={(e) => onUpdate(audio.id, { nameEn: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-stroke rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="User Name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Audio Player */}
              <MiniAudioPlayer src={audio.url} />
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={onUpload}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && pendingImageId) {
            handleImageUpload(pendingImageId, file);
          }
          e.target.value = '';
        }}
      />

      <div className="flex justify-end pt-2">
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5"
        >
          <LuUpload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Add Audio'}
        </Button>
      </div>
    </div>
  );
}
