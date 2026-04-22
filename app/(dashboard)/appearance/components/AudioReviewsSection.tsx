'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LuTrash2,
  LuUpload,
  LuPlay,
  LuPause,
  LuVolume2,
  LuMusic,
} from 'react-icons/lu';
import Button from '@/components/ui/button';
import { ProjectName } from '@/types/Appearance';
import Dropdown from '@/components/ui/dropdown';

interface AudioReviewsSectionProps {
  audioReviews: Record<ProjectName, string[]>;
  uploading: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (index: number) => void;
  onPlatformChange: (index: number, targetProject: ProjectName) => void;
  title: string;
  description: string;
  addLabel: string;
  uploadingLabel: string;
  noAudioText: string;
  audioSingular: string;
  audioPlural: string;
  deleteLabel: string;
  platformLabel: string;
}

const PROJECTS = [
  { key: 'ghadaq', label: 'Ghadaq' },
  { key: 'manasik', label: 'Manasik' },
  { key: 'shared', label: 'Shared' },
] as const;

// Enhanced Mini Player with refined UI
function MiniAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const [isDragging, setIsDragging] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);

  const [showVolume, setShowVolume] = useState(false);

  const format = (t: number) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  const update = () => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;

    const dur = audio.duration || 0;
    const time = audio.currentTime || 0;

    setDuration(dur);
    setCurrentTime(time);
    setProgress(dur ? (time / dur) * 100 : 0);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const calc = (x: number) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const p = (x - rect.left) / rect.width;
    return Math.max(0, Math.min(1, p));
  };

  const onDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragProgress(calc(e.clientX) * 100);
  };

  const onMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setDragProgress(calc(e.clientX) * 100);
    },
    [isDragging],
  );

  const onUp = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const audio = audioRef.current;
      if (audio && audio.duration) {
        audio.currentTime = calc(e.clientX) * audio.duration;
      }

      setIsDragging(false);
    },
    [isDragging],
  );

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, onMove, onUp]);

  const displayProgress = isDragging ? dragProgress : progress;

  return (
    <div className="w-full space-y-3">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={update}
        onLoadedMetadata={update}
      />

      {/* Progress Bar with improved styling */}
      <div className="space-y-1.5">
        <div
          ref={progressRef}
          onMouseDown={onDown}
          className="group relative h-1.5 bg-muted/30 rounded-full cursor-pointer overflow-hidden"
        >
          <div
            className="absolute inset-y-0 left-0 bg-linear-to-r from-primary to-primary/80 rounded-full transition-all"
            style={{ width: `${displayProgress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 bg-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition"
            style={{ left: `calc(${displayProgress}% - 6px)` }}
          />
        </div>

        <div className="flex justify-between text-xs text-secondary/80 font-mono tracking-wide">
          <span>{format(currentTime)}</span>
          <span>{format(duration)}</span>
        </div>
      </div>

      {/* Controls - centered and polished */}
      <div className="flex items-center justify-between">
        <Button
          onClick={toggle}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          variant="icon"
          size="custom"
          className="text-primary bg-background border border-stroke hover:bg-primary/10 transition-colors"
        >
          {isPlaying ? (
            <LuPause className="w-5 h-5" />
          ) : (
            <LuPlay className="w-5 h-5 ml-0.5" />
          )}
        </Button>

        {/* Volume Control */}
        <div className="relative">
          <Button
            onClick={() => setShowVolume((v) => !v)}
            aria-label="Volume"
            variant="icon"
            size="custom"
            className={`text-primary bg-background border border-stroke hover:bg-primary/10 transition-colors ${
              showVolume ? 'bg-primary/10' : ''
            }`}
          >
            <LuVolume2 className="w-4 h-4" />
          </Button>

          <div
            className={`absolute bottom-full right-0 mb-2 transition-all duration-200 ${
              showVolume
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2 pointer-events-none'
            }`}
          >
            <div className="bg-background border border-stroke rounded-lg p-3 shadow-lg">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                defaultValue="1"
                onChange={(e) => {
                  if (audioRef.current) {
                    audioRef.current.volume = Number(e.target.value);
                  }
                }}
                className="w-24 accent-primary"
              />
            </div>
          </div>
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
    onPlatformChange,
    title,
    description,
    addLabel,
    uploadingLabel,
    noAudioText,
    audioSingular,
    audioPlural,
  } = props;

  const inputRef = useRef<HTMLInputElement>(null);

  const allAudios = PROJECTS.flatMap((project) =>
    audioReviews[project.key].map((url) => ({
      url,
      project: project.key,
    })),
  );

  const total = allAudios.length;

  return (
    <div className="space-y-6 border border-stroke/60 rounded-2xl p-6 bg-card-bg shadow-sm">
      {/* Header - cleaner alignment */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-secondary/80 leading-relaxed">
            {description}
          </p>
        </div>

        <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-full whitespace-nowrap">
          {total} {total === 1 ? audioSingular : audioPlural}
        </span>
      </div>

      {/* Content - improved empty state and list styling */}
      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-stroke/40 rounded-xl bg-muted/5">
          <LuMusic className="w-12 h-12 text-secondary/30 mb-3" />
          <p className="text-secondary/70 font-medium">{noAudioText}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {PROJECTS.map((project) => {
            const list = audioReviews[project.key];
            if (!list.length) return null;

            return (
              <div key={project.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary/80">
                    {project.label}
                  </h3>
                  <span className="text-xs bg-muted/50 px-2 py-0.5 rounded-full">
                    {list.length}
                  </span>
                </div>

                <div className="grid gap-4">
                  {list.map((url) => {
                    const globalIndex = allAudios.findIndex(
                      (a) => a.url === url && a.project === project.key,
                    );

                    return (
                      <div
                        key={url}
                        className="group border border-stroke/50 rounded-xl p-5 bg-background hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between gap-3 mb-4 pb-3">
                          <Dropdown
                            options={PROJECTS.map((p) => ({
                              label: p.label,
                              value: p.key,
                            }))}
                            value={project.key}
                            onChange={(value) =>
                              onPlatformChange(
                                globalIndex,
                                value as ProjectName,
                              )
                            }
                          />

                          <Button
                            variant="icon-danger"
                            size="custom"
                            onClick={() => onDelete(globalIndex)}
                            aria-label="Delete audio"
                          >
                            <LuTrash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <MiniAudioPlayer src={url} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Button - improved positioning */}
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={onUpload}
      />

      <div className="flex justify-end pt-2">
        <Button
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5"
        >
          <LuUpload className="w-4 h-4" />
          {uploading ? uploadingLabel : addLabel}
        </Button>
      </div>
    </div>
  );
}
