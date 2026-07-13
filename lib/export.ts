/**
 * Excel export using ExcelJS for rich formatting.
 *
 * Produces a multi-sheet workbook:
 *   1. Dashboard — styled cards with overall maturity, category breakdown, anomalies.
 *   2. Scored Matrix — per-question scores with AI Remediation column.
 *   3. Original — the raw uploaded questionnaire (if xlsx).
 *   4. Anomalies — detailed anomaly table.
 */

import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { getCategoryBreakdown, getMaturity } from "./metrics";
import { bracketLabelForTier, pointsForTier } from "./scores";
import type { Anomaly, ParsedData } from "./types";

/** Matches the versioned questionnaire worksheet. */
const QUESTIONNAIRE_SHEET = /application\s*security\s*v\s*\d/i;

/** Constant tail of the exported workbook file name. */
const WORKBOOK_SUFFIX = "Security Governance Effectiveness Questionnaire_v2.0";

/** Strip characters the OS forbids in file names. */
function toFileName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

// --- Colors ---
const INDIGO = "4F46E5";
const WHITE = "FFFFFF";
const SLATE50 = "F8FAFC";
const SLATE100 = "F1F5F9";
const SLATE200 = "E2E8F0";
const SLATE500 = "64748B";
const SLATE700 = "334155";
const SLATE900 = "0F172A";
const EMERALD = "059669";
const AMBER = "D97706";
const ROSE = "E11D48";
const VIOLET = "7C3AED";

// --- Dashboard Sheet ---
function addDashboardSheet(
  wb: ExcelJS.Workbook,
  data: ParsedData,
  target: string,
) {
  const ws = wb.addWorksheet("Dashboard", {
    properties: { tabColor: { argb: INDIGO } },
  });

  const maturity = getMaturity(data, target);
  const categories = getCategoryBreakdown(data, target);

  ws.columns = [
    { width: 3 },
    { width: 28 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 50 },
    { width: 3 },
  ];

  let row = 2;

  // Title
  ws.mergeCells(`B${row}:H${row}`);
  const titleCell = ws.getCell(`B${row}`);
  titleCell.value = "SecPulse — Dashboard";
  titleCell.font = { bold: true, size: 20, color: { argb: INDIGO } };
  row++;

  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = `Assessment: ${target} · ${new Date().toISOString().slice(0, 10)}`;
  ws.getCell(`B${row}`).font = { size: 10, italic: true, color: { argb: SLATE500 } };
  row += 2;

  // ═══════════ Overall Maturity Card ═══════════
  const cardTop = row;
  const cardBot = row + 3;
  for (let r = cardTop; r <= cardBot; r++) {
    for (let c = 2; c <= 4; c++) {
      const cell = ws.getCell(r, c);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
      cell.font = { color: { argb: WHITE } };
    }
  }

  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = "OVERALL MATURITY";
  ws.getCell(`B${row}`).font = { bold: true, size: 10, color: { argb: WHITE } };
  ws.getCell(`B${row}`).alignment = { horizontal: "center" };
  row++;

  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = `${maturity.percent}%`;
  ws.getCell(`B${row}`).font = { bold: true, size: 36, color: { argb: WHITE } };
  ws.getCell(`B${row}`).alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(row).height = 45;
  row++;

  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = `${maturity.earned} / ${maturity.possible} pts`;
  ws.getCell(`B${row}`).font = { size: 11, color: { argb: WHITE } };
  ws.getCell(`B${row}`).alignment = { horizontal: "center" };
  row++;

  ws.mergeCells(`B${row}:D${row}`);
  ws.getCell(`B${row}`).value = `${maturity.scoredCount} items scored`;
  ws.getCell(`B${row}`).font = { size: 9, color: { argb: WHITE } };
  ws.getCell(`B${row}`).alignment = { horizontal: "center" };
  row += 2;

  // ═══════════ Summary Cards (3 per row) ═══════════
  // Points Earned | Points Possible | Scored Items
  const miniCards = [
    { label: "Points Earned", value: maturity.earned, color: EMERALD },
    { label: "Points Possible", value: maturity.possible, color: VIOLET },
    { label: "Scored Items", value: maturity.scoredCount, color: AMBER },
  ];

  const cardCols = [[2, 3], [4, 5], [6, 7]]; // column pairs
  for (let ci = 0; ci < miniCards.length; ci++) {
    const card = miniCards[ci];
    const [c1, c2] = cardCols[ci];

    // Label row
    ws.mergeCells(row, c1, row, c2);
    const labelCell = ws.getCell(row, c1);
    labelCell.value = card.label;
    labelCell.font = { size: 9, color: { argb: SLATE500 } };
    labelCell.alignment = { horizontal: "center" };
    labelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE50 } };
    labelCell.border = {
      top: { style: "medium", color: { argb: card.color } },
      left: { style: "thin", color: { argb: SLATE200 } },
      right: { style: "thin", color: { argb: SLATE200 } },
    };

    // Value row
    ws.mergeCells(row + 1, c1, row + 1, c2);
    const valCell = ws.getCell(row + 1, c1);
    valCell.value = card.value;
    valCell.font = { bold: true, size: 18, color: { argb: card.color } };
    valCell.alignment = { horizontal: "center" };
    valCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE50 } };
    valCell.border = {
      bottom: { style: "thin", color: { argb: SLATE200 } },
      left: { style: "thin", color: { argb: SLATE200 } },
      right: { style: "thin", color: { argb: SLATE200 } },
    };
  }
  row += 3;

  // ═══════════ Category Breakdown ═══════════
  row++;
  ws.mergeCells(`B${row}:H${row}`);
  ws.getCell(`B${row}`).value = "Category Breakdown";
  ws.getCell(`B${row}`).font = { bold: true, size: 14, color: { argb: SLATE900 } };
  row += 2;

  // Table header
  const catHeaders = ["Category", "Score (%)", "Earned", "Possible", "Items"];
  const catColStart = 2;
  catHeaders.forEach((h, i) => {
    const cell = ws.getCell(row, catColStart + i);
    cell.value = h;
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE700 } };
    cell.alignment = { horizontal: i === 0 ? "left" : "center" };
  });
  row++;

  // Category rows
  for (const cat of categories) {
    const scoreColor = cat.percent >= 75 ? EMERALD : cat.percent >= 50 ? AMBER : ROSE;
    const isEven = (row % 2 === 0);
    const bgColor = isEven ? SLATE50 : WHITE;

    const vals: (string | number)[] = [cat.category, cat.percent, cat.earned, cat.possible, cat.scoredCount];
    vals.forEach((v, i) => {
      const cell = ws.getCell(row, catColStart + i);
      cell.value = v;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
      cell.border = { bottom: { style: "thin", color: { argb: SLATE200 } } };
      cell.alignment = { horizontal: i === 0 ? "left" : "center" };
      if (i === 1) {
        cell.font = { bold: true, color: { argb: scoreColor } };
      }
    });
    row++;
  }
}

// --- Evaluated Matrix Sheet ---
function addScoredMatrixSheet(
  wb: ExcelJS.Workbook,
  data: ParsedData,
  target: string,
  remedies?: string[],
) {
  const ws = wb.addWorksheet("Evaluated Matrix", {
    properties: { tabColor: { argb: EMERALD } },
  });

  const maturity = getMaturity(data, target);

  ws.columns = [
    { width: 22, header: "" },
    { width: 18 },
    { width: 50 },
    { width: 24 },
    { width: 8 },
    { width: 40 },
    { width: 55 },
  ];

  // Summary rows
  ws.addRow([`Assessment target: ${target}`]);
  ws.addRow([`Overall maturity: ${maturity.percent}% (${maturity.earned}/${maturity.possible} pts across ${maturity.scoredCount} scored items)`]);
  ws.addRow([`Generated: ${new Date().toISOString().slice(0, 10)}`]);
  ws.addRow([]);

  // Header
  const headerRow = ws.addRow([
    "Category", "Maturity Stage", "Assessment Item", "Assessed Score",
    "Points", "Comment/Remarks", "AI Remediation (Critique)",
  ]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INDIGO } };
  });

  // Data rows
  for (let i = 0; i < data.rows.length; i++) {
    const r = data.rows[i];
    const tier = r.scores[target] ?? null;
    const points = pointsForTier(tier);
    const dataRow = ws.addRow([
      r.category,
      r.maturityStage,
      r.question,
      bracketLabelForTier(tier),
      points === null ? "" : points,
      r.comments[target] ?? "",
      remedies?.[i] ?? "",
    ]);
    // Alternate row coloring
    if (i % 2 === 0) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SLATE50 } };
      });
    }
  }
}

// --- Original Sheet (using SheetJS to re-read the raw file) ---
async function addOriginalSheet(wb: ExcelJS.Workbook, rawFile: File): Promise<void> {
  try {
    const buffer = await rawFile.arrayBuffer();
    const xlsxWb = XLSX.read(buffer, { type: "array" });
    if (xlsxWb.SheetNames.length === 0) return;
    const name =
      xlsxWb.SheetNames.find((n) => QUESTIONNAIRE_SHEET.test(n)) ??
      xlsxWb.SheetNames[0];
    const sheet = xlsxWb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1 });

    const ws = wb.addWorksheet("Original");
    for (const rowData of aoa) {
      ws.addRow(rowData);
    }
  } catch {
    // Skip original sheet on error
  }
}

// --- Anomalies Sheet ---
function addAnomalySheet(wb: ExcelJS.Workbook, anomalies: Anomaly[], target: string) {
  const ws = wb.addWorksheet("Anomalies", {
    properties: { tabColor: { argb: ROSE } },
  });

  ws.columns = [
    { width: 5 },
    { width: 25 },
    { width: 12 },
    { width: 50 },
    { width: 70 },
  ];

  ws.addRow([`Validation & justification anomalies — ${target}`]);
  ws.addRow([`Generated: ${new Date().toISOString().slice(0, 10)}`]);
  ws.addRow([]);

  const headerRow = ws.addRow(["#", "Type", "Severity", "Assessment Item", "Explanation"]);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROSE } };
  });

  if (anomalies.length === 0) {
    ws.addRow(["", "None", "", "No anomalies detected.", ""]);
  } else {
    anomalies.forEach((a, i) => {
      ws.addRow([i + 1, a.type, a.severity, a.item, a.explanation]);
    });
  }
}

// --- Main Export ---
export async function exportAssessmentWorkbook(opts: {
  rawFile: File | null;
  data: ParsedData;
  target: string;
  projectName: string;
  anomalies: Anomaly[];
  remedies?: string[];
}): Promise<void> {
  const { rawFile, data, target, projectName, anomalies, remedies } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = "SecPulse";
  wb.created = new Date();

  // Sheet 1 — Original questionnaire
  if (rawFile) {
    await addOriginalSheet(wb, rawFile);
  }

  // Sheet 2 — Evaluated Matrix with remediation
  addScoredMatrixSheet(wb, data, target, remedies);

  // Sheet 3 — Anomalies
  addAnomalySheet(wb, anomalies, target);

  // Sheet 4 — Dashboard with styled cards (no anomalies)
  addDashboardSheet(wb, data, target);

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const prefix = toFileName(projectName) || toFileName(target) || "Assessment";
  const filename = `${prefix} - ${WORKBOOK_SUFFIX}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
