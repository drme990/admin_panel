'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuFileText, LuFileSpreadsheet, LuSheet } from 'react-icons/lu';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import { Order } from '@/types/Order';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  date: string;
}

interface ExportRow {
  orderNumber: string;
  sacrificeFor: string;
  items: string;
  photo: string;
  design: string;
  duaa: string;
  paidAmount: string;
  remainingAmount: string;
  status: string;
  source: string;
  updatedAt: string;
}

function getReservationValue(order: Order, key: string): string | undefined {
  return order.reservationData?.find((f) => f.key === key)?.value;
}

function getNameLines(value?: string): string[] {
  if (!value) return [];
  return value
    .replace(/\n/g, ',')
    .replace(/;/g, ',')
    .replace(/\r/g, ',')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDate(dateValue?: string, locale: string = 'en'): string {
  if (!dateValue) return 'N/A';
  try {
    return new Date(dateValue).toLocaleDateString(
      locale === 'ar' ? 'ar-SA' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    );
  } catch {
    return dateValue;
  }
}

function buildExportRows(orders: Order[], locale: string): ExportRow[] {
  return orders.map((order) => {
    const names = getNameLines(getReservationValue(order, 'sacrificeFor'));
    const items = (order.items || [])
      .map((item) => {
        const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
        const qty = item.quantity || 1;
        return qty > 1 ? `${qty} ${name}` : (name || '');
      })
      .join(', ');

    return {
      orderNumber: order.orderNumber,
      sacrificeFor: names.join(', '),
      items,
      photo: getReservationValue(order, 'photo') || '',
      design: getReservationValue(order, 'design') || '',
      duaa: getReservationValue(order, 'shortDuaa') || '',
      paidAmount: `${typeof order.paidAmount === 'number' ? order.paidAmount.toFixed(2) : (order.totalAmount || 0).toFixed(2)} ${order.currency}`,
      remainingAmount: `${(order.remainingAmount ?? 0).toFixed(2)} ${order.currency}`,
      status: order.status,
      source: order.source || 'manasik',
      updatedAt: formatDate(order.statusUpdateTime, locale),
    };
  });
}

function getHeaders(t: (key: string) => string): string[] {
  return [
    t('export.headers.orderNumber'),
    t('export.headers.sacrificeFor'),
    t('export.headers.items'),
    t('export.headers.photo'),
    t('export.headers.design'),
    t('export.headers.duaa'),
    t('export.headers.paidAmount'),
    t('export.headers.remainingAmount'),
    t('export.headers.status'),
    t('export.headers.source'),
    t('export.headers.updatedAt'),
  ];
}

function rowToArray(row: ExportRow): string[] {
  return [
    row.orderNumber,
    row.sacrificeFor,
    row.items,
    row.photo,
    row.design,
    row.duaa,
    row.paidAmount,
    row.remainingAmount,
    row.status,
    row.source,
    row.updatedAt,
  ];
}

export default function ExportModal({ isOpen, onClose, orders, date }: ExportModalProps) {
  const t = useTranslations('execution');
  const locale = useLocale();

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    const rows = buildExportRows(orders, locale);
    const headers = getHeaders(t);
    const filename = `execution-${date || 'all'}`;

    try {
      if (format === 'pdf') {
        exportPdf(headers, rows, filename, date, t);
      } else if (format === 'csv') {
        exportCsv(headers, rows, filename);
      } else {
        exportXlsx(headers, rows, filename, t);
      }
      toast.success(t('export.success'));
      onClose();
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
      toast.error(t('export.failed'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('export.title')}
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            {t('export.cancel')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 py-2">
        <Button
          variant="outline"
          onClick={() => handleExport('csv')}
          className="justify-start gap-3 h-14"
        >
          <LuFileSpreadsheet size={22} className="text-success" />
          <div className="text-start">
            <p className="font-semibold">{t('export.csv')}</p>
            <p className="text-xs text-secondary">{t('export.csvDescription')}</p>
          </div>
        </Button>

        <Button
          variant="outline"
          onClick={() => handleExport('xlsx')}
          className="justify-start gap-3 h-14"
        >
          <LuSheet size={22} className="text-primary" />
          <div className="text-start">
            <p className="font-semibold">{t('export.xlsx')}</p>
            <p className="text-xs text-secondary">{t('export.xlsxDescription')}</p>
          </div>
        </Button>

        <Button
          variant="outline"
          onClick={() => handleExport('pdf')}
          className="justify-start gap-3 h-14"
        >
          <LuFileText size={22} className="text-error" />
          <div className="text-start">
            <p className="font-semibold">{t('export.pdf')}</p>
            <p className="text-xs text-secondary">{t('export.pdfDescription')}</p>
          </div>
        </Button>
      </div>
    </Modal>
  );
}

/* ── CSV ─────────────────────────────────────────────── */
function exportCsv(headers: string[], rows: ExportRow[], filename: string) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => rowToArray(row).map(escape).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

/* ── XLSX ────────────────────────────────────────────── */
function exportXlsx(
  headers: string[],
  rows: ExportRow[],
  filename: string,
  t: (key: string) => string,
) {
  const data = [headers, ...rows.map(rowToArray)];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = rowToArray(row)[i] || '';
      if (cell.length > max) max = cell.length;
    }
    return { wch: Math.min(max + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, t('export.sheetName'));
  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `${filename}.xlsx`);
}

/* ── PDF ─────────────────────────────────────────────── */
function exportPdf(
  headers: string[],
  rows: ExportRow[],
  filename: string,
  date: string,
  t: (key: string, values?: Record<string, string>) => string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const title = t('export.pdfTitle', { date: date || t('export.noDate') });
  doc.setFontSize(14);
  doc.text(title, 14, 15);

  autoTable(doc as Parameters<typeof autoTable>[0], {
    head: [headers],
    body: rows.map(rowToArray),
    startY: 22,
    styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [66, 133, 244], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 10, right: 10 },
  });

  doc.save(`${filename}.pdf`);
}

/* ── Shared download helper ──────────────────────────── */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
