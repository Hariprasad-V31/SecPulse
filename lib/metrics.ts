import { bracketLabelForTier, MAX_POINTS, pointsForTier } from "./scores";
import type {
  AnswerRecord,
  CategoryMetric,
  MaturityMetrics,
  ParsedData,
  StageDistribution,
} from "./types";

function emptyDistribution(): StageDistribution {
  return {
    "not-started": 0,
    partial: 0,
    consistent: 0,
    embedded: 0,
    na: 0,
    unanswered: 0,
  };
}

/**
 * Compute maturity metrics for an assessment.
 *
 *   percent = (points earned) / (3 * scored items) * 100
 *
 * "Not Applicable" and unanswered items are excluded from the denominator.
 */
export function getMaturity(data: ParsedData, assessment: string): MaturityMetrics {
  const distribution = emptyDistribution();
  let earned = 0;
  let scoredCount = 0;

  for (const row of data.rows) {
    const tier = row.scores[assessment] ?? null;
    if (tier === null) {
      distribution.unanswered += 1;
      continue;
    }
    distribution[tier] += 1;

    const points = pointsForTier(tier);
    if (points === null) continue; // N/A — excluded from scoring
    earned += points;
    scoredCount += 1;
  }

  const possible = scoredCount * MAX_POINTS;
  const percent = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  return {
    earned,
    possible,
    percent,
    scoredCount,
    naCount: distribution.na,
    unansweredCount: distribution.unanswered,
    total: data.rows.length,
    distribution,
  };
}

/** Per-category maturity breakdown, preserving discovered category order. */
export function getCategoryBreakdown(
  data: ParsedData,
  assessment: string,
): CategoryMetric[] {
  const buckets = new Map<string, { earned: number; scoredCount: number }>();

  for (const row of data.rows) {
    const tier = row.scores[assessment] ?? null;
    const points = pointsForTier(tier);
    if (points === null) continue; // skip N/A + unanswered
    const bucket = buckets.get(row.category) ?? { earned: 0, scoredCount: 0 };
    bucket.earned += points;
    bucket.scoredCount += 1;
    buckets.set(row.category, bucket);
  }

  return data.categories.map((category) => {
    const bucket = buckets.get(category) ?? { earned: 0, scoredCount: 0 };
    const possible = bucket.scoredCount * MAX_POINTS;
    const percent = possible === 0 ? 0 : Math.round((bucket.earned / possible) * 100);
    return {
      category,
      earned: bucket.earned,
      possible,
      scoredCount: bucket.scoredCount,
      percent,
    };
  });
}

/** Flatten an assessment's answers into the payload shape used downstream. */
export function getAnswerRecords(
  data: ParsedData,
  assessment: string,
): AnswerRecord[] {
  return data.rows.map((row) => {
    const tier = row.scores[assessment] ?? null;
    return {
      category: row.category,
      maturityStage: row.maturityStage,
      question: row.question,
      selected_score: bracketLabelForTier(tier),
      tier,
      comment: row.comments[assessment] ?? "",
      description: row.description,
      evidence: row.evidence,
    };
  });
}
