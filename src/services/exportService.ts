import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, WidthType, AlignmentType, ShadingType, BorderStyle } from 'docx';
import * as XLSX from 'xlsx';

/**
 * Sanitizes strings for CSV and other text exports.
 * Converts Unicode special characters (en-dashes, em-dashes, curly quotes, bullets, non-breaking spaces)
 * into standard, legible ASCII/Unicode representations so that Microsoft Excel, Google Sheets,
 * and text editors display the actual characters properly without mojibake (e.g. â€“).
 */
export function sanitizeTextForExport(str: string | number | null | undefined): string {
  if (str === null || str === undefined) return '';
  let text = String(str);

  // HTML entity decode
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&bull;/g, '•')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-');

  // Convert special punctuation to standard characters
  text = text
    .replace(/[\u2013\u2014]/g, '-') // en-dash & em-dash to hyphen
    .replace(/[\u2018\u2019]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D]/g, '"') // curly double quotes
    .replace(/[\u2022\u2023\u25E6]/g, '-') // bullets to dash
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(/\r?\n/g, ' ') // replace unexpected newlines inside single cell with space
    .trim();

  return text;
}

export interface ExportTableData {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  filenamePrefix: string;
  scopeLabel?: string;
}

function getSafeFilenamePrefix(prefix: string | undefined | null): string {
  if (!prefix || prefix.includes('undefined') || prefix.trim() === '') {
    return 'export_data';
  }
  return prefix.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Exports data to CSV with UTF-8 BOM and sanitized characters.
 */
export function exportToCsv(data: ExportTableData): void {
  const safePrefix = getSafeFilenamePrefix(data.filenamePrefix);
  const sanitizedHeaders = data.headers.map(sanitizeTextForExport);
  const sanitizedRows = data.rows.map((row) =>
    row.map((cell) => {
      const sanitized = sanitizeTextForExport(cell);
      // Escape double quotes per RFC 4180
      return `"${sanitized.replace(/"/g, '""')}"`;
    })
  );

  const csvRows = [
    sanitizedHeaders.join(','),
    ...sanitizedRows.map((r) => r.join(',')),
  ];

  // Prepend UTF-8 Byte Order Mark (\uFEFF) so Excel opens UTF-8 encoded text properly
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${safePrefix}_${Date.now()}.csv`);
}

/**
 * Exports data to genuine Microsoft Excel (.xlsx) workbook using SheetJS.
 */
export function exportToExcel(data: ExportTableData): void {
  const sanitizedHeaders = data.headers.map(sanitizeTextForExport);
  const sanitizedRows = data.rows.map((row) => row.map(sanitizeTextForExport));

  const worksheetData = [
    [data.title],
    ...(data.subtitle ? [[data.subtitle]] : []),
    ...(data.scopeLabel ? [[`Scope: ${data.scopeLabel}`]] : []),
    [], // empty spacing row
    sanitizedHeaders,
    ...sanitizedRows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Auto-fit column widths
  const colWidths = sanitizedHeaders.map((header, colIdx) => {
    let maxLen = header.length;
    sanitizedRows.forEach((r) => {
      const val = String(r[colIdx] || '');
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 50) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Export');

  // Generate binary XLSX buffer and create a standard blob
  const safePrefix = getSafeFilenamePrefix(data.filenamePrefix);
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${safePrefix}_${Date.now()}.xlsx`);
}

/**
 * Exports data to native Microsoft Word (.docx) document using docx library.
 * Creates real OOXML .docx files with zero security warnings in Word.
 */
export async function exportToWord(data: ExportTableData): Promise<void> {
  const safePrefix = getSafeFilenamePrefix(data.filenamePrefix);
  const sanitizedHeaders = data.headers.map(sanitizeTextForExport);
  const sanitizedRows = data.rows.map((row) => row.map(sanitizeTextForExport));

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: sanitizedHeaders.map(
      (header) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: '0B192C' },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: header,
                  bold: true,
                  color: 'FFFFFF',
                  size: 20, // 10pt
                }),
              ],
            }),
          ],
        })
    ),
  });

  const tableDataRows = sanitizedRows.map((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    return new TableRow({
      children: row.map(
        (cell) =>
          new TableCell({
            shading: isEven ? { type: ShadingType.CLEAR, fill: 'F8FAFC' } : undefined,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: String(cell),
                    size: 19, // 9.5pt
                    color: '1E293B',
                  }),
                ],
              }),
            ],
          })
      ),
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: data.title,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 120 },
          }),
          ...(data.subtitle
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: data.subtitle,
                      italics: true,
                      color: '64748B',
                      size: 20,
                    }),
                  ],
                  spacing: { after: 80 },
                }),
              ]
            : []),
          ...(data.scopeLabel
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Scope: ${data.scopeLabel} | Generated: ${new Date().toLocaleString()}`,
                      bold: true,
                      color: '4338CA',
                      size: 18,
                    }),
                  ],
                  spacing: { after: 200 },
                }),
              ]
            : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [tableHeaderRow, ...tableDataRows],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${safePrefix}_${Date.now()}.docx`);
}

/**
 * Exports data to native PDF document using jsPDF + jspdf-autotable.
 * Generates valid binary PDF files with proper tabular formatting, headers, and pagination.
 */
export function exportToPdf(data: ExportTableData): void {
  const safePrefix = getSafeFilenamePrefix(data.filenamePrefix);
  const doc = new jsPDF({
    orientation: data.headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Document Title & Metadata
  doc.setFontSize(16);
  doc.setTextColor(11, 25, 44); // #0B192C
  doc.setFont('helvetica', 'bold');
  doc.text(data.title, 40, 40);

  let currentY = 58;

  if (data.subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(data.subtitle, 40, currentY);
    currentY += 16;
  }

  if (data.scopeLabel) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // #4338CA
    doc.text(`Scope: ${data.scopeLabel}  •  Exported on: ${new Date().toLocaleString()}`, 40, currentY);
    currentY += 18;
  }

  const sanitizedHeaders = data.headers.map(sanitizeTextForExport);
  const sanitizedRows = data.rows.map((row) => row.map(sanitizeTextForExport));

  autoTable(doc, {
    startY: currentY,
    head: [sanitizedHeaders],
    body: sanitizedRows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: [11, 25, 44],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
    didDrawPage: (hookData) => {
      // Footer page numbering
      const pageNumber = hookData.pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${pageNumber} of ${doc.getNumberOfPages()}  •  CIPPlatform Authoritative Export`,
        pageWidth - 240,
        doc.internal.pageSize.getHeight() - 20
      );
    },
  });

  doc.save(`${safePrefix}_${Date.now()}.pdf`);
}

/**
 * Universal Export Controller: Triggers the appropriate export format.
 */
export async function executeExport(
  format: 'pdf' | 'excel' | 'word' | 'csv',
  data: ExportTableData
): Promise<void> {
  switch (format) {
    case 'csv':
      exportToCsv(data);
      break;
    case 'excel':
      exportToExcel(data);
      break;
    case 'word':
      await exportToWord(data);
      break;
    case 'pdf':
      exportToPdf(data);
      break;
  }
}

/**
 * Helper to trigger browser download for any Blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ScopedExportOptions extends ExportTableData {
  format: 'pdf' | 'excel' | 'word' | 'csv';
  exportScope: 'CURRENT_PAGE' | 'ALL_FILTERED';
  maxRecordsLimit?: number;
  maxSizeBytesLimit?: number;
}

export async function executeScopedExport(
  options: ScopedExportOptions
): Promise<{ success: boolean; exportedCount: number; message: string }> {
  const maxRecords = options.maxRecordsLimit ?? 50000;
  const maxBytes = options.maxSizeBytesLimit ?? 15 * 1024 * 1024;

  if (options.rows.length > maxRecords) {
    return {
      success: false,
      exportedCount: 0,
      message: `Export blocked: ${options.rows.length.toLocaleString()} records exceeds maximum configured export limit of ${maxRecords.toLocaleString()} records.`,
    };
  }

  const estimatedBytes =
    options.headers.join(',').length +
    options.rows.reduce((sum, r) => sum + r.map((c) => String(c ?? '')).join(',').length + 4, 0);

  if (estimatedBytes > maxBytes) {
    return {
      success: false,
      exportedCount: 0,
      message: `Export blocked: estimated payload size (${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds configured maximum limit.`,
    };
  }

  const scopeSuffix =
    options.exportScope === 'CURRENT_PAGE' ? 'Current Page' : 'All Filtered Records';
  const enrichedData: ExportTableData = {
    ...options,
    scopeLabel: options.scopeLabel
      ? `${options.scopeLabel} | Export Scope: ${scopeSuffix} (${options.rows.length} rows)`
      : `Export Scope: ${scopeSuffix} (${options.rows.length} rows)`,
    filenamePrefix: `${options.filenamePrefix}_${options.exportScope === 'CURRENT_PAGE' ? 'page' : 'all'}`,
  };

  await executeExport(options.format, enrichedData);
  return {
    success: true,
    exportedCount: options.rows.length,
    message: `Exported ${options.rows.length} record(s) (${scopeSuffix}) as ${options.format.toUpperCase()}.`,
  };
}

export const exportService = {
  exportToCsv,
  exportToExcel,
  exportToWord,
  exportToPdf,
  executeExport,
  executeScopedExport,
};

