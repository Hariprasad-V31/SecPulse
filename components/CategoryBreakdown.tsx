"use client";

import { Card, CardContent } from "@/components/ui/card";
import { getCategoryStyle } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CategoryMetric } from "@/lib/types";

interface CategoryBreakdownProps {
  metrics: CategoryMetric[];
}

function barTone(percent: number): string {
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 60) return "bg-lime-500";
  if (percent >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

export function CategoryBreakdown({ metrics }: CategoryBreakdownProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {metrics.map((metric) => {
        const style = getCategoryStyle(metric.category);
        const Icon = style.icon;
        return (
          <Card
            key={metric.category}
            className="transition-all duration-300 hover:border-slate-300 hover:bg-slate-50"
          >
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                    style.tint,
                  )}
                >
                  <Icon className={cn("h-4.5 w-4.5", style.color)} />
                </span>
                <span className="text-lg font-bold tabular-nums text-slate-900">
                  {metric.percent}%
                </span>
              </div>

              <div className="space-y-2">
                <p
                  className="line-clamp-2 min-h-[2.5rem] text-xs font-medium leading-snug text-slate-700"
                  title={metric.category}
                >
                  {metric.category}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      barTone(metric.percent),
                    )}
                    style={{ width: `${metric.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {metric.earned} of {metric.possible} pts
                  {metric.scoredCount === 0 ? " · no scored items" : ""}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
