/**
 * Shared domain types for SecPulse.
 */

import type { ScoreTier } from "./scores";

/** A single assessment item (question) with metadata and per-assessment input. */
export interface QuestionRow {
  /** Stable identifier (source row index). */
  id: number;
  /** AppSec category this item belongs to. */
  category: string;
  /** AppSec maturity stage the item sits in. */
  maturityStage: string;
  /** The assessment item / question text. */
  question: string;
  /** "What this question actually means". */
  description: string;
  /** Examples / evidence teams can reference. */
  evidence: string;
  /** Parsed maturity tier keyed by assessment name (null when unanswered). */
  scores: Record<string, ScoreTier | null>;
  /** Free-text justification keyed by assessment name. */
  comments: Record<string, string>;
}

/** Result of parsing an uploaded spreadsheet. */
export interface ParsedData {
  /** Assessment target names (drives the dropdown). Usually one project. */
  assessments: string[];
  /** Ordered list of unique categories discovered in the data. */
  categories: string[];
  /** Ordered list of unique maturity stages discovered in the data. */
  maturityStages: string[];
  /** All parsed assessment rows. */
  rows: QuestionRow[];
  /** Original file name. */
  fileName: string;
  /** Worksheet that was parsed (for xlsx inputs). */
  sheetName?: string;
}

/** Count of items sitting in each maturity tier (+ N/A and unanswered). */
export interface StageDistribution {
  "not-started": number;
  partial: number;
  consistent: number;
  embedded: number;
  na: number;
  unanswered: number;
}

/** High-level maturity metrics for a single assessment. */
export interface MaturityMetrics {
  /** Sum of points earned across scored (non-N/A) items. */
  earned: number;
  /** Maximum achievable points across scored items. */
  possible: number;
  /** Percentage (0-100) of points earned vs possible. */
  percent: number;
  /** Number of items contributing to the score (excludes N/A + unanswered). */
  scoredCount: number;
  /** Number of items marked Not Applicable. */
  naCount: number;
  /** Number of items left blank. */
  unansweredCount: number;
  /** Total number of items. */
  total: number;
  /** Per-tier counts. */
  distribution: StageDistribution;
}

/** Per-category maturity breakdown for a single assessment. */
export interface CategoryMetric {
  category: string;
  earned: number;
  possible: number;
  scoredCount: number;
  percent: number;
}

/** Severity levels surfaced by the anomaly engine. */
export type Severity = "Low" | "Medium" | "High";

/** The two anomaly archetypes surfaced by the engine. */
export type AnomalyType = "Comment Contradiction" | "Dependency Disconnect";

/** A detected justification / dependency anomaly. */
export interface Anomaly {
  type: AnomalyType;
  /** The exact assessment item the anomaly relates to. */
  item: string;
  severity: Severity;
  explanation: string;
}

/** Origin of the anomaly analysis. */
export type AnomalySource = "github-llm" | "fallback";

/** Response returned from the anomaly analysis API route. */
export interface AnomalyResponse {
  anomalies: Anomaly[];
  source: AnomalySource;
  model?: string;
  /** Present when the LLM path failed and we degraded to the local engine. */
  notice?: string;
}

/** Flattened record sent to the analysis API / local engine. */
export interface AnswerRecord {
  category: string;
  maturityStage: string;
  question: string;
  /** Full selected score label, e.g. "Embedded & Measured [3]" (or ""). */
  selected_score: string;
  /** Parsed tier (used by the local rule engine). */
  tier: ScoreTier | null;
  comment: string;
}

/** Request payload for the anomaly analysis API route. */
export interface AnomalyRequest {
  target: string;
  answers: AnswerRecord[];
}
