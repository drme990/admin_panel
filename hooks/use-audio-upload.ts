'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import type { UploadProgressState } from '@/hooks/use-media-upload';

type TranslateValues = Record<string, string | number | Date>;
type TranslateFn = (key: string, values?: TranslateValues) => string;

interface UseAudioUploadParams {
  t: TranslateFn;
  onUploaded: (url: string) => void;
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

const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/x-m4a',
];

const extensionTypeMap: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  mp4: 'audio/mp4',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
};

const MAX_AUDIO_SIZE = 20 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

const backendBaseUrl = (
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const buildApiUrl = (path: string) => {
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
};

const getAudioUploadEndpoint = () => {
  if (backendBaseUrl) {
    return '/api/admin/upload/audio';
  }
  return '/api/upload/audio';
};

const getAudioPresignedEndpoint = () => {
  if (backendBaseUrl) {
    return '/api/admin/upload/audio/presigned';
  }
  return '/api/upload/audio/presigned';
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

function resolveAudioContentType(file: File): string | null {
  const normalizedType = file.type.toLowerCase();
  if (ALLOWED_AUDIO_TYPES.includes(normalizedType)) {
    return normalizedType;
  }

  if (normalizedType === '' || normalizedType === 'application/octet-stream') {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return extensionTypeMap[ext] || null;
  }

  return null;
}

async function getPresignedUploadUrl(
  fileName: string,
  contentType: string,
  fileSize: number,
  signal?: AbortSignal,
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const endpoint = buildApiUrl(getAudioPresignedEndpoint());
  const params = new URLSearchParams({
    fileName,
    contentType,
    fileSize: fileSize.toString(),
  });

  const response = await fetch(`${endpoint}?${params}`, {
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
  contentType: string;
  presignedUrl: string;
  timeoutMs: number;
  onProgress: (progressPercent: number) => void;
  onSpeedUpdate: (speedBytesPerSec: number, uploadedBytes: number) => void;
  onRequestStart: (xhr: XMLHttpRequest) => void;
  onRequestEnd: (xhr: XMLHttpRequest) => void;
}): Promise<void> {
  const {
    file,
    contentType,
    presignedUrl,
    timeoutMs,
    onProgress,
    onSpeedUpdate,
    onRequestStart,
    onRequestEnd,
  } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader('Content-Type', contentType);

    onRequestStart(xhr);

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
      onRequestEnd(xhr);

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}: ${xhr.statusText}`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      onRequestEnd(xhr);
      reject(new Error('Network error while uploading audio'));
    };

    xhr.ontimeout = () => {
      onRequestEnd(xhr);
      reject(new Error('Upload timed out'));
    };

    xhr.onabort = () => {
      onRequestEnd(xhr);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    xhr.send(file);
  });
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
      reject(new Error('Network error while uploading audio'));
    };

    xhr.ontimeout = () => {
      onRequestEnd(xhr);
      reject(new Error('Upload timed out'));
    };

    xhr.onabort = () => {
      onRequestEnd(xhr);
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    xhr.send(formData);
  });
}

function shouldFallbackToBackendUpload(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();
  return (
    message.includes('network error') ||
    message.includes('timed out') ||
    message.includes('403') ||
    message.includes('failed with status')
  );
}

export function useAudioUpload({ t, onUploaded }: UseAudioUploadParams) {
  const [uploading, setUploading] = useState(false);
  const [uploadState, setUploadState] =
    useState<UploadProgressState>(INITIAL_UPLOAD_STATE);

  const activeRequestsRef = useRef<Set<XMLHttpRequest>>(new Set());
  const activeControllersRef = useRef<Set<AbortController>>(new Set());
  const preferBackendUploadRef = useRef(false);
  const isMountedRef = useRef(true);

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
    abortAllActiveUploads();
  }, [abortAllActiveUploads]);

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
      const file = e.target.files?.[0];
      if (!file) return;

      const resolvedType = resolveAudioContentType(file);
      if (!resolvedType) {
        toast.error(t('audioInvalidType'));
        e.target.value = '';
        return;
      }

      if (file.size > MAX_AUDIO_SIZE) {
        toast.error(t('audioFileTooLarge', { size: '20MB' }));
        e.target.value = '';
        return;
      }

      try {
        setUploading(true);
        updateUploadState({
          isUploading: true,
          overallProgress: 0,
          currentFileName: file.name,
          currentFileProgress: 0,
          completedFiles: 0,
          totalFiles: 1,
          uploadSpeed: '0 KB/s',
          timeRemaining: '--',
        });

        const uploadViaBackend = async (): Promise<string> => {
          const formData = new FormData();
          formData.append('file', file);

          const endpoint = buildApiUrl(getAudioUploadEndpoint());
          const res = await uploadFileWithProgress({
            endpoint,
            formData,
            timeoutMs: UPLOAD_TIMEOUT_MS,
            onProgress: (currentFileProgress) => {
              updateUploadState((prev) => ({
                ...prev,
                currentFileProgress,
                overallProgress: currentFileProgress,
              }));
            },
            onRequestStart: (xhr) => {
              activeRequestsRef.current.add(xhr);
            },
            onRequestEnd: (xhr) => {
              activeRequestsRef.current.delete(xhr);
            },
          });

          if (!(res.status >= 200 && res.status < 300 && res.data.success)) {
            throw new Error(
              res.data.error || `Upload failed with status ${res.status}`,
            );
          }

          const uploadedUrl = res.data.data?.url || '';
          if (!uploadedUrl) {
            throw new Error('Upload succeeded but no file URL was returned');
          }

          return uploadedUrl;
        };

        let uploadedUrl = '';

        if (preferBackendUploadRef.current) {
          uploadedUrl = await uploadViaBackend();
        } else {
          const controller = new AbortController();
          activeControllersRef.current.add(controller);

          const presignedData = await getPresignedUploadUrl(
            file.name,
            resolvedType,
            file.size,
            controller.signal,
          );
          activeControllersRef.current.delete(controller);

          try {
            await uploadDirectToR2({
              file,
              contentType: resolvedType,
              presignedUrl: presignedData.uploadUrl,
              timeoutMs: UPLOAD_TIMEOUT_MS,
              onProgress: (currentFileProgress) => {
                updateUploadState((prev) => ({
                  ...prev,
                  currentFileProgress,
                  overallProgress: currentFileProgress,
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
            if (!shouldFallbackToBackendUpload(directError)) {
              throw directError;
            }

            preferBackendUploadRef.current = true;
            uploadedUrl = await uploadViaBackend();
          }
        }

        updateUploadState((prev) => ({
          ...prev,
          currentFileProgress: 100,
          overallProgress: 100,
          completedFiles: 1,
        }));

        onUploaded(uploadedUrl);
      } catch (error) {
        if (!isAbortError(error)) {
          toast.error(t('audioUploadFailed'));
        }
      } finally {
        abortAllActiveUploads();
        setUploading(false);
        updateUploadState(INITIAL_UPLOAD_STATE);
        e.target.value = '';
      }
    },
    [abortAllActiveUploads, onUploaded, t, updateUploadState],
  );

  return {
    uploading,
    uploadState,
    handleFileSelect,
    cancelUpload,
  };
}
