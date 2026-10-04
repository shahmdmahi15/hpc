import ExcelJS from "exceljs";
import { CLINIC_CONFIG } from "@/lib/clinic-config";

export interface DateFilterRange {
  startDate?: Date;
  endDate?: Date;
  dateLabel: string;
}

// Brand color palette for Excel styling
const COLORS = {
  headerBg: "065F46", // Deep Emerald
  headerText: "FFFFFF",
  titleBg: "0F172A", // Dark Slate
  zebraBg: "F8FAFC", // Light Gray
  totalBg: "E2E8F0", // Slate Total
  border: "CBD5E1", // Light Slate Border
  accentGreen: "047857",
  accentBlue: "1D4ED8",
  accentRed: "B91C1C",
  accentAmber: "B45309",
};

/**
 * Applies a formal letterhead banner at the top of the worksheet
 */
export function applyTitleBanner(
  ws: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
  dateLabel: string,
  columnSpan: number
): number {
  // Row 1: Clinic Name
  ws.mergeCells(1, 1, 1, columnSpan);
  const r1 = ws.getRow(1);
  r1.values = [CLINIC_CONFIG.name];
  r1.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFF" } };
  r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.titleBg } };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  r1.height = 26;

  // Row 2: Tagline & Hotline
  ws.mergeCells(2, 1, 2, columnSpan);
  const r2 = ws.getRow(2);
  r2.values = [`${CLINIC_CONFIG.tagline} • Hotline: ${CLINIC_CONFIG.phone} • ${CLINIC_CONFIG.city}, Bangladesh`];
  r2.font = { name: "Calibri", size: 10, italic: true, color: { argb: "E2E8F0" } };
  r2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.titleBg } };
  r2.alignment = { horizontal: "center", vertical: "middle" };
  r2.height = 18;

  // Row 3: Report Title & Period
  ws.mergeCells(3, 1, 3, columnSpan);
  const r3 = ws.getRow(3);
  r3.values = [`${title.toUpperCase()} | Reporting Period: ${dateLabel} | Generated: ${new Date().toLocaleString()}`];
  r3.font = { name: "Calibri", size: 11, bold: true, color: { argb: "1E293B" } };
  r3.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E2E8F0" } };
  r3.alignment = { horizontal: "center", vertical: "middle" };
  r3.height = 22;

  // Empty separator row
  ws.getRow(4).height = 10;

  return 5; // Next available row
}

/**
 * Applies header styling with brand emerald background and auto-filter
 */
export function applyHeaderStyle(ws: ExcelJS.Worksheet, rowNumber: number): void {
  const row = ws.getRow(rowNumber);
  row.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.headerText } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 28;

  row.eachCell((cell) => {
    cell.border = {
      top: { style: "medium", color: { argb: "047857" } },
      bottom: { style: "medium", color: { argb: "047857" } },
      left: { style: "thin", color: { argb: "065F46" } },
      right: { style: "thin", color: { argb: "065F46" } },
    };
  });
}

/**
 * Applies clean zebra striping and thin cell borders to data rows
 */
export function applyDataRowStyles(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  alignments?: Record<number, "left" | "center" | "right">,
  numFormats?: Record<number, string>
): void {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    const isEven = (r - startRow) % 2 === 1;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10, color: { argb: "0F172A" } };
      cell.border = {
        top: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };

      if (isEven) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.zebraBg } };
      }

      if (alignments && alignments[colNumber]) {
        cell.alignment = { horizontal: alignments[colNumber], vertical: "middle" };
      } else {
        cell.alignment = { vertical: "middle" };
      }

      if (numFormats && numFormats[colNumber]) {
        cell.numFmt = numFormats[colNumber];
      }
    });
  }
}

/**
 * Calculates and sets dynamic column widths based on content length
 */
export function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 14, maxWidth = 48): void {
  ws.columns.forEach((column) => {
    let maxLen = minWidth;
    if (column.values) {
      column.values.forEach((val) => {
        if (val) {
          const str = typeof val === "object" && "richText" in val ? "" : String(val);
          maxLen = Math.max(maxLen, str.length);
        }
      });
    }
    column.width = Math.min(maxLen + 3, maxWidth);
  });
}

/**
 * Adds an Excel formula summary row (e.g. SUM of totals)
 */
export function addSummaryRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  startRow: number,
  endRow: number,
  sumColumns: number[],
  numFormat = '"৳" #,##0.00'
): void {
  const row = ws.getRow(rowNumber);
  row.height = 24;
  row.getCell(1).value = title;
  row.font = { name: "Calibri", size: 11, bold: true, color: { argb: "0F172A" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalBg } };

  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "475569" } },
      bottom: { style: "double", color: { argb: "0F172A" } },
    };
  });

  sumColumns.forEach((col) => {
    const colLetter = ws.getColumn(col).letter;
    const cell = row.getCell(col);
    if (endRow >= startRow) {
      cell.value = { formula: `SUM(${colLetter}${startRow}:${colLetter}${endRow})` };
    } else {
      cell.value = 0;
    }
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "0F172A" } };
    cell.numFmt = numFormat;
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });
}
