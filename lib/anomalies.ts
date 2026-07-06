import type { Anomaly, AnomalyType, AnswerRecord, Severity } from "./types";

/**
 * Phrases in a justification comment that indicate the work is not actually
 * done — used to contradict high maturity scores ([2]/[3]).
 */
const PENDING_INDICATORS =
  /\b(planned|next year|next quarter|in\s+(the\s+)?roadmap|on\s+the\s+roadmap|not\s+yet\s+configured|not\s+yet\s+(implemented|started|done|set\s*up)|will\s+(start|begin|implement|configure)|evaluating|in\s+progress|to\s+be\s+(done|implemented|configured|determined)|tbd|pending|under\s+review|proof\s+of\s+concept|poc\b|piloting|trialing)\b/i;

/** Foundational capabilities that should exist before advanced ones. */
const FOUNDATIONAL =
  /(secure coding (practices |standards )?(are )?(formally )?defined|security architecture patterns?(\s+are)?\s+defined|threat model(ing)?\s+(is\s+)?(defined|established)|coding (standards|guidelines)\s+defined)/i;

/** Advanced capabilities that depend on the foundational ones. */
const ADVANCED =
  /(scanner-invisible|business[- ]logic vulnerab|iac (deployment )?(gates|gating)|deployment gates|advanced (security )?metrics|cloud .*(deployment )?(gate|gating)|embedded (security )?metrics)/i;

const isHighScore = (r: AnswerRecord) =>
  r.tier === "consistent" || r.tier === "embedded";

/**
 * Deterministic, rule-based anomaly detector. Mirrors the LLM auditor's two
 * archetypes so the dashboard always has output even without an API key.
 */
export function detectAnomaliesLocal(records: AnswerRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const seen = new Set<string>();

  const push = (
    type: AnomalyType,
    item: string,
    severity: Severity,
    explanation: string,
  ) => {
    const key = `${type}::${item}`;
    if (seen.has(key)) return;
    seen.add(key);
    anomalies.push({ type, item, severity, explanation });
  };

  // --- Archetype 1: Comment vs Score contradictions.
  for (const r of records) {
    if (!r.comment) continue;
    if (isHighScore(r) && PENDING_INDICATORS.test(r.comment)) {
      push(
        "Comment Contradiction",
        r.question,
        "High",
        `Scored "${r.selected_score}", yet the comment signals the work is still pending or in progress: "${truncate(r.comment)}". The justification undermines the maturity tier selected.`,
      );
    }
  }

  // --- Archetype 2: Dependency disconnects.
  const foundationalGaps = records.filter(
    (r) => r.tier === "not-started" && FOUNDATIONAL.test(r.question),
  );
  const advancedEmbedded = records.filter(
    (r) => r.tier === "embedded" && ADVANCED.test(r.question),
  );

  if (foundationalGaps.length > 0) {
    for (const adv of advancedEmbedded) {
      const foundation = foundationalGaps[0];
      push(
        "Dependency Disconnect",
        adv.question,
        "High",
        `"${adv.question}" is marked "${adv.selected_score}", but the foundational control "${foundation.question}" is still "Not Started [0]". Advanced capabilities are highly improbable without the foundational element in place.`,
      );
    }
  }

  return sortAnomalies(anomalies);
}

/** Truncate long comments for inline display. */
function truncate(text: string, max = 140): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Severity ordering for sorting (High first). */
const SEVERITY_RANK: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 };

/** Sort anomalies by descending severity, then by type. */
export function sortAnomalies(anomalies: Anomaly[]): Anomaly[] {
  return [...anomalies].sort((a, b) => {
    const bySeverity = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.type.localeCompare(b.type);
  });
}

/** Normalize a severity-ish string into a valid Severity. */
function coerceSeverity(value: unknown): Severity {
  const s = String(value ?? "").toLowerCase();
  if (s.startsWith("h")) return "High";
  if (s.startsWith("l")) return "Low";
  return "Medium";
}

/** Normalize an anomaly-type-ish string into a valid AnomalyType. */
function coerceType(value: unknown): AnomalyType {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("depend")) return "Dependency Disconnect";
  return "Comment Contradiction";
}

/**
 * Validate / normalize loosely-typed anomaly objects (e.g. parsed from an LLM
 * response) into well-formed Anomaly records. Invalid entries are dropped.
 */
export function coerceAnomalies(raw: unknown): Anomaly[] {
  if (!Array.isArray(raw)) return [];
  const result: Anomaly[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const rec = entry as Record<string, unknown>;
    const item = String(rec.item ?? rec.question ?? "").trim();
    const explanation = String(rec.explanation ?? "").trim();
    if (!item || !explanation) continue;
    result.push({
      type: coerceType(rec.type),
      item,
      explanation,
      severity: coerceSeverity(rec.severity),
    });
  }
  return result;
}
