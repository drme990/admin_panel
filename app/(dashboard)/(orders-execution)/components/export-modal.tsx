'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { LuFileText, LuFileSpreadsheet, LuSheet } from 'react-icons/lu';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';

import Modal from '@/components/ui/modal';
import Button from '@/components/ui/button';
import Checkbox from '@/components/ui/checkbox';
import { Order } from '@/types/Order';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  date: string;
}

interface ExportRow {
  orderNumber: string;
  fullName: string;
  phone: string;
  email: string;
  country: string;
  items: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  currency: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

type ExportColumnKey = keyof ExportRow;

interface ExportColumn {
  key: ExportColumnKey;
  labelKey: string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'orderNumber', labelKey: 'export.headers.orderNumber' },
  { key: 'fullName', labelKey: 'export.headers.fullName' },
  { key: 'phone', labelKey: 'export.headers.phone' },
  { key: 'email', labelKey: 'export.headers.email' },
  { key: 'country', labelKey: 'export.headers.country' },
  { key: 'items', labelKey: 'export.headers.items' },
  { key: 'totalAmount', labelKey: 'export.headers.totalAmount' },
  { key: 'paidAmount', labelKey: 'export.headers.paidAmount' },
  { key: 'remainingAmount', labelKey: 'export.headers.remainingAmount' },
  { key: 'currency', labelKey: 'export.headers.currency' },
  { key: 'status', labelKey: 'export.headers.status' },
  { key: 'source', labelKey: 'export.headers.source' },
  { key: 'createdAt', labelKey: 'export.headers.createdAt' },
  { key: 'updatedAt', labelKey: 'export.headers.updatedAt' },
];

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

function formatAmount(amount?: number): string {
  if (typeof amount !== 'number') return '0.00';
  return amount.toFixed(2);
}

function buildExportRows(orders: Order[], locale: string): ExportRow[] {
  return orders.map((order) => {
    const bd = order.billingData;
    const currency = order.currency || '';

    const items = (order.items || [])
      .map((item) => {
        const name = locale === 'ar' ? item.productName?.ar : item.productName?.en;
        const qty = item.quantity || 1;
        return qty > 1 ? `${qty}x ${name}` : (name || '');
      })
      .join(', ');

    return {
      orderNumber: order.orderNumber || '',
      fullName: bd?.fullName || '',
      phone: bd?.phone || '',
      email: bd?.email || '',
      country: bd?.country || '',
      items,
      totalAmount: formatAmount(order.totalAmount),
      paidAmount: formatAmount(order.paidAmount ?? order.totalAmount),
      remainingAmount: formatAmount(order.remainingAmount ?? 0),
      currency,
      status: order.status || '',
      source: order.source || 'manasik',
      createdAt: formatDate(order.createdAt, locale),
      updatedAt: formatDate(order.statusUpdateTime || order.updatedAt, locale),
    };
  });
}

export default function ExportModal({ isOpen, onClose, orders, date }: ExportModalProps) {
  const t = useTranslations('execution');
  const locale = useLocale();

  const [selectedColumns, setSelectedColumns] = useState<Set<ExportColumnKey>>(
    () => new Set(EXPORT_COLUMNS.map((c) => c.key)),
  );

  const activeColumns = EXPORT_COLUMNS.filter((c) => selectedColumns.has(c.key));
  const hasSelectedColumns = activeColumns.length > 0;

  const toggleColumn = (key: ExportColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(new Set(EXPORT_COLUMNS.map((c) => c.key)));
  };

  const deselectAllColumns = () => {
    setSelectedColumns(new Set());
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (activeColumns.length === 0) return;

    const allRows = buildExportRows(orders, locale);
    const headers = activeColumns.map((c) => t(c.labelKey));
    const rows = allRows.map((row) => activeColumns.map((c) => row[c.key]));
    const filename = `execution-${date || 'all'}`;

    try {
      if (format === 'pdf') {
        await exportPdf(headers, rows, filename, date, t);
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
      size="md"
    >
      <div className="space-y-4 py-2">
        {/* Column selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">
              {t('export.columnsTitle')}
            </h4>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAllColumns}
              >
                {t('export.selectAll')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAllColumns}
              >
                {t('export.deselectAll')}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-stroke bg-background p-3">
            {EXPORT_COLUMNS.map((column) => (
              <div
                key={column.key}
                className="flex items-center gap-2 text-sm text-foreground hover:bg-foreground/5 cursor-pointer rounded px-2 py-1.5"
                onClick={() => toggleColumn(column.key)}
              >
                <Checkbox
                  checked={selectedColumns.has(column.key)}
                  onChange={() => toggleColumn(column.key)}
                  size="sm"
                />
                <span className="truncate">{t(column.labelKey)}</span>
              </div>
            ))}
          </div>

          {!hasSelectedColumns && (
            <p className="text-xs text-error">{t('export.noColumnsSelected')}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={!hasSelectedColumns}
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
            disabled={!hasSelectedColumns}
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
            disabled={!hasSelectedColumns}
            className="justify-start gap-3 h-14"
          >
            <LuFileText size={22} className="text-error" />
            <div className="text-start">
              <p className="font-semibold">{t('export.pdf')}</p>
              <p className="text-xs text-secondary">{t('export.pdfDescription')}</p>
            </div>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ── CSV ─────────────────────────────────────────────── */
function exportCsv(headers: string[], rows: string[][], filename: string) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filename}.csv`);
}

/* ── XLSX ────────────────────────────────────────────── */
function exportXlsx(
  headers: string[],
  rows: string[][],
  filename: string,
  t: (key: string) => string,
) {
  const data = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[i] || '';
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
async function exportPdf(
  headers: string[],
  rows: string[][],
  filename: string,
  date: string,
  t: (key: string, values?: Record<string, string>) => string,
) {
  const title = t('export.pdfTitle', { date: date || t('export.noDate') });

  // Build an off-screen HTML table so the browser handles Arabic/RTL natively
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:1400px;font-family:sans-serif;font-size:12px;background:#fff;padding:16px;direction:ltr;z-index:-1;';

  const titleEl = document.createElement('h3');
  titleEl.textContent = title;
  titleEl.style.cssText = 'margin:0 0 12px 0;font-size:16px;font-weight:600;color:#111827;';
  wrapper.appendChild(titleEl);

  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;';

  // Header row
  const thead = document.createElement('thead');
  const hRow = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    th.style.cssText =
      'background:#3b82f6;color:#fff;padding:8px 6px;text-align:left;border:1px solid #2563eb;font-weight:600;white-space:nowrap;font-size:12px;';
    hRow.appendChild(th);
  });
  thead.appendChild(hRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  rows.forEach((row, i) => {
    const bRow = document.createElement('tr');
    bRow.style.cssText = `background-color:${i % 2 === 1 ? '#f5f7fa' : '#ffffff'};`;
    row.forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell;
      td.style.cssText =
        'padding:6px 6px;border:1px solid #e5e7eb;word-break:break-word;font-size:11px;color:#111827;';
      bRow.appendChild(td);
    });
    tbody.appendChild(bRow);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  document.body.appendChild(wrapper);

  // Render DOM to canvas via html2canvas (handles Arabic natively)
  const canvas = await html2canvas(wrapper, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  });

  document.body.removeChild(wrapper);

  const dataUrl = canvas.toDataURL('image/png');

  // Fit image into A4 landscape
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297 - 20; // 10mm margin each side
  const pageH = 210 - 20;
  const imgW = canvas.width / 2;
  const imgH = canvas.height / 2;
  const imgRatio = imgW / imgH;
  const pageRatio = pageW / pageH;

  let drawW: number;
  let drawH: number;
  if (imgRatio > pageRatio) {
    drawW = pageW;
    drawH = pageW / imgRatio;
  } else {
    drawH = pageH;
    drawW = pageH * imgRatio;
  }

  doc.addImage(dataUrl, 'PNG', 10, 10, drawW, drawH);
  doc.save(`${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
