/**
 * Multi-tier maturity scoring model for the AppSec Effectiveness Questionnaire.
 *
 * The questionnaire replaces simple booleans with a 4-tier maturity matrix plus
 * an optional "Not Applicable" state that is excluded from score denominators.
 */

export type ScoreTier =
  | "not-started"
  | "partial"
  | "consistent"
  | "embedded"
  | "na";

interface TierInfo {
  tier: ScoreTier;
  /** Short canonical label. */
  label: string;
  /** Full label including the bracketed weight, as shown in the sheet. */
  bracketLabel: string;
  /** Numerical weight, or null for "Not Applicable" (excluded from scoring). */
  points: number | null;
}

export const TIER_INFO: Record<ScoreTier, TierInfo> = {
  "not-started": {
    tier: "not-started",
    label: "Not Started",
    bracketLabel: "Not Started [0]",
    points: 0,
  },
  partial: {
    tier: "partial",
    label: "Partially Implemented",
    bracketLabel: "Partially Implemented [1]",
    points: 1,
  },
  consistent: {
    tier: "consistent",
    label: "Consistently Implemented",
    bracketLabel: "Consistently Implemented [2]",
    points: 2,
  },
  embedded: {
    tier: "embedded",
    label: "Embedded & Measured",
    bracketLabel: "Embedded & Measured [3]",
    points: 3,
  },
  na: {
    tier: "na",
    label: "Not Applicable",
    bracketLabel: "Not Applicable",
    points: null,
  },
};

/** The maximum achievable points for a single scored item. */
export const MAX_POINTS = 3;

/** Ordered tiers used for stage-distribution displays (excludes N/A). */
export const SCORING_TIERS: ScoreTier[] = [
  "not-started",
  "partial",
  "consistent",
  "embedded",
];

/**
 * Parse a loosely-typed "Assessed Score" cell into a tier.
 * Handles "Not Started [0]", "Embedded & Measured [3]", bare numbers, and
 * "Not Applicable" / "N/A". Returns null when the cell is blank/unparseable.
 */
export function parseScore(value: unknown): ScoreTier | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const s = raw.toLowerCase();

  // Not Applicable must be checked before the numeric path.
  if (/not\s*applicable/.test(s) || /^n\/?a$/.test(s)) return "na";

  // Prefer the explicit bracketed weight, e.g. "... [3]".
  const bracket = s.match(/\[\s*([0-3])\s*\]/);
  if (bracket) return tierFromPoints(Number(bracket[1]));

  // Keyword matching.
  if (/not\s*started/.test(s)) return "not-started";
  if (/partial/.test(s)) return "partial";
  if (/consistent/.test(s)) return "consistent";
  if (/embedded|measured/.test(s)) return "embedded";

  // Bare numeric fallback.
  if (/^[0-3]$/.test(s)) return tierFromPoints(Number(s));

  return null;
}

/** Map a 0-3 weight to its tier. */
export function tierFromPoints(points: number): ScoreTier | null {
  switch (points) {
    case 0:
      return "not-started";
    case 1:
      return "partial";
    case 2:
      return "consistent";
    case 3:
      return "embedded";
    default:
      return null;
  }
}

/** Points for a tier (null tier or N/A yields null). */
export function pointsForTier(tier: ScoreTier | null): number | null {
  if (!tier) return null;
  return TIER_INFO[tier].points;
}

/** Short label for a tier (empty string when null). */
export function labelForTier(tier: ScoreTier | null): string {
  return tier ? TIER_INFO[tier].label : "";
}

/** Full bracketed label for a tier (empty string when null). */
export function bracketLabelForTier(tier: ScoreTier | null): string {
  return tier ? TIER_INFO[tier].bracketLabel : "";
}
