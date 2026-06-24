'use client';

import { useTranslations, useLocale } from 'next-intl';
import { LuFileText, LuFileSpreadsheet, LuSheet } from 'react-icons/lu';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
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

function getHeaders(t: (key: string) => string): string[] {
  return [
    t('export.headers.orderNumber'),
    t('export.headers.fullName'),
    t('export.headers.phone'),
    t('export.headers.email'),
    t('export.headers.country'),
    t('export.headers.items'),
    t('export.headers.totalAmount'),
    t('export.headers.paidAmount'),
    t('export.headers.remainingAmount'),
    t('export.headers.currency'),
    t('export.headers.status'),
    t('export.headers.source'),
    t('export.headers.createdAt'),
    t('export.headers.updatedAt'),
  ];
}

function rowToArray(row: ExportRow): string[] {
  return [
    row.orderNumber,
    row.fullName,
    row.phone,
    row.email,
    row.country,
    row.items,
    row.totalAmount,
    row.paidAmount,
    row.remainingAmount,
    row.currency,
    row.status,
    row.source,
    row.createdAt,
    row.updatedAt,
  ];
}

export default function ExportModal({ isOpen, onClose, orders, date }: ExportModalProps) {
  const t = useTranslations('execution');
  const locale = useLocale();

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    const rows = buildExportRows(orders, locale);
    const headers = getHeaders(t);
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
async function exportPdf(
  headers: string[],
  rows: ExportRow[],
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
    rowToArray(row).forEach((cell) => {
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
