"use client";

import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { scoreAccent } from "@/lib/constants";
import type { MaturityMetrics } from "@/lib/types";

interface MaturityScoreProps {
  target: string;
  metrics: MaturityMetrics;
}

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function MaturityScore({ target, metrics }: MaturityScoreProps) {
  const accent = scoreAccent(metrics.percent);
  const offset = CIRCUMFERENCE * (1 - metrics.percent / 100);

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        <div className="flex w-full items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Maturity Score
            </p>
            <p className="mt-0.5 max-w-[160px] truncate text-sm font-semibold text-slate-900">
              {target}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium ${accent.text}`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            {accent.label}
          </span>
        </div>

        <div className="relative grid h-40 w-40 place-items-center">
          <svg
            className="h-40 w-40 -rotate-90"
            viewBox="0 0 128 128"
            aria-hidden="true"
          >
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              strokeWidth="11"
              className="stroke-slate-200"
            />
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              className={`${accent.ring} transition-[stroke-dashoffset] duration-1000 ease-out`}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`text-4xl font-bold tabular-nums ${accent.text}`}>
              {metrics.percent}
              <span className="text-xl">%</span>
            </span>
            <span className="mt-0.5 text-xs text-slate-500">
              {metrics.earned}/{metrics.possible} pts
            </span>
          </div>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 text-center">
          <Stat label="Scored" value={metrics.scoredCount} tone="text-indigo-600" />
          <Stat label="N/A" value={metrics.naCount} tone="text-slate-500" />
          <Stat
            label="Unanswered"
            value={metrics.unansweredCount}
            tone="text-slate-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 py-2">
      <p className={`text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  );
}
