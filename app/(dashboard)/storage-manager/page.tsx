'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Loading from '@/components/ui/loading';
import Tooltip from '@/components/ui/tooltip';
import Tabs from '@/components/ui/tabs';
import PreviewModal from '@/components/ui/preview-modal';
import { toast } from 'react-toastify';
import {
  LuFolder,
  LuFile,
  LuChevronRight,
  LuDownload,
  LuTrash2,
  LuRefreshCw,
  LuArrowLeft,
  LuEye,
} from 'react-icons/lu';

interface R2Object {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
  isFolder: boolean;
}

interface R2FolderStructure {
  folders: string[];
  files: R2Object[];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function getFileType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(extension)) {
    return 'image';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(extension)) {
    return 'audio';
  }
  if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(extension)) {
    return 'video';
  }

  return 'document';
}

function filterFilesByType(files: R2Object[], filterType: string): R2Object[] {
  if (filterType === 'all') return files;

  return files.filter((file) => {
    const fileName = file.key.split('/').pop() || '';
    const fileType = getFileType(fileName);
    return fileType === filterType;
  });
}

export default function StorageManager() {
  const t = useTranslations('admin.storageManager');
  const locale = useLocale();
  const { confirm, modalProps } = useConfirmModal();

  const [currentPath, setCurrentPath] = useState('');
  const [folderStructure, setFolderStructure] =
    useState<R2FolderStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);

  const loadFolder = useCallback(async (path: string) => {
    setLoading(true);
    setSelectedItems(new Set());
    try {
      const response = await fetch(
        `/api/storage?prefix=${encodeURIComponent(path)}`,
      );
      const data = await response.json();

      if (data.success) {
        setFolderStructure(data.data);
      } else {
        toast.error(data.error || 'Failed to load folder');
      }
    } catch (error) {
      console.error('Error loading folder:', error);
      toast.error('Failed to load folder');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentPath);
  }, [currentPath, loadFolder]);

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    const parts = currentPath.split('/');
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  const toggleSelection = (key: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedItems(newSelection);
  };

  const toggleSelectAll = () => {
    if (!folderStructure) return;

    const filteredFiles = filterFilesByType(folderStructure.files, activeTab);
    const allKeys = [
      ...folderStructure.folders.map(
        (f) => `${currentPath ? currentPath + '/' : ''}${f}/`,
      ),
      ...filteredFiles.map((f) => f.key),
    ];

    if (selectedItems.size === allKeys.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allKeys));
    }
  };

  const handleDelete = async () => {
    if (selectedItems.size === 0) return;

    const confirmed = await confirm({
      title: t('buttons.delete'),
      message: `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`,
      confirmText: t('buttons.delete'),
      cancelText: t('buttons.back'),
    });

    if (!confirmed) return;

    try {
      const keys = Array.from(selectedItems);
      const response = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Deleted ${data.deleted.length} item(s)`);
        setSelectedItems(new Set());
        loadFolder(currentPath);
      } else {
        toast.error(data.error || 'Failed to delete items');
      }
    } catch (error) {
      console.error('Error deleting items:', error);
      toast.error('Failed to delete items');
    }
  };

  const handleDownload = async (key: string) => {
    setDownloading(true);
    try {
      const response = await fetch('/api/storage/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (data.success) {
        window.open(data.downloadUrl, '_blank');
      } else {
        toast.error(data.error || 'Failed to generate download URL');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async (key: string) => {
    setDownloading(true);
    try {
      const response = await fetch('/api/storage/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });

      const data = await response.json();

      if (data.success) {
        const fileName = key.split('/').pop() || key;
        setPreviewFile({
          url: data.downloadUrl,
          name: fileName,
          type: getFileType(fileName),
        });
      } else {
        toast.error(data.error || 'Failed to generate preview URL');
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      toast.error('Failed to preview file');
    } finally {
      setDownloading(false);
    }
  };

  const handleBulkDownload = async () => {
    if (selectedItems.size === 0) return;

    setDownloading(true);
    try {
      const keys = Array.from(selectedItems);
      const response = await fetch('/api/storage/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || 'Failed to create bulk download');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `download-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Download started');
    } catch (error) {
      console.error('Error creating bulk download:', error);
      toast.error('Failed to create bulk download');
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    loadFolder(currentPath);
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const filteredFiles = folderStructure
    ? filterFilesByType(folderStructure.files, activeTab)
    : [];

  const tabOptions = [
    { value: 'all', label: t('tabs.all') },
    { value: 'image', label: t('tabs.images') },
    { value: 'audio', label: t('tabs.audio') },
    { value: 'video', label: t('tabs.video') },
    { value: 'document', label: t('tabs.documents') },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>

        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="flex gap-2"
        >
          <LuRefreshCw />
          {t('buttons.refresh')}
        </Button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <button
          onClick={() => setCurrentPath('')}
          className={`hover:text-primary ${!currentPath ? 'text-primary font-semibold' : ''}`}
        >
          Root
        </button>
        {breadcrumbs.map((crumb, index) => (
          <div key={index} className="flex items-center gap-2">
            <LuChevronRight className="text-muted-foreground" />
            <button
              onClick={() =>
                setCurrentPath(breadcrumbs.slice(0, index + 1).join('/'))
              }
              className={`hover:text-primary ${
                index === breadcrumbs.length - 1
                  ? 'text-primary font-semibold'
                  : ''
              }`}
            >
              {crumb}
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {currentPath && (
            <Button
              onClick={navigateUp}
              variant="outline"
              size="sm"
              className="flex gap-2"
            >
              <LuArrowLeft className={locale === 'ar' ? 'rotate-180' : ''} />
              {t('buttons.back')}
            </Button>
          )}

          {!loading && folderStructure && folderStructure.files.length > 0 && (
            <Tabs
              value={activeTab}
              options={tabOptions}
              onChange={setActiveTab}
              size="sm"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <>
              <Button
                onClick={handleBulkDownload}
                variant="outline"
                size="sm"
                disabled={downloading}
              >
                <LuDownload className="mr-2" />
                {t('buttons.download')} ({selectedItems.size})
              </Button>
              <Button onClick={handleDelete} variant="danger" size="sm">
                <LuTrash2 className="mr-2" />
                {t('buttons.delete')} ({selectedItems.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && <Loading />}

      {/* Folder Structure */}
      {!loading && folderStructure && (
        <div className="border border-stroke rounded-lg overflow-hidden bg-background">
          {/* Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted border-b border-stroke text-sm font-semibold text-muted-foreground">
            <div className="col-span-6 flex items-center gap-2">
              <Checkbox
                checked={
                  folderStructure.folders.length + filteredFiles.length > 0 &&
                  selectedItems.size ===
                    folderStructure.folders.length + filteredFiles.length
                }
                onChange={toggleSelectAll}
              />
              <span>{t('table.name')}</span>
            </div>
            <div className="col-span-2">{t('table.size')}</div>
            <div className="col-span-3">{t('table.lastModified')}</div>
            <div className="col-span-1">{t('table.actions')}</div>
          </div>

          {/* Folders */}
          {folderStructure.folders.map((folder) => {
            return (
              <div
                key={folder}
                className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-stroke hover:bg-muted/50 items-center"
              >
                <div className="col-span-6 flex items-center gap-3">
                  <LuFolder className="text-blue-500" />
                  <button
                    onClick={() => navigateToFolder(folder)}
                    className="text-foreground hover:text-primary font-medium"
                  >
                    {folder}
                  </button>
                </div>
                <div className="col-span-2 text-muted-foreground">-</div>
                <div className="col-span-3 text-muted-foreground">-</div>
                <div className="col-span-1 flex items-center gap-2">-</div>
              </div>
            );
          })}

          {/* Files */}
          {filteredFiles.map((file) => (
            <div
              key={file.key}
              className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-stroke hover:bg-muted/50 items-center"
            >
              <div className="col-span-6 flex items-center gap-3">
                <Checkbox
                  checked={selectedItems.has(file.key)}
                  onChange={() => toggleSelection(file.key)}
                />
                <LuFile className="text-muted-foreground" />
                <span className="text-foreground">
                  {file.key.split('/').pop()}
                </span>
              </div>
              <div className="col-span-2 text-muted-foreground">
                {formatFileSize(file.size)}
              </div>
              <div className="col-span-3 text-muted-foreground">
                {formatDate(file.lastModified)}
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <Tooltip
                  content={t('tooltips.preview')}
                  position={locale === 'ar' ? 'right' : 'left'}
                >
                  <Button
                    onClick={() => handlePreview(file.key)}
                    variant="ghost"
                    size="sm"
                    disabled={downloading}
                  >
                    <LuEye />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={t('tooltips.download')}
                  position={locale === 'ar' ? 'right' : 'left'}
                >
                  <Button
                    onClick={() => handleDownload(file.key)}
                    variant="ghost"
                    size="sm"
                    disabled={downloading}
                  >
                    <LuDownload />
                  </Button>
                </Tooltip>
                <Tooltip
                  content={t('tooltips.delete')}
                  position={locale === 'ar' ? 'right' : 'left'}
                >
                  <Button
                    onClick={() => {
                      setSelectedItems(new Set([file.key]));
                      handleDelete();
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-error hover:text-error"
                  >
                    <LuTrash2 />
                  </Button>
                </Tooltip>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {!loading &&
            folderStructure.folders.length === 0 &&
            filteredFiles.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground">
                {t('table.empty')}
              </div>
            )}
        </div>
      )}

      <ConfirmModal {...modalProps} />

      {previewFile && (
        <PreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile.url}
          fileName={previewFile.name}
        />
      )}
    </div>
  );
}
