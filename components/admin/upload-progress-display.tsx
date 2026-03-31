'use client';

import React from 'react';
import Button from '@/components/ui/button';
import type { UploadProgressState } from '@/hooks/use-media-upload';

interface UploadProgressDisplayProps {
  uploadProgress: UploadProgressState;
  onCancel: () => void;
  cancelDisabled?: boolean;
}

export default function UploadProgressDisplay({
  uploadProgress,
  onCancel,
  cancelDisabled = false,
}: UploadProgressDisplayProps) {
  if (!uploadProgress.isUploading) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-5 z-120 px-3 pt-2 pointer-events-none">
      <div className="mx-auto max-w-4xl rounded-lg border border-success/40 bg-card-bg shadow-lg pointer-events-auto overflow-hidden">
        {/* Progress Info Header */}
        <div className="px-4 py-3 flex items-center justify-between gap-3 bg-card-bg/50 border-b border-stroke/20">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-secondary truncate">
              Uploading:{' '}
              <span className="font-medium text-foreground">
                {uploadProgress.currentFileName || 'file'}
              </span>
            </p>
            {uploadProgress.totalFiles > 1 && (
              <p className="text-xs text-secondary mt-1">
                {uploadProgress.completedFiles}/{uploadProgress.totalFiles}{' '}
                files
              </p>
            )}
          </div>

          {/* Stats: Speed, Time, Progress */}
          <div className="flex items-center gap-4 text-right shrink-0">
            {uploadProgress.uploadSpeed && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-secondary">Speed</span>
                <span className="text-sm font-semibold text-success">
                  {uploadProgress.uploadSpeed}
                </span>
              </div>
            )}
            {uploadProgress.timeRemaining && (
              <div className="flex flex-col items-end">
                <span className="text-xs text-secondary">Time left</span>
                <span className="text-sm font-semibold text-foreground">
                  {uploadProgress.timeRemaining}
                </span>
              </div>
            )}
            <div className="flex flex-col items-end">
              <span className="text-xs text-secondary">Progress</span>
              <span className="text-sm font-bold text-success">
                {uploadProgress.overallProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bars */}
        <div className="space-y-2 bg-background/50 px-4 py-3">
          {/* Overall Progress */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-secondary w-10 shrink-0">
              Overall
            </span>
            <div className="flex-1 h-2 bg-stroke/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-[width] duration-300"
                style={{ width: `${uploadProgress.overallProgress}%` }}
              />
            </div>
          </div>

          {/* Current File Progress (only for single file) */}
          {uploadProgress.totalFiles === 1 &&
            uploadProgress.currentFileProgress > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-secondary w-10 shrink-0">
                  File
                </span>
                <div className="flex-1 h-1.5 bg-stroke/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-success/70 rounded-full transition-[width] duration-100"
                    style={{ width: `${uploadProgress.currentFileProgress}%` }}
                  />
                </div>
              </div>
            )}
        </div>

        {/* Cancel Button */}
        <div className="px-4 py-3 border-t border-stroke/20 flex justify-end bg-card-bg/30">
          <Button
            type="button"
            onClick={onCancel}
            disabled={cancelDisabled}
            variant="outline"
            className="text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
