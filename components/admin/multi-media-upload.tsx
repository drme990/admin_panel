'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  LuPlus as Plus,
  LuTrash2 as Trash2,
  LuGripVertical as GripVertical,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuVideo as VideoIcon,
} from 'react-icons/lu';
import { useTranslations } from 'next-intl';
import { toast } from 'react-toastify';
import Button from '@/components/ui/button';

interface MultiMediaUploadProps {
  media: string[];
  onChange: (media: string[]) => void;
  maxMedia?: number;
  onUploadProgressChange?: (state: UploadProgressState) => void;
  onCancelUploadReady?: (cancelUpload: (() => void) | null) => void;
}

export interface UploadProgressState {
  isUploading: boolean;
  overallProgress: number;
  currentFileName: string | null;
  currentFileProgress: number;
  completedFiles: number;
  totalFiles: number;
}

const INITIAL_UPLOAD_STATE: UploadProgressState = {
  isUploading: false,
  overallProgress: 0,
  currentFileName: null,
  currentFileProgress: 0,
  completedFiles: 0,
  totalFiles: 0,
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const backendBaseUrl = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
};

const getUploadEndpoint = (isVideo: boolean) => {
  if (backendBaseUrl) {
    return isVideo ? '/api/admin/upload/video' : '/api/admin/upload/image';
  }

  // Fallback to admin-panel rewrite rules in next.config.ts.
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const getDeleteEndpoint = (isVideo: boolean) => {
  if (backendBaseUrl) {
    return isVideo ? '/api/admin/upload/video' : '/api/admin/upload/image';
  }

  // Fallback to admin-panel rewrite rules in next.config.ts.
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const isVideoUrl = (url: string) => {
  return /\.(mp4|webm|mov|qt)(\?.*)?$/i.test(url) || url.includes('/videos/');
};

type UploadApiResponse = {
  success?: boolean;
  data?: { url?: string };
  error?: string;
};

type UploadWithProgressResult = {
  status: number;
  data: UploadApiResponse;
};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function uploadFileWithProgress(options: {
  endpoint: string;
  formData: FormData;
  timeoutMs: number;
  onProgress: (progressPercent: number) => void;
  onRequestStart: (xhr: XMLHttpRequest) => void;
  onRequestEnd: (xhr: XMLHttpRequest) => void;
}): Promise<UploadWithProgressResult> {
  const {
    endpoint,
    formData,
    timeoutMs,
    onProgress,
    onRequestStart,
    onRequestEnd,
  } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.withCredentials = true;
    xhr.timeout = timeoutMs;
    xhr.responseType = 'text';

    onRequestStart(xhr);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const progressPercent = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.min(100, Math.max(0, progressPercent)));
    };

    xhr.onload = () => {
      onRequestEnd(xhr);

      const rawResponse = xhr.responseText || '';
      let parsed: UploadApiResponse = {};

      if (rawResponse) {
        try {
          parsed = JSON.parse(rawResponse) as UploadApiResponse;
        } catch {
          parsed = {
            success: false,
            error: rawResponse.slice(0, 200) || 'Invalid server response',
          };
        }
      }

      resolve({
        status: xhr.status,
        data: parsed,
      });
    };

    xhr.onerror = () => {
      onRequestEnd(xhr);
      reject(new Error('Network error while uploading media'));
    };

    xhr.ontimeout = () => {
      onRequestEnd(xhr);
      reject(new Error('Upload timed out'));
    };

    xhr.onabort = () => {
      onRequestEnd(xhr);
      const abortErr = new DOMException('Upload aborted', 'AbortError');
      reject(abortErr);
    };

    xhr.send(formData);
  });
}

export default function MultiMediaUpload({
  media,
  onChange,
  maxMedia = 10,
  onUploadProgressChange,
  onCancelUploadReady,
}: MultiMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] =
    useState<UploadProgressState>(INITIAL_UPLOAD_STATE);
  const activeRequestsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const isMountedRef = useRef(true);
  const userCancelledRef = useRef(false);
  const t = useTranslations('admin.products');

  const updateUploadState = useCallback(
    (
      updater:
        | UploadProgressState
        | ((prev: UploadProgressState) => UploadProgressState),
    ) => {
      if (!isMountedRef.current) return;

      setUploadState((prev) => {
        const nextState =
          typeof updater === 'function' ? updater(prev) : updater;
        return nextState;
      });
    },
    [],
  );

  useEffect(() => {
    onUploadProgressChange?.(uploadState);
  }, [uploadState, onUploadProgressChange]);

  const abortAllActiveUploads = useCallback(() => {
    for (const xhr of activeRequestsRef.current) {
      xhr.abort();
    }
    activeRequestsRef.current.clear();
  }, []);

  const cancelUpload = useCallback(() => {
    userCancelledRef.current = true;
    abortAllActiveUploads();
  }, [abortAllActiveUploads]);

  useEffect(() => {
    onCancelUploadReady?.(cancelUpload);

    return () => {
      onCancelUploadReady?.(null);
    };
  }, [cancelUpload, onCancelUploadReady]);

  useEffect(() => {
    isMountedRef.current = true;

    const handlePageLeave = () => {
      cancelUpload();
    };

    window.addEventListener('beforeunload', handlePageLeave);
    window.addEventListener('pagehide', handlePageLeave);

    return () => {
      handlePageLeave();
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handlePageLeave);
      window.removeEventListener('pagehide', handlePageLeave);
    };
  }, [cancelUpload]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxMedia - media.length;
    if (remaining <= 0) {
      toast.error(t('messages.maxMediaReached'));
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);
    userCancelledRef.current = false;

    // Enforce first media is an image
    if (media.length === 0) {
      const hasImage = filesToUpload.some((f) => f.type.startsWith('image/'));
      if (!hasImage) {
        toast.error(t('messages.firstMediaMustBeImage'));
        return;
      }

      // Ensure the first file in queue is an image
      filesToUpload.sort((a, b) => {
        if (a.type.startsWith('image/') && !b.type.startsWith('image/'))
          return -1;
        if (!a.type.startsWith('image/') && b.type.startsWith('image/'))
          return 1;
        return 0;
      });
    }

    try {
      setUploading(true);
      updateUploadState({
        isUploading: true,
        overallProgress: 0,
        currentFileName: null,
        currentFileProgress: 0,
        completedFiles: 0,
        totalFiles: filesToUpload.length,
      });

      const uploadedUrls: string[] = [];
      let successfulFiles = 0;
      let uploadWasCancelled = false;

      const markFileSucceeded = () => {
        successfulFiles += 1;
        const overallProgress = Math.round(
          (successfulFiles / filesToUpload.length) * 100,
        );

        updateUploadState((prev) => ({
          ...prev,
          completedFiles: successfulFiles,
          overallProgress,
          currentFileProgress: 100,
        }));
      };

      for (const file of filesToUpload) {
        if (!isMountedRef.current || userCancelledRef.current) {
          uploadWasCancelled = true;
          break;
        }

        const isVideo = file.type.startsWith('video/');
        updateUploadState((prev) => ({
          ...prev,
          currentFileName: file.name,
          currentFileProgress: 1,
          overallProgress: Math.round(
            (successfulFiles / filesToUpload.length) * 100,
          ),
        }));

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
          toast.error(
            t('messages.videoTooLarge', {
              size: '50MB',
            }),
          );
          updateUploadState((prev) => ({
            ...prev,
            currentFileProgress: 0,
            overallProgress: Math.round(
              (successfulFiles / filesToUpload.length) * 100,
            ),
          }));
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        if (!isVideo) {
          formData.append('folder', 'products');
        }

        const endpoint = buildApiUrl(getUploadEndpoint(isVideo));

        let visualFileProgress = 1;
        let visualTargetProgress = 1;
        let progressAnimator: ReturnType<typeof setInterval> | null = null;
        let processingAnimator: ReturnType<typeof setInterval> | null = null;

        const clearAnimators = () => {
          if (progressAnimator) {
            clearInterval(progressAnimator);
            progressAnimator = null;
          }
          if (processingAnimator) {
            clearInterval(processingAnimator);
            processingAnimator = null;
          }
        };

        const syncVisualProgress = () => {
          const overallProgress = Math.round(
            ((successfulFiles + visualFileProgress / 100) /
              filesToUpload.length) *
              100,
          );

          updateUploadState((prev) => ({
            ...prev,
            currentFileProgress: visualFileProgress,
            overallProgress,
          }));
        };

        progressAnimator = setInterval(() => {
          if (!isMountedRef.current) return;
          if (visualFileProgress >= visualTargetProgress) return;

          const remaining = visualTargetProgress - visualFileProgress;
          const step = remaining > 20 ? 4 : remaining > 8 ? 2 : 1;
          visualFileProgress = Math.min(
            visualTargetProgress,
            visualFileProgress + step,
          );
          syncVisualProgress();
        }, 60);

        syncVisualProgress();

        try {
          const res = await uploadFileWithProgress({
            endpoint,
            formData,
            timeoutMs: UPLOAD_TIMEOUT_MS,
            onProgress: (currentFileProgress) => {
              // Upload body transfer (browser -> API) drives 1-90.
              const uploadStageTarget = Math.min(
                Math.max(Math.round(currentFileProgress * 0.9), 1),
                90,
              );

              if (uploadStageTarget > visualTargetProgress) {
                visualTargetProgress = uploadStageTarget;
              }

              // While waiting for API response (API -> R2), ease toward 99.
              if (currentFileProgress >= 100 && !processingAnimator) {
                processingAnimator = setInterval(() => {
                  if (!isMountedRef.current) return;
                  if (visualTargetProgress < 99) {
                    visualTargetProgress += 1;
                  }
                }, 220);
              }
            },
            onRequestStart: (xhr) => {
              activeRequestsRef.current.add(xhr);
            },
            onRequestEnd: (xhr) => {
              activeRequestsRef.current.delete(xhr);
            },
          });

          if (res.status >= 200 && res.status < 300 && res.data.success) {
            clearAnimators();
            const uploadedUrl = res.data.data?.url;
            if (uploadedUrl) {
              uploadedUrls.push(uploadedUrl);
              markFileSucceeded();
            } else {
              throw new Error('Upload succeeded but no file URL was returned');
            }
          } else {
            throw new Error(
              res.data.error || `Upload failed with status ${res.status}`,
            );
          }
        } catch (fileError) {
          clearAnimators();

          if (isAbortError(fileError)) {
            uploadWasCancelled = true;
            // Abort means this file did not complete; avoid counting it as 100%.
            updateUploadState((prev) => ({
              ...prev,
              currentFileProgress: 0,
              overallProgress: Math.round(
                (successfulFiles / filesToUpload.length) * 100,
              ),
            }));
            break;
          }

          const errorMsg =
            fileError instanceof Error ? fileError.message : 'Upload failed';
          console.error(`Error uploading ${file.name}:`, errorMsg);
          toast.error(`${file.name}: ${errorMsg}`);
          updateUploadState((prev) => ({
            ...prev,
            currentFileProgress: 0,
            overallProgress: Math.round(
              (successfulFiles / filesToUpload.length) * 100,
            ),
          }));
        }
      }

      if (uploadWasCancelled) {
        toast.info('Upload cancelled.');
      }

      if (uploadedUrls.length > 0) {
        onChange([...media, ...uploadedUrls]);
        toast.success(
          t('messages.mediaUploaded', { count: uploadedUrls.length }),
        );
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error(t('messages.uploadFailed'));
    } finally {
      abortAllActiveUploads();
      userCancelledRef.current = false;
      setUploading(false);
      updateUploadState(INITIAL_UPLOAD_STATE);
      e.target.value = '';
    }
  };

  const handleRemoveMedia = async (index: number) => {
    if (uploading) return;

    const updated = media.filter((_, i) => i !== index);

    if (updated.length > 0 && isVideoUrl(updated[0])) {
      toast.error(t('messages.primaryMediaMustStayImage'));
      return;
    }

    const removedUrl = media[index];
    onChange(updated);

    // Optional: Call delete API in background to clean up storage
    try {
      const isVideo = isVideoUrl(removedUrl);
      const endpoint = buildApiUrl(getDeleteEndpoint(isVideo));
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: removedUrl }),
      });
    } catch (e) {
      console.error('Failed to delete from storage', e);
    }
  };

  const handleMoveMedia = (fromIndex: number, toIndex: number) => {
    if (uploading) return;
    if (toIndex < 0 || toIndex >= media.length) return;

    const updated = [...media];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    if (updated.length > 0 && isVideoUrl(updated[0])) {
      toast.error(t('messages.firstMediaMustBeImage'));
      return;
    }

    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          {t('form.productMedia')}
        </label>
        <span className="text-xs text-secondary">
          {media.length}/{maxMedia}
        </span>
      </div>

      {/* Media Grid */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {media.map((mediaUrl, index) => {
            const isVideo = isVideoUrl(mediaUrl);
            return (
              <div
                key={`${mediaUrl}-${index}`}
                className="relative group aspect-square rounded-lg overflow-hidden border border-stroke bg-gray-50 flex items-center justify-center p-1"
              >
                {isVideo ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black rounded-md overflow-hidden">
                    <video
                      src={mediaUrl}
                      className="object-cover w-full h-full"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20">
                      <VideoIcon
                        size={32}
                        className="text-white drop-shadow-md"
                      />
                    </div>
                  </div>
                ) : (
                  <Image
                    src={mediaUrl}
                    alt={`Product ${index + 1}`}
                    fill
                    className="object-cover rounded-md"
                    unoptimized
                  />
                )}

                {/* Overlay Options */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-2 rounded-md">
                  <div className="flex gap-2">
                    {index > 0 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, index - 1)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.moveLeft')}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                    )}
                    {index < media.length - 1 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, index + 1)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.moveRight')}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {index > 0 && (
                      <Button
                        variant="icon-primary"
                        size="custom"
                        type="button"
                        onClick={() => handleMoveMedia(index, 0)}
                        disabled={uploading}
                        className="p-1.5 bg-white/90 hover:bg-white text-black"
                        title={t('form.setAsMain') || 'Set as Main'}
                      >
                        <GripVertical size={16} />
                      </Button>
                    )}
                    <Button
                      variant="icon-danger"
                      size="custom"
                      type="button"
                      onClick={() => handleRemoveMedia(index)}
                      disabled={uploading}
                      className="p-1.5 bg-error/90 text-white hover:bg-error"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                {/* Main badge */}
                {index === 0 && (
                  <span className="absolute top-2 inset-start-2 text-[10px] bg-success text-white px-2 py-0.5 rounded-full z-10 shadow-sm pointer-events-none">
                    {t('form.mainImage') || 'Main Thumbnail'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Button */}
      {media.length < maxMedia && (
        <label className="cursor-pointer block">
          <div className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-stroke rounded-lg hover:border-success transition-colors">
            {uploading ? (
              <div className="flex items-center gap-2 text-secondary">
                <div className="w-5 h-5 border-2 border-success border-t-transparent rounded-full animate-spin" />
                <span>{t('buttons.uploading') || 'Uploading...'}</span>
              </div>
            ) : (
              <>
                <Plus size={20} className="text-secondary" />
                <span className="text-secondary">{t('form.addMedia')}</span>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/ogg"
            onChange={handleFileSelect}
            className="hidden"
            multiple
            disabled={uploading}
          />
        </label>
      )}

      <p className="text-xs text-secondary">{t('form.mediaHelp')}</p>
    </div>
  );
}
