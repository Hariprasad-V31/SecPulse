"use client";

import { BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SCORING_TIERS } from "@/lib/scores";
import { TIER_STYLES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { StageDistribution as Distribution } from "@/lib/types";

interface StageDistributionProps {
  distribution: Distribution;
}

export function StageDistribution({ distribution }: StageDistributionProps) {
  // Denominator for bar widths: all answered items (incl. N/A) so bars are
  // proportional to the full answered set.
  const answered =
    SCORING_TIERS.reduce((sum, t) => sum + distribution[t], 0) + distribution.na;
  const max = Math.max(
    1,
    ...SCORING_TIERS.map((t) => distribution[t]),
    distribution.na,
  );

  const rows = [
    ...SCORING_TIERS.map((tier) => ({
      tier,
      count: distribution[tier],
      style: TIER_STYLES[tier],
    })),
    { tier: "na" as const, count: distribution.na, style: TIER_STYLES.na },
  ];

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
              <BarChart3 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Stage Distribution
              </h3>
              <p className="text-xs text-slate-500">
                {answered} item{answered === 1 ? "" : "s"} assessed
              </p>
            </div>
          </div>
          {distribution.unanswered > 0 && (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              {distribution.unanswered} unanswered
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center gap-3">
          {rows.map(({ tier, count, style }) => {
            const widthPct = max === 0 ? 0 : Math.round((count / max) * 100);
            return (
              <div key={tier} className="flex items-center gap-3">
                <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
                  <span className={cn("h-2 w-2 rounded-full", style.solid)} />
                  {style.shortLabel}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      style.solid,
                    )}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}