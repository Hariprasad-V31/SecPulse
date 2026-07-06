/**
 * Excel export for a single assessment.
 *
 * Produces a three-sheet workbook:
 *   1. The exact original questionnaire sheet (re-read from the upload).
 *   2. A scored matrix for the selected assessment target.
 *   3. The validation / justification anomalies.
 *
 * The workbook is named "<Project Name> - Security Governance Effectiveness
 * Questionnaire_v2.0.xlsx" so exports are easy to identify per project.
 */

import * as XLSX from "xlsx";
import { getMaturity } from "./metrics";
import { bracketLabelForTier, pointsForTier } from "./scores";
import type { Anomaly, ParsedData } from "./types";

/** Matches the versioned questionnaire worksheet (same rule as the parser). */
const QUESTIONNAIRE_SHEET = /application\s*security\s*v\s*\d/i;

/** Constant tail of the exported workbook file name. */
const WORKBOOK_SUFFIX = "Security Governance Effectiveness Questionnaire_v2.0";

/** Strip characters Excel forbids in sheet names and clamp to 31 chars. */
function toSheetName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || fallback).slice(0, 31);
}

/** Strip characters the OS forbids in file names. */
function toFileName(raw: string): string {
  return raw.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

/** Re-read the upload and return its exact questionnaire worksheet. */
async function readOriginalSheet(
  rawFile: File,
): Promise<{ ws: XLSX.WorkSheet; name: string } | null> {
  try {
    const buffer = await rawFile.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    if (wb.SheetNames.length === 0) return null;
    const name =
      wb.SheetNames.find((n) => QUESTIONNAIRE_SHEET.test(n)) ??
      wb.SheetNames[0];
    return { ws: wb.Sheets[name], name };
  } catch {
    return null;
  }
}

/** Build the scored-matrix worksheet for the selected assessment. */
function buildScoredSheet(data: ParsedData, target: string): XLSX.WorkSheet {
  const maturity = getMaturity(data, target);
  const aoa: (string | number)[][] = [
    [`Assessment target: ${target}`],
    [
      `Overall maturity: ${maturity.percent}% (${maturity.earned}/${maturity.possible} pts across ${maturity.scoredCount} scored items)`,
    ],
    [`Generated: ${new Date().toISOString().slice(0, 10)}`],
    [],
    [
      "Category",
      "Maturity Stage",
      "Assessment Item",
      "Assessed Score",
      "Points",
      "Comment",
      "Description",
      "Examples / Evidence",
    ],
  ];

  for (const row of data.rows) {
    const tier = row.scores[target] ?? null;
    const points = pointsForTier(tier);
    aoa.push([
      row.category,
      row.maturityStage,
      row.question,
      bracketLabelForTier(tier),
      points === null ? "" : points,
      row.comments[target] ?? "",
      row.description,
      row.evidence,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 22 },
    { wch: 18 },
    { wch: 50 },
    { wch: 24 },
    { wch: 8 },
    { wch: 40 },
    { wch: 50 },
    { wch: 50 },
  ];
  return ws;
}

/** Build the anomalies worksheet. */
function buildAnomalySheet(
  anomalies: Anomaly[],
  target: string,
): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [
    [`Validation & justification anomalies — ${target}`],
    [`Generated: ${new Date().toISOString().slice(0, 10)}`],
    [],
    ["#", "Type", "Severity", "Assessment Item", "Explanation"],
  ];

  if (anomalies.length === 0) {
    aoa.push(["", "None", "", "No anomalies detected for this assessment.", ""]);
  } else {
    anomalies.forEach((a, i) => {
      aoa.push([i + 1, a.type, a.severity, a.item, a.explanation]);
    });
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 5 },
    { wch: 22 },
    { wch: 10 },
    { wch: 50 },
    { wch: 70 },
  ];
  return ws;
}

/**
 * Build and download the three-sheet assessment workbook.
 */
export async function exportAssessmentWorkbook(opts: {
  rawFile: File | null;
  data: ParsedData;
  target: string;
  projectName: string;
  anomalies: Anomaly[];
}): Promise<void> {
  const { rawFile, data, target, projectName, anomalies } = opts;

  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const append = (ws: XLSX.WorkSheet, desired: string, fallback: string) => {
    let name = toSheetName(desired, fallback);
    let i = 2;
    while (used.has(name.toLowerCase())) {
      const suffix = ` ${i++}`;
      name = `${name.slice(0, 31 - suffix.length)}${suffix}`;
    }
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // Sheet 1 — the exact original questionnaire sheet (re-read from the upload).
  const original = rawFile ? await readOriginalSheet(rawFile) : null;
  if (original) {
    append(original.ws, original.name, "Questionnaire");
  } else {
    // No source workbook (e.g. CSV upload) — reconstruct from parsed data.
    append(buildScoredSheet(data, target), "Questionnaire", "Questionnaire");
  }

  // Sheet 2 — scored matrix for the selected assessment.
  append(buildScoredSheet(data, target), "Scored Matrix", "Scored Matrix");

  // Sheet 3 — validation / justification anomalies.
  append(buildAnomalySheet(anomalies, target), "Anomalies", "Anomalies");

  const prefix =
    toFileName(projectName) || toFileName(target) || "Assessment";
  XLSX.writeFile(wb, `${prefix} - ${WORKBOOK_SUFFIX}.xlsx`);
}
