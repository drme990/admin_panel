'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';

export interface UploadProgressState {
  isUploading: boolean;
  overallProgress: number;
  currentFileName: string | null;
  currentFileProgress: number;
  completedFiles: number;
  totalFiles: number;
  uploadSpeed: string;
  timeRemaining: string;
}

type TranslateValues = Record<string, string | number | Date>;
type TranslateFn = (key: string, values?: TranslateValues) => string;

interface UseMediaUploadParams {
  media: string[];
  onChange: (media: string[]) => void;
  maxMedia?: number;
  t: TranslateFn;
  onUploadProgressChange?: (state: UploadProgressState) => void;
  onCancelUploadReady?: (cancelUpload: (() => void) | null) => void;
}

type UploadApiResponse = {
  success?: boolean;
  data?: { url?: string };
  error?: string;
};

type UploadWithProgressResult = {
  status: number;
  data: UploadApiResponse;
};

type DirectR2UploadResult = {
  status: number;
  publicUrl: string;
};

const INITIAL_UPLOAD_STATE: UploadProgressState = {
  isUploading: false,
  overallProgress: 0,
  currentFileName: null,
  currentFileProgress: 0,
  completedFiles: 0,
  totalFiles: 0,
  uploadSpeed: '0 KB/s',
  timeRemaining: '--',
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

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
  return isVideo ? '/api/upload/video' : '/api/upload/image';
};

const getVideoPresignedEndpoint = () => {
  if (backendBaseUrl) {
    return '/api/admin/upload/video/presigned';
  }
  return '/api/upload/video/presigned';
};

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

function formatTimeRemaining(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

async function getPresignedUploadUrl(
  fileName: string,
  contentType: string,
  fileSize: number,
  signal?: AbortSignal,
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const endpoint = buildApiUrl(getVideoPresignedEndpoint());
  const params = new URLSearchParams({
    fileName,
    contentType,
    fileSize: fileSize.toString(),
  });

  const requestUrl = `${endpoint}?${params}`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error?.data?.error || error?.error || 'Failed to get upload URL',
    );
  }

  const data = await response.json();
  if (!data.success || !data.data) {
    throw new Error(
      data?.data?.error || data?.error || 'Invalid upload URL response',
    );
  }

  return data.data;
}

function uploadDirectToR2(options: {
  file: File;
  presignedUrl: string;
  timeoutMs: number;
  onProgress: (progressPercent: number) => void;
  onSpeedUpdate: (speedBytesPerSec: number, uploadedBytes: number) => void;
  onAbort?: () => void;
  onRequestStart?: (xhr: XMLHttpRequest) => void;
  onRequestEnd?: (xhr: XMLHttpRequest) => void;
}): Promise<DirectR2UploadResult> {
  const {
    file,
    presignedUrl,
    timeoutMs,
    onProgress,
    onSpeedUpdate,
    onAbort,
    onRequestStart,
    onRequestEnd,
  } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.timeout = timeoutMs;

    if (file.type) {
      xhr.setRequestHeader('Content-Type', file.type);
    }

    onRequestStart?.(xhr);

    let startTime = 0;

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      const now = Date.now();
      if (startTime === 0) startTime = now;

      const progressPercent = Math.round((event.loaded / event.total) * 100);
      onProgress(Math.min(100, Math.max(0, progressPercent)));

      const elapsedSeconds = (now - startTime) / 1000;
      if (elapsedSeconds > 0.1) {
        const speedBytesPerSec = event.loaded / elapsedSeconds;
        onSpeedUpdate(speedBytesPerSec, event.loaded);
      }
    };

    xhr.onload = () => {
      onRequestEnd?.(xhr);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: xhr.status,
          publicUrl: '',
        });
      } else {
        let errorMsg = `Upload failed with status ${xhr.status}: ${xhr.statusText}`;
        const responseSnippet = (xhr.responseText || '').slice(0, 400);
        if (xhr.status === 403) {
          errorMsg = `Upload denied (403). Presigned signature mismatch, bucket policy, or URL expiration. Response: ${responseSnippet}`;
        } else if (xhr.status === 401) {
          errorMsg = 'Upload unauthorized (401). Check credentials.';
        }
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      onRequestEnd?.(xhr);
      reject(new Error('Network error while uploading video'));
    };

    xhr.ontimeout = () => {
      onRequestEnd?.(xhr);
      reject(new Error('Upload timed out'));
    };

    xhr.onabort = () => {
      onRequestEnd?.(xhr);
      onAbort?.();
      const abortErr = new DOMException('Upload aborted', 'AbortError');
      reject(abortErr);
    };

    try {
      // Send the original File directly so browser manages body streaming natively.
      xhr.send(file);
    } catch (error) {
      reject(
        new Error(
          `Failed to send upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      );
    }
  });
}

function shouldFallbackToBackendVideoUpload(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();
  return (
    message.includes('network error') ||
    message.includes('timed out') ||
    message.includes('403') ||
    message.includes('upload denied')
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

export function useMediaUpload({
  media,
  onChange,
  maxMedia = 10,
  t,
  onUploadProgressChange,
  onCancelUploadReady,
}: UseMediaUploadParams) {
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] =
    useState<UploadProgressState>(INITIAL_UPLOAD_STATE);

  const activeRequestsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const preferBackendVideoUploadRef = useRef(false);
  const isMountedRef = useRef(true);
  const userCancelledRef = useRef(false);

  const updateUploadState = useCallback(
    (
      updater:
        | UploadProgressState
        | ((prev: UploadProgressState) => UploadProgressState),
    ) => {
      if (!isMountedRef.current) return;

      setUploadState((prev) =>
        typeof updater === 'function' ? updater(prev) : updater,
      );
    },
    [],
  );

  useEffect(() => {
    onUploadProgressChange?.(uploadState);
  }, [onUploadProgressChange, uploadState]);

  const abortAllActiveUploads = useCallback(() => {
    for (const controller of activeControllersRef.current) {
      controller.abort();
    }
    activeControllersRef.current.clear();

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
    if (!uploading) {
      userCancelledRef.current = false;
    }
  }, [uploading]);

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
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handlePageLeave);
      window.removeEventListener('pagehide', handlePageLeave);
    };
  }, [cancelUpload]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = maxMedia - media.length;
      if (remaining <= 0) {
        toast.error(t('messages.maxMediaReached'));
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remaining);
      userCancelledRef.current = false;

      if (media.length === 0) {
        const hasImage = filesToUpload.some((f) => f.type.startsWith('image/'));
        if (!hasImage) {
          toast.error(t('messages.firstMediaMustBeImage'));
          return;
        }

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
          uploadSpeed: '0 KB/s',
          timeRemaining: '--',
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
            uploadSpeed: '0 KB/s',
            timeRemaining: '--',
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

          try {
            let uploadedUrl = '';

            if (isVideo) {
              const uploadVideoViaBackend = async (): Promise<string> => {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', 'products/videos');

                const endpoint = buildApiUrl(getUploadEndpoint(true));
                const fallbackRes = await uploadFileWithProgress({
                  endpoint,
                  formData,
                  timeoutMs: UPLOAD_TIMEOUT_MS,
                  onProgress: (currentFileProgress) => {
                    const overallProgress = Math.round(
                      ((successfulFiles + currentFileProgress / 100) /
                        filesToUpload.length) *
                        100,
                    );

                    updateUploadState((prev) => ({
                      ...prev,
                      currentFileProgress,
                      overallProgress,
                    }));
                  },
                  onRequestStart: (xhr) => {
                    activeRequestsRef.current.add(xhr);
                  },
                  onRequestEnd: (xhr) => {
                    activeRequestsRef.current.delete(xhr);
                  },
                });

                if (
                  !(
                    fallbackRes.status >= 200 &&
                    fallbackRes.status < 300 &&
                    fallbackRes.data.success
                  )
                ) {
                  throw new Error(
                    fallbackRes.data.error ||
                      `Fallback upload failed with status ${fallbackRes.status}`,
                  );
                }

                const fallbackUrl = fallbackRes.data.data?.url || '';
                if (!fallbackUrl) {
                  throw new Error(
                    'Fallback upload succeeded but no URL was returned',
                  );
                }

                return fallbackUrl;
              };

              if (preferBackendVideoUploadRef.current) {
                uploadedUrl = await uploadVideoViaBackend();
                uploadedUrls.push(uploadedUrl);
                markFileSucceeded();
                continue;
              }

              const controller = new AbortController();
              activeControllersRef.current.add(controller);

              const presignedData = await getPresignedUploadUrl(
                file.name,
                file.type,
                file.size,
                controller.signal,
              );
              activeControllersRef.current.delete(controller);

              try {
                await uploadDirectToR2({
                  file,
                  presignedUrl: presignedData.uploadUrl,
                  timeoutMs: UPLOAD_TIMEOUT_MS,
                  onProgress: (progressPercent) => {
                    const overallProgress = Math.round(
                      ((successfulFiles + progressPercent / 100) /
                        filesToUpload.length) *
                        100,
                    );

                    updateUploadState((prev) => ({
                      ...prev,
                      currentFileProgress: progressPercent,
                      overallProgress,
                    }));
                  },
                  onSpeedUpdate: (bytesPerSec, uploadedBytes) => {
                    const speedMbps = bytesPerSec / (1024 * 1024);
                    const speedStr =
                      speedMbps > 0.1
                        ? `${speedMbps.toFixed(1)} MB/s`
                        : `${(bytesPerSec / 1024).toFixed(1)} KB/s`;

                    const remainingBytes = file.size - uploadedBytes;
                    const secondsRemaining = remainingBytes / bytesPerSec;

                    updateUploadState((prev) => ({
                      ...prev,
                      uploadSpeed: speedStr,
                      timeRemaining: formatTimeRemaining(secondsRemaining),
                    }));
                  },
                  onRequestStart: (xhr) => {
                    activeRequestsRef.current.add(xhr);
                  },
                  onRequestEnd: (xhr) => {
                    activeRequestsRef.current.delete(xhr);
                  },
                });

                uploadedUrl = presignedData.publicUrl;
              } catch (directError) {
                if (!shouldFallbackToBackendVideoUpload(directError)) {
                  throw directError;
                }

                preferBackendVideoUploadRef.current = true;

                uploadedUrl = await uploadVideoViaBackend();
              }
            } else {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('folder', 'products');

              const endpoint = buildApiUrl(getUploadEndpoint(false));
              const res = await uploadFileWithProgress({
                endpoint,
                formData,
                timeoutMs: UPLOAD_TIMEOUT_MS,
                onProgress: (currentFileProgress) => {
                  const overallProgress = Math.round(
                    ((successfulFiles + currentFileProgress / 100) /
                      filesToUpload.length) *
                      100,
                  );

                  updateUploadState((prev) => ({
                    ...prev,
                    currentFileProgress,
                    overallProgress,
                  }));
                },
                onRequestStart: (xhr) => {
                  activeRequestsRef.current.add(xhr);
                },
                onRequestEnd: (xhr) => {
                  activeRequestsRef.current.delete(xhr);
                },
              });

              if (
                !(res.status >= 200 && res.status < 300 && res.data.success)
              ) {
                throw new Error(
                  res.data.error || `Upload failed with status ${res.status}`,
                );
              }

              uploadedUrl = res.data.data?.url || '';
              if (!uploadedUrl) {
                throw new Error(
                  'Upload succeeded but no file URL was returned',
                );
              }
            }

            uploadedUrls.push(uploadedUrl);
            markFileSucceeded();
          } catch (fileError) {
            if (isAbortError(fileError)) {
              uploadWasCancelled = true;
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
      } catch {
        toast.error(t('messages.uploadFailed'));
      } finally {
        abortAllActiveUploads();
        userCancelledRef.current = false;
        setUploading(false);
        updateUploadState(INITIAL_UPLOAD_STATE);
        e.target.value = '';
      }
    },
    [abortAllActiveUploads, maxMedia, media, onChange, t, updateUploadState],
  );

  return {
    uploading,
    uploadState,
    handleFileSelect,
    cancelUpload,
  };
}
