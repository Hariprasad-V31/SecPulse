"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Loader2, Sparkles, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCategoryStyle } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AnswerRecord, CategoryMetric } from "@/lib/types";

interface CategoryBreakdownProps {
  metrics: CategoryMetric[];
  answers?: AnswerRecord[];
}

export function CategoryBreakdown({ metrics, answers = [] }: CategoryBreakdownProps) {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [remedies, setRemedies] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState<string | null>(null);

  const openCard = async (category: string) => {
    setSelected(category);

    if (!remedies[category]) {
      const categoryAnswers = answers.filter((a) => a.category === category);
      if (categoryAnswers.length === 0) return;

      setLoading(category);
      try {
        const res = await fetch("/api/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category, answers: categoryAnswers }),
        });
        if (res.ok) {
          const data = await res.json();
          setRemedies((prev) => ({ ...prev, [category]: data.remedies }));
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(null);
      }
    }
  };

  const selectedMetric = metrics.find((m) => m.category === selected);
  const selectedAnswers = answers.filter((a) => a.category === selected);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((metric) => {
          const style = getCategoryStyle(metric.category);
          const Icon = style.icon;
          return (
            <Card
              key={metric.category}
              className="cursor-pointer transition-all duration-300 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
              onClick={() => openCard(metric.category)}
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                        style.tint,
                      )}
                    >
                      <Icon className={cn("h-4.5 w-4.5", style.color)} />
                    </span>
                    <p
                      className="text-sm font-medium leading-snug text-slate-700"
                      title={metric.category}
                    >
                      {metric.category}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-lg font-bold tabular-nums text-slate-900">
                      {metric.percent}%
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {metric.earned}/{metric.possible} pts
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal overlay - portaled to body for correct viewport centering */}
      {selected && selectedMetric && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3">
                {(() => {
                  const style = getCategoryStyle(selectedMetric.category);
                  const Icon = style.icon;
                  return (
                    <span className={cn("grid h-10 w-10 place-items-center rounded-lg", style.tint)}>
                      <Icon className={cn("h-5 w-5", style.color)} />
                    </span>
                  );
                })()}
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedMetric.category}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedMetric.percent}% · {selectedMetric.earned}/{selectedMetric.possible} pts
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-3">
              {loading === selected && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating remediation suggestions…
                </div>
              )}

              {selectedAnswers.map((ans, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800 leading-relaxed">
                      {ans.question}
                    </p>
                    <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                      {ans.selected_score || "—"}
                    </span>
                  </div>
                  {ans.comment && (
                    <p className="text-xs text-slate-500 italic leading-relaxed">
                      &ldquo;{ans.comment}&rdquo;
                    </p>
                  )}
                  {remedies[selected]?.[idx] && (
                    <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs text-indigo-700">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{remedies[selected][idx]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
