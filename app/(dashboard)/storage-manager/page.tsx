'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import ConfirmModal, { useConfirmModal } from '@/components/ui/confirm-modal';
import Loading from '@/components/ui/loading';
import Table from '@/components/ui/table';
import Tooltip from '@/components/ui/tooltip';
import Tabs from '@/components/ui/tabs';
import PreviewModal from '@/components/ui/preview-modal';
import { downloadFile } from '@/lib/download-utils';
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
  LuReceipt,
  LuImage,
  LuPackage,
  LuFileImage,
  LuFileVideo,
  LuFileAudio,
  LuFileText,
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

/** Unified row type for the Table component (folders + files). */
interface StorageRow {
  _id: string;
  name: string;
  isFolder: boolean;
  key: string;
  size: number;
  lastModified: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
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
  if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
    return 'document';
  }

  return 'document';
}

const SPECIAL_FOLDERS: Record<string, { label: string; icon: React.ReactNode }> = {
  invoice: { label: 'Invoices', icon: <LuReceipt size={18} /> },
  products: { label: 'Products', icon: <LuPackage size={18} /> },
  images: { label: 'Website Images', icon: <LuImage size={18} /> },
};

function getFolderIcon(folderName: string): React.ReactNode {
  const special = SPECIAL_FOLDERS[folderName.toLowerCase()];
  if (special) return special.icon;
  return <LuFolder size={18} />;
}

function getFileIcon(fileName: string): { icon: React.ReactNode; colorClass: string } {
  const type = getFileType(fileName);
  switch (type) {
    case 'image':
      return { icon: <LuFileImage size={18} />, colorClass: 'text-green-500' };
    case 'video':
      return { icon: <LuFileVideo size={18} />, colorClass: 'text-purple-500' };
    case 'audio':
      return { icon: <LuFileAudio size={18} />, colorClass: 'text-orange-500' };
    case 'document':
      return { icon: <LuFileText size={18} />, colorClass: 'text-blue-500' };
    default:
      return { icon: <LuFile size={18} />, colorClass: 'text-muted-foreground' };
  }
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
  const [publicUrl, setPublicUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
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
        if (data.publicUrl) setPublicUrl(data.publicUrl);
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
    const allKeys = filteredFiles.map((f) => f.key);

    if (selectedItems.size === allKeys.length && allKeys.length > 0) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allKeys));
    }
  };

  const handleDelete = async (overrideKeys?: string[]) => {
    const keysToDelete = overrideKeys ?? Array.from(selectedItems);
    if (keysToDelete.length === 0) return;

    const confirmed = await confirm({
      title: t('buttons.delete'),
      message: `Are you sure you want to delete ${keysToDelete.length} item(s)? This action cannot be undone.`,
      confirmText: t('buttons.delete'),
      cancelText: t('buttons.back'),
    });

    if (!confirmed) return;

    try {
      const response = await fetch('/api/storage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: keysToDelete }),
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
    if (downloadingKey) return;
    const fileName = key.split('/').pop() || key;
    const fullUrl = publicUrl ? `${publicUrl}/${key}` : '';
    if (!fullUrl) {
      toast.error('Download URL not available');
      return;
    }
    setDownloadingKey(key);
    try {
      await downloadFile(fullUrl, fileName);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    } finally {
      setDownloadingKey(null);
    }
  };

  const handlePreview = (key: string) => {
    const fileName = key.split('/').pop() || key;
    const fullUrl = publicUrl ? `${publicUrl}/${key}` : '';
    if (!fullUrl) {
      toast.error('Preview URL not available');
      return;
    }
    setPreviewFile({
      url: fullUrl,
      name: fileName,
      type: getFileType(fileName),
    });
  };

  const handleBulkDownload = async () => {
    if (selectedItems.size === 0) return;

    setBulkDownloading(true);
    try {
      const keys = Array.from(selectedItems);
      const folderName = currentPath ? currentPath.split('/').pop()! : 'root';

      const response = await fetch('/api/storage/bulk-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, folderName }),
      });

      if (!response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/json')) {
          const error = await response.json();
          toast.error(error.error || 'Failed to create bulk download');
        } else {
          toast.error(`Server error (${response.status})`);
        }
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const dateTime = new Date()
        .toISOString()
        .replace('T', '_')
        .replace(/:/g, '-')
        .split('.')[0];
      const safeFolderName = folderName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filename = `${safeFolderName}-${dateTime}.zip`;

      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

      toast.success(`Downloading ${keys.length} file${keys.length !== 1 ? 's' : ''} as ${filename}`);
    } catch (error) {
      console.error('Error creating bulk download:', error);
      toast.error('Failed to create bulk download');
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleRefresh = () => {
    loadFolder(currentPath);
  };

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const filteredFiles = useMemo(
    () => folderStructure ? filterFilesByType(folderStructure.files, activeTab) : [],
    [folderStructure, activeTab],
  );

  // Build unified rows: folders first, then filtered files
  const rows: StorageRow[] = useMemo(() => {
    if (!folderStructure) return [];
    const folderRows: StorageRow[] = folderStructure.folders.map((folder) => ({
      _id: `folder-${folder}`,
      name: SPECIAL_FOLDERS[folder.toLowerCase()]?.label || folder,
      isFolder: true,
      key: folder,
      size: 0,
      lastModified: '',
    }));
    const fileRows: StorageRow[] = filteredFiles.map((file) => ({
      _id: file.key,
      name: file.key.split('/').pop() || file.key,
      isFolder: false,
      key: file.key,
      size: file.size,
      lastModified: file.lastModified,
    }));
    return [...folderRows, ...fileRows];
  }, [folderStructure, filteredFiles]);

  const tabOptions = [
    { value: 'all', label: t('tabs.all') },
    { value: 'image', label: t('tabs.images') },
    { value: 'audio', label: t('tabs.audio') },
    { value: 'video', label: t('tabs.video') },
    { value: 'document', label: t('tabs.documents') },
  ];

  const isBusy = !!downloadingKey || bulkDownloading;

  // Build columns for the Table component
  const columns = useMemo(() => [
    {
      header: (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              filteredFiles.length > 0 &&
              selectedItems.size === filteredFiles.length
            }
            onChange={toggleSelectAll}
          />
          <span>{t('table.name')}</span>
        </div>
      ),
      accessor: (row: StorageRow) => {
        if (row.isFolder) {
          return (
            <div className="flex items-center gap-3">
              <span className="text-primary">
                {getFolderIcon(row.key)}
              </span>
              <button
                onClick={() => navigateToFolder(row.key)}
                className="text-foreground hover:text-primary font-medium"
              >
                {row.name}
              </button>
            </div>
          );
        }
        const { icon, colorClass } = getFileIcon(row.name);
        return (
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selectedItems.has(row.key)}
              onChange={() => toggleSelection(row.key)}
            />
            <span className={colorClass}>{icon}</span>
            <span className="text-foreground truncate" title={row.name}>
              {row.name}
            </span>
          </div>
        );
      },
      className: 'min-w-48',
    },
    {
      header: t('table.size'),
      accessor: (row: StorageRow) =>
        row.isFolder ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <span className="text-muted-foreground">{formatFileSize(row.size)}</span>
        ),
      className: 'whitespace-nowrap',
    },
    {
      header: t('table.lastModified'),
      accessor: (row: StorageRow) =>
        row.isFolder ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <span className="text-muted-foreground">{formatDate(row.lastModified)}</span>
        ),
      className: 'whitespace-nowrap',
    },
    {
      header: t('table.actions'),
      accessor: (row: StorageRow) => {
        if (row.isFolder) {
          return <span className="text-muted-foreground">-</span>;
        }
        return (
          <div className="flex items-center gap-1">
            <Tooltip
              content={t('tooltips.preview')}
              position={locale === 'ar' ? 'right' : 'left'}
            >
              <Button
                onClick={() => handlePreview(row.key)}
                variant="ghost"
                size="sm"
                disabled={isBusy}
              >
                <LuEye />
              </Button>
            </Tooltip>
            <Tooltip
              content={t('tooltips.download')}
              position={locale === 'ar' ? 'right' : 'left'}
            >
              <Button
                onClick={() => handleDownload(row.key)}
                variant="ghost"
                size="sm"
                disabled={isBusy}
              >
                {downloadingKey === row.key ? (
                  <LuRefreshCw className="animate-spin" />
                ) : (
                  <LuDownload />
                )}
              </Button>
            </Tooltip>
            <Tooltip
              content={t('tooltips.delete')}
              position={locale === 'ar' ? 'right' : 'left'}
            >
              <Button
                onClick={() => handleDelete([row.key])}
                variant="ghost"
                size="sm"
                disabled={isBusy}
                className="text-error hover:text-error"
              >
                <LuTrash2 />
              </Button>
            </Tooltip>
          </div>
        );
      },
      className: 'whitespace-nowrap',
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [filteredFiles, selectedItems, downloadingKey, isBusy, locale, t]);

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
      <div className="flex items-center gap-2 mb-4 text-sm flex-wrap">
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
              className={`hover:text-primary ${index === breadcrumbs.length - 1
                ? 'text-primary font-semibold'
                : ''
                }`}
            >
              {SPECIAL_FOLDERS[crumb.toLowerCase()]?.label || crumb}
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
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
                disabled={bulkDownloading}
              >
                {bulkDownloading ? (
                  <>
                    <Loading size="xs" inline className="mr-2" />
                  </>
                ) : (
                  <>
                    <LuDownload className="mr-2" />
                    {t('buttons.download')} ({selectedItems.size})
                  </>
                )}
              </Button>
              <Button onClick={() => handleDelete()} variant="danger" size="sm">
                <LuTrash2 className="mr-2" />
                {t('buttons.delete')} ({selectedItems.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <Table<StorageRow>
        columns={columns}
        data={rows}
        loading={loading}
        emptyMessage={t('table.empty')}
      />

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
