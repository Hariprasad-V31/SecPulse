"use client";

import {
  BrainCircuit,
  Cpu,
  GitCompareArrows,
  Loader2,
  MessageSquareWarning,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  Anomaly,
  AnomalySource,
  AnomalyType,
  Severity,
} from "@/lib/types";

interface AnomalyReportProps {
  anomalies: Anomaly[];
  loading: boolean;
  source: AnomalySource | null;
  notice?: string;
  model?: string;
}

function severityVariant(severity: Severity) {
  if (severity === "High") return "danger" as const;
  if (severity === "Medium") return "warning" as const;
  return "muted" as const;
}

interface TypeTheme {
  /** Container border + background. */
  container: string;
  /** Icon chip + label pill. */
  chip: string;
  icon: typeof MessageSquareWarning;
  label: string;
}

const TYPE_THEMES: Record<AnomalyType, TypeTheme> = {
  "Comment Contradiction": {
    container:
      "border-purple-200 bg-purple-50 hover:border-purple-300",
    chip: "bg-purple-100 text-purple-700",
    icon: MessageSquareWarning,
    label: "Comment Contradiction",
  },
  "Dependency Disconnect": {
    container:
      "border-amber-200 bg-amber-50 hover:border-amber-300",
    chip: "bg-amber-100 text-amber-700",
    icon: GitCompareArrows,
    label: "Upstream Dependency Conflict",
  },
};

export function AnomalyReport({
  anomalies,
  loading,
  source,
  notice,
  model,
}: AnomalyReportProps) {
  const commentCount = anomalies.filter(
    (a) => a.type === "Comment Contradiction",
  ).length;
  const dependencyCount = anomalies.filter(
    (a) => a.type === "Dependency Disconnect",
  ).length;
  const naCount = anomalies.filter(
    (a) => a.type === "Missing N/A Justification",
  ).length;

  return (
    <div className="group relative">
      {/* Glow border */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r opacity-70 blur-[2px] transition-opacity duration-500",
          anomalies.length > 0
            ? "from-purple-400/40 via-amber-400/30 to-purple-400/40 animate-glow-pulse"
            : "from-indigo-300/30 via-violet-300/20 to-indigo-300/30",
        )}
        aria-hidden="true"
      />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-purple-100 to-amber-50 text-purple-600 ring-1 ring-purple-200">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                AI Validation &amp; Justification Anomalies
              </h2>
              <p className="text-xs text-slate-500">
                Cross-references selected scores against written comments and
                upstream dependencies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!loading && anomalies.length > 0 && (
              <div className="hidden items-center gap-2 sm:flex">
                <Badge className="border-purple-200 bg-purple-50 text-purple-700">
                  {commentCount} comment
                </Badge>
                <Badge variant="warning">{dependencyCount} dependency</Badge>
                {naCount > 0 && (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                    {naCount} missing N/A reason
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6">
          {loading ? (
            <LoadingState />
          ) : anomalies.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {anomalies.map((anomaly, idx) => {
                const theme = TYPE_THEMES[anomaly.type];
                const Icon = theme.icon;
                return (
                  <li
                    key={`${anomaly.type}-${anomaly.item}-${idx}`}
                    className={cn(
                      "animate-fade-in rounded-xl border p-4 transition-colors",
                      theme.container,
                    )}
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                          theme.chip,
                        )}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              theme.chip,
                            )}
                          >
                            {theme.label}
                          </span>
                          <Badge variant={severityVariant(anomaly.severity)}>
                            {anomaly.severity}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium leading-snug text-slate-900">
                          {anomaly.item}
                        </p>

                        <p className="text-sm leading-relaxed text-slate-600">
                          {anomaly.explanation}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {notice && !loading && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
              <Cpu className="h-3.5 w-3.5" />
              {notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="relative">
        <ScanSearch className="h-8 w-8 text-purple-500" />
        <Loader2 className="absolute -right-2 -top-2 h-4 w-4 animate-spin text-amber-500" />
      </div>
      <p className="text-sm font-medium text-slate-700">
        Running AI validation &amp; anomaly detection…
      </p>
      <p className="text-xs text-slate-500">
        Comparing maturity scores against written justifications and dependencies
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <p className="text-sm font-medium text-slate-900">
        No validation anomalies detected
      </p>
      <p className="max-w-sm text-xs text-slate-500">
        Selected maturity scores are consistent with their written
        justifications, and no upstream dependency conflicts were found.
      </p>
    </div>
  );
}
