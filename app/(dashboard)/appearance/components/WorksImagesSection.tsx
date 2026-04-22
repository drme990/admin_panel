'use client';

import { ImageRowEditor } from './ImageRowEditor';
import { WorksImages } from '@/types/Appearance';

interface WorksImagesSectionProps {
  images: WorksImages;
  uploadingRow: 'row1' | 'row2' | null;
  onUploadRow1: (file: File) => void;
  onUploadRow2: (file: File) => void;
  onDeleteRow1: (index: number) => void;
  onDeleteRow2: (index: number) => void;
  onMoveRow1: (index: number) => void;
  onMoveRow2: (index: number) => void;
  onReorderUpRow1: (index: number) => void;
  onReorderDownRow1: (index: number) => void;
  onReorderUpRow2: (index: number) => void;
  onReorderDownRow2: (index: number) => void;
  title: string;
  description: string;
  row1Label: string;
  row2Label: string;
  moveToRow2Label: string;
  moveToRow1Label: string;
  moveEarlierLabel: string;
  moveLaterLabel: string;
  noImagesLabel: string;
  addImageLabel: string;
  uploadingLabel: string;
}

export function WorksImagesSection({
  images,
  uploadingRow,
  onUploadRow1,
  onUploadRow2,
  onDeleteRow1,
  onDeleteRow2,
  onMoveRow1,
  onMoveRow2,
  onReorderUpRow1,
  onReorderDownRow1,
  onReorderUpRow2,
  onReorderDownRow2,
  title,
  description,
  row1Label,
  row2Label,
  moveToRow2Label,
  moveToRow1Label,
  moveEarlierLabel,
  moveLaterLabel,
  noImagesLabel,
  addImageLabel,
  uploadingLabel,
}: WorksImagesSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-secondary mt-0.5">{description}</p>
      </div>

      <ImageRowEditor
        label={row1Label}
        images={images.row1}
        row="row1"
        uploading={uploadingRow === 'row1'}
        onUpload={onUploadRow1}
        onDelete={onDeleteRow1}
        onMove={onMoveRow1}
        onReorderUp={onReorderUpRow1}
        onReorderDown={onReorderDownRow1}
        moveLabel={moveToRow2Label}
        moveEarlierLabel={moveEarlierLabel}
        moveLaterLabel={moveLaterLabel}
        emptyText={noImagesLabel}
        addLabel={addImageLabel}
        uploadingLabel={uploadingLabel}
      />

      <ImageRowEditor
        label={row2Label}
        images={images.row2}
        row="row2"
        uploading={uploadingRow === 'row2'}
        onUpload={onUploadRow2}
        onDelete={onDeleteRow2}
        onMove={onMoveRow2}
        onReorderUp={onReorderUpRow2}
        onReorderDown={onReorderDownRow2}
        moveLabel={moveToRow1Label}
        moveEarlierLabel={moveEarlierLabel}
        moveLaterLabel={moveLaterLabel}
        emptyText={noImagesLabel}
        addLabel={addImageLabel}
        uploadingLabel={uploadingLabel}
      />
    </div>
  );
}
