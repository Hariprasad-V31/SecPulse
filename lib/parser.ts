import Papa from "papaparse";
import * as XLSX from "xlsx";
import { parseScore } from "./scores";
import type { ParsedData, QuestionRow } from "./types";

/**
 * The questionnaire lives on the versioned "ApplicationSecurityv1" worksheet.
 * The companion "Summary Dashboard" and unversioned "ApplicationSecurity"
 * sheets are intentionally ignored — only this sheet drives the dashboard.
 */
const QUESTIONNAIRE_SHEET = /application\s*security\s*v\s*\d/i;

/** Column resolver: maps a logical field to a detected column index. */
interface ColumnMap {
  category: number;
  maturityStage: number;
  question: number;
  description: number;
  evidence: number;
  /** One or more assessment targets (score + comment column pairs). */
  assessments: { name: string; scoreCol: number; commentCol: number }[];
}

/** Default column indices per the questionnaire spec (used as a fallback). */
const DEFAULT_COLUMNS = {
  category: 0,
  maturityStage: 1,
  question: 2,
  assessedScore: 3,
  comments: 4,
  description: 5,
  evidence: 6,
};

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const lower = (v: unknown) => norm(v).toLowerCase();

/**
 * Locate the header row by scanning for the signature columns. Some exports
 * include a banner / instructions block above the real header.
 */
function findHeaderRow(matrix: unknown[][]): number {
  for (let r = 0; r < Math.min(matrix.length, 25); r += 1) {
    const cells = (matrix[r] ?? []).map(lower);
    const hasCategory = cells.some((c) => c.includes("category"));
    const hasItem = cells.some(
      (c) => c.includes("assessment item") || c.includes("assessed score"),
    );
    if (hasCategory && hasItem) return r;
  }
  return 0;
}

/** Clean a verbose score-column header into a friendly assessment name. */
function deriveAssessmentName(header: string, index: number): string {
  let name = norm(header)
    .replace(/\([^)]*\)/g, "") // strip parenthetical notes
    .replace(/assessed score/i, "")
    .replace(/[-–:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) name = `Assessment ${index + 1}`;
  else name = `${name} Assessment`.replace(/\s+/g, " ").trim();
  return name;
}

/** Resolve logical columns from the header row, falling back to fixed indices. */
function resolveColumns(header: unknown[]): ColumnMap {
  const cells = header.map(lower);
  const find = (pred: (c: string) => boolean, fallback: number) => {
    const idx = cells.findIndex(pred);
    return idx === -1 ? fallback : idx;
  };

  const category = find((c) => c.includes("category"), DEFAULT_COLUMNS.category);
  const maturityStage = find(
    (c) => c.includes("maturity stage") || c.includes("maturity"),
    DEFAULT_COLUMNS.maturityStage,
  );
  const question = find(
    (c) => c.includes("assessment item") || c.includes("assessment"),
    DEFAULT_COLUMNS.question,
  );
  const description = find(
    (c) => c.includes("description"),
    DEFAULT_COLUMNS.description,
  );
  const evidence = find(
    (c) => c.includes("evidence") || c.includes("example"),
    DEFAULT_COLUMNS.evidence,
  );

  // Detect every "assessed score" column; pair each with a nearby comment col.
  const scoreCols: number[] = [];
  const commentCols: number[] = [];
  cells.forEach((c, i) => {
    if (c.includes("assessed score") || c.includes("project score")) scoreCols.push(i);
    if (c.includes("comment") || c.includes("justification")) commentCols.push(i);
  });

  if (scoreCols.length === 0) scoreCols.push(DEFAULT_COLUMNS.assessedScore);
  if (commentCols.length === 0) commentCols.push(DEFAULT_COLUMNS.comments);

  const assessments = scoreCols.map((scoreCol, i) => {
    // Pick the closest comment column at a greater index, else any, else +1.
    const after = commentCols.filter((cc) => cc > scoreCol).sort((a, b) => a - b);
    const commentCol = after[0] ?? commentCols[i] ?? scoreCol + 1;
    const rawHeader = norm(header[scoreCol]);
    const name =
      scoreCols.length === 1
        ? "Project Assessment"
        : deriveAssessmentName(rawHeader, i);
    return { name, scoreCol, commentCol };
  });

  return { category, maturityStage, question, description, evidence, assessments };
}

/**
 * Turn a 2D matrix into structured ParsedData using the AppSec questionnaire
 * layout: Category, Maturity Stage, Assessment Item, Assessed Score, Comments,
 * Description, Examples/Evidence.
 */
export function processMatrix(
  matrix: unknown[][],
  fileName: string,
  sheetName?: string,
): ParsedData {
  const cleaned = (matrix ?? []).filter(
    (row) => Array.isArray(row) && row.some((cell) => norm(cell) !== ""),
  );

  if (cleaned.length < 2) {
    throw new Error(
      "The file does not contain enough data. Expected a header row and at least one assessment item.",
    );
  }

  const headerIdx = findHeaderRow(cleaned);
  const header = cleaned[headerIdx];
  const cols = resolveColumns(header);

  const assessments = cols.assessments.map((a) => a.name);
  const rows: QuestionRow[] = [];
  const categories: string[] = [];
  const categorySet = new Set<string>();
  const maturityStages: string[] = [];
  const stageSet = new Set<string>();

  let lastCategory = "General";
  let lastStage = "";

  for (let r = headerIdx + 1; r < cleaned.length; r += 1) {
    const raw = cleaned[r];

    // Forward-fill category & maturity stage (merged cells leave blanks).
    const cat = norm(raw[cols.category]);
    if (cat) lastCategory = cat;
    const stage = norm(raw[cols.maturityStage]);
    if (stage) lastStage = stage;

    const question = norm(raw[cols.question]);
    if (!question) continue; // skip rows without an assessment item

    if (!categorySet.has(lastCategory)) {
      categorySet.add(lastCategory);
      categories.push(lastCategory);
    }
    if (lastStage && !stageSet.has(lastStage)) {
      stageSet.add(lastStage);
      maturityStages.push(lastStage);
    }

    const scores: Record<string, ReturnType<typeof parseScore>> = {};
    const comments: Record<string, string> = {};
    cols.assessments.forEach((a) => {
      scores[a.name] = parseScore(raw[a.scoreCol]);
      comments[a.name] = norm(raw[a.commentCol]);
    });

    rows.push({
      id: r,
      category: lastCategory,
      maturityStage: lastStage,
      question,
      description: norm(raw[cols.description]),
      evidence: norm(raw[cols.evidence]),
      scores,
      comments,
    });
  }

  if (rows.length === 0) {
    throw new Error("No assessment items were found in the file.");
  }

  return {
    assessments,
    categories,
    maturityStages,
    rows,
    fileName,
    sheetName,
  };
}

/** Read a CSV file into a 2D matrix. */
function readCsv(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: "greedy",
      complete: (results) => resolve(results.data as unknown[][]),
      error: (err) => reject(err),
    });
  });
}

/** Read an XLSX/XLS file into a 2D matrix from the AppSec questionnaire sheet. */
async function readExcel(
  file: File,
): Promise<{ matrix: unknown[][]; sheetName: string }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  if (workbook.SheetNames.length === 0) {
    throw new Error("The workbook does not contain any sheets.");
  }
  // Only the versioned "ApplicationSecurityv1" sheet is used. Fall back to the
  // first sheet solely for single-sheet uploads (e.g. a CSV-derived export).
  const sheetName =
    workbook.SheetNames.find((n) => QUESTIONNAIRE_SHEET.test(n)) ??
    workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  return { matrix, sheetName };
}

/**
 * Parse an uploaded `.csv`, `.xlsx`, or `.xls` file into structured data.
 */
export async function parseFile(file: File): Promise<ParsedData> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith(".csv") || file.type === "text/csv";

  if (isCsv) {
    const matrix = await readCsv(file);
    return processMatrix(matrix, file.name);
  }

  const { matrix, sheetName } = await readExcel(file);
  return processMatrix(matrix, file.name, sheetName);
}
